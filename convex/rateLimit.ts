/**
 * DB-Backed Rate Limiting
 * 
 * Provides persistent rate limiting using Convex database.
 * This ensures rate limits work across serverless function invocations
 * and multiple replicas.
 */

import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

// =============================================================================
// Types
// =============================================================================

export type RateLimitBucket = Doc<"rateLimitBuckets">;

// =============================================================================
// Queries
// =============================================================================

/**
 * Check if a request can be made within rate limits
 */
export const checkRateLimit = query({
  args: {
    bucketKey: v.string(),
  },
  handler: async (ctx, args): Promise<{ allowed: boolean; retryAfterMs: number | null; remaining: number }> => {
    const bucket = await ctx.db
      .query("rateLimitBuckets")
      .withIndex("by_bucketKey", (q) => q.eq("bucketKey", args.bucketKey))
      .unique();
    
    if (!bucket) {
      // No bucket means no requests yet, always allow
      return { allowed: true, retryAfterMs: null, remaining: 60 }; // Default limit
    }
    
    const now = Date.now();
    const windowMs = bucket.windowMs;
    const windowStart = now - windowMs;
    
    // Filter out old requests
    const recentRequests = bucket.requests.filter(ts => ts > windowStart);
    const remaining = bucket.maxRequests - recentRequests.length;
    
    if (remaining > 0) {
      return { allowed: true, retryAfterMs: null, remaining };
    }
    
    // Calculate when the oldest request will expire
    const oldestRequest = Math.min(...recentRequests);
    const retryAfterMs = oldestRequest + windowMs - now;
    
    return { 
      allowed: false, 
      retryAfterMs: Math.max(0, retryAfterMs),
      remaining: 0,
    };
  },
});

/**
 * Get rate limit status for a bucket
 */
export const getRateLimitStatus = query({
  args: {
    bucketKey: v.string(),
  },
  handler: async (ctx, args) => {
    const bucket = await ctx.db
      .query("rateLimitBuckets")
      .withIndex("by_bucketKey", (q) => q.eq("bucketKey", args.bucketKey))
      .unique();
    
    if (!bucket) {
      return null;
    }
    
    const now = Date.now();
    const windowStart = now - bucket.windowMs;
    const recentRequests = bucket.requests.filter(ts => ts > windowStart);
    
    return {
      bucketKey: bucket.bucketKey,
      maxRequests: bucket.maxRequests,
      windowMs: bucket.windowMs,
      currentRequests: recentRequests.length,
      remaining: bucket.maxRequests - recentRequests.length,
      resetsAt: recentRequests.length > 0 
        ? Math.min(...recentRequests) + bucket.windowMs 
        : now,
    };
  },
});

// =============================================================================
// Mutations
// =============================================================================

/**
 * Record a request and check if it's within limits
 * Returns whether the request is allowed
 */
export const recordRequest = mutation({
  args: {
    bucketKey: v.string(),
    maxRequests: v.optional(v.number()),
    windowMs: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ allowed: boolean; retryAfterMs: number | null }> => {
    const now = Date.now();
    const maxRequests = args.maxRequests ?? 60; // Default: 60 requests
    const windowMs = args.windowMs ?? 60_000; // Default: per minute
    const windowStart = now - windowMs;
    
    const bucket = await ctx.db
      .query("rateLimitBuckets")
      .withIndex("by_bucketKey", (q) => q.eq("bucketKey", args.bucketKey))
      .unique();
    
    if (!bucket) {
      // Create new bucket with this request
      await ctx.db.insert("rateLimitBuckets", {
        bucketKey: args.bucketKey,
        maxRequests,
        windowMs,
        requests: [now],
        createdAt: now,
        updatedAt: now,
      });
      return { allowed: true, retryAfterMs: null };
    }
    
    // Filter out old requests
    const recentRequests = bucket.requests.filter(ts => ts > windowStart);
    
    if (recentRequests.length >= bucket.maxRequests) {
      // Rate limit exceeded
      const oldestRequest = Math.min(...recentRequests);
      const retryAfterMs = oldestRequest + bucket.windowMs - now;
      return { allowed: false, retryAfterMs: Math.max(0, retryAfterMs) };
    }
    
    // Add this request
    await ctx.db.patch(bucket._id, {
      requests: [...recentRequests, now],
      updatedAt: now,
    });
    
    return { allowed: true, retryAfterMs: null };
  },
});

/**
 * Update rate limit configuration for a bucket
 */
export const updateBucketConfig = mutation({
  args: {
    bucketKey: v.string(),
    maxRequests: v.number(),
    windowMs: v.number(),
  },
  handler: async (ctx, args) => {
    const bucket = await ctx.db
      .query("rateLimitBuckets")
      .withIndex("by_bucketKey", (q) => q.eq("bucketKey", args.bucketKey))
      .unique();
    
    if (bucket) {
      await ctx.db.patch(bucket._id, {
        maxRequests: args.maxRequests,
        windowMs: args.windowMs,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("rateLimitBuckets", {
        bucketKey: args.bucketKey,
        maxRequests: args.maxRequests,
        windowMs: args.windowMs,
        requests: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Reset a rate limit bucket
 */
export const resetBucket = mutation({
  args: {
    bucketKey: v.string(),
  },
  handler: async (ctx, args) => {
    const bucket = await ctx.db
      .query("rateLimitBuckets")
      .withIndex("by_bucketKey", (q) => q.eq("bucketKey", args.bucketKey))
      .unique();
    
    if (bucket) {
      await ctx.db.patch(bucket._id, {
        requests: [],
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Clean up old rate limit data (run periodically)
 */
export const cleanupOldBuckets = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const buckets = await ctx.db.query("rateLimitBuckets").collect();
    
    for (const bucket of buckets) {
      const windowStart = now - bucket.windowMs;
      const recentRequests = bucket.requests.filter(ts => ts > windowStart);
      
      // Clean up requests array
      if (recentRequests.length !== bucket.requests.length) {
        await ctx.db.patch(bucket._id, {
          requests: recentRequests,
          updatedAt: now,
        });
      }
      
      // Delete empty buckets older than 1 hour
      if (recentRequests.length === 0 && now - bucket.updatedAt > 3600_000) {
        await ctx.db.delete(bucket._id);
      }
    }
  },
});

// =============================================================================
// Helper: Create bucket key for different use cases
// =============================================================================

export function createBucketKey(
  type: "user" | "global" | "api" | "generation",
  identifier?: string
): string {
  switch (type) {
    case "user":
      return `user:${identifier}`;
    case "global":
      return "global:api";
    case "api":
      return `api:${identifier}`;
    case "generation":
      return `generation:${identifier}`;
    default:
      return `unknown:${identifier}`;
  }
}

// =============================================================================
// Predefined Rate Limits
// =============================================================================

export const RATE_LIMITS = {
  /** Per-user capsule generation: 10 per hour */
  CAPSULE_GENERATION: {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  /** Global API calls: 100 per minute */
  GLOBAL_API: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
  },
  /** Per-user chat messages: 30 per minute */
  CHAT_MESSAGES: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 1 minute
  },
  /** Gemini API calls: 15 per minute (free tier) */
  GEMINI_API: {
    maxRequests: 15,
    windowMs: 60 * 1000, // 1 minute
  },
  /** OpenAI API calls: 60 per minute */
  OPENAI_API: {
    maxRequests: 60,
    windowMs: 60 * 1000, // 1 minute
  },
} as const;
