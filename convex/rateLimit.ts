import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAdminUser } from "./utils/auth";

// =============================================================================
// RATE LIMIT CONFIGURATION
// =============================================================================

/**
 * Rate limit configurations for different operations
 */
export const RATE_LIMITS = {
  CAPSULE_GENERATION: {
    maxRequests: 10, // Maximum capsules per window
    windowMs: 60 * 60 * 1000, // 1 hour window
  },
  API_CALLS: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute window
  },
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create a unique bucket key for rate limiting
 * @param operation - The operation type (e.g., "generation", "api")
 * @param userId - The user ID to scope the limit to
 * @returns A unique bucket key string
 */
export function createBucketKey(operation: string, userId: string): string {
  return `${operation}:${userId}`;
}

/**
 * Clean old requests outside the time window
 * @param requests - Array of request timestamps
 * @param windowMs - Time window in milliseconds
 * @returns Filtered array of requests within the window
 */
function cleanOldRequests(requests: number[], windowMs: number): number[] {
  const now = Date.now();
  const windowStart = now - windowMs;
  return requests.filter((timestamp) => timestamp > windowStart);
}

// =============================================================================
// CONVEX QUERIES & MUTATIONS
// =============================================================================

/**
 * Check if a request is allowed under the rate limit
 */
export const checkRateLimit = query({
  args: {
    bucketKey: v.string(),
  },
  handler: async (ctx, args): Promise<{ allowed: boolean; retryAfterMs?: number }> => {
    const bucket = await ctx.db
      .query("rateLimitBuckets")
      .withIndex("by_bucketKey", (q) => q.eq("bucketKey", args.bucketKey))
      .first();

    if (!bucket) {
      // No bucket exists yet, allow the request
      return { allowed: true };
    }

    const now = Date.now();
    const windowStart = now - bucket.windowMs;
    const recentRequests = bucket.requests.filter((timestamp) => timestamp > windowStart);

    if (recentRequests.length >= bucket.maxRequests) {
      // Find when the oldest request will expire
      const oldestInWindow = Math.min(...recentRequests);
      const retryAfterMs = oldestInWindow + bucket.windowMs - now;
      return { allowed: false, retryAfterMs: Math.max(0, retryAfterMs) };
    }

    return { allowed: true };
  },
});

/**
 * Record a request and update the rate limit bucket
 */
export const recordRequest = mutation({
  args: {
    bucketKey: v.string(),
    maxRequests: v.number(),
    windowMs: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    const now = Date.now();
    
    const existingBucket = await ctx.db
      .query("rateLimitBuckets")
      .withIndex("by_bucketKey", (q) => q.eq("bucketKey", args.bucketKey))
      .first();

    if (existingBucket) {
      // Clean old requests and add the new one
      const cleanedRequests = cleanOldRequests(existingBucket.requests, args.windowMs);
      cleanedRequests.push(now);

      await ctx.db.patch(existingBucket._id, {
        requests: cleanedRequests,
        maxRequests: args.maxRequests,
        windowMs: args.windowMs,
        updatedAt: now,
      });
    } else {
      // Create new bucket
      await ctx.db.insert("rateLimitBuckets", {
        bucketKey: args.bucketKey,
        maxRequests: args.maxRequests,
        windowMs: args.windowMs,
        requests: [now],
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

/**
 * Get current rate limit status for a bucket
 */
export const getRateLimitStatus = query({
  args: {
    bucketKey: v.string(),
  },
  handler: async (ctx, args) => {
    const bucket = await ctx.db
      .query("rateLimitBuckets")
      .withIndex("by_bucketKey", (q) => q.eq("bucketKey", args.bucketKey))
      .first();

    if (!bucket) {
      return null;
    }

    const now = Date.now();
    const windowStart = now - bucket.windowMs;
    const recentRequests = bucket.requests.filter((timestamp) => timestamp > windowStart);

    return {
      bucketKey: bucket.bucketKey,
      maxRequests: bucket.maxRequests,
      windowMs: bucket.windowMs,
      currentRequests: recentRequests.length,
      remainingRequests: Math.max(0, bucket.maxRequests - recentRequests.length),
      resetsAt: recentRequests.length > 0 ? Math.min(...recentRequests) + bucket.windowMs : now,
    };
  },
});

/**
 * Clear a rate limit bucket (admin use only)
 */
export const clearRateLimitBucket = mutation({
  args: {
    bucketKey: v.string(),
  },
  handler: async (ctx, args): Promise<boolean> => {
    // Require admin access to clear rate limit buckets
    await requireAdminUser(ctx);

    const bucket = await ctx.db
      .query("rateLimitBuckets")
      .withIndex("by_bucketKey", (q) => q.eq("bucketKey", args.bucketKey))
      .first();

    if (bucket) {
      await ctx.db.delete(bucket._id);
      return true;
    }

    return false;
  },
});
