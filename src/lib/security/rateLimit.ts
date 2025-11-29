/**
 * Rate Limiting Utility
 * 
 * Provides rate limiting for API endpoints with support for:
 * - In-memory storage (development/single instance)
 * - Redis storage via Upstash (production/multi-instance)
 * 
 * Configure Redis by setting UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 * environment variables. Falls back to in-memory if not configured.
 */

import { NextRequest, NextResponse } from "next/server";

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Configuration for rate limiting
 */
export interface RateLimitConfig {
  /** Time window in milliseconds */
  interval: number;
  /** Maximum requests allowed in the interval */
  maxRequests: number;
}

/**
 * Internal store entry
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// =============================================================================
// STORAGE BACKENDS
// =============================================================================

/**
 * Check if Redis is configured
 */
const isRedisConfigured = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

/**
 * In-memory rate limit store (fallback for development)
 */
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Cleanup old entries periodically to prevent memory leaks (in-memory only)
 */
const CLEANUP_INTERVAL = 60000; // 1 minute
let lastCleanup = Date.now();

function cleanupExpiredEntries(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  
  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// =============================================================================
// REDIS RATE LIMITING (Production)
// =============================================================================

/**
 * Rate limit using Redis (Upstash) - production-ready for multi-instance deployments
 */
async function rateLimitWithRedis(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  
  const now = Date.now();
  const windowKey = `ratelimit:${identifier}:${Math.floor(now / config.interval)}`;
  
  try {
    // Increment counter with automatic expiry
    const response = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", windowKey],
        ["PEXPIRE", windowKey, config.interval.toString()],
      ]),
    });

    if (!response.ok) {
      console.error("[RATE_LIMIT] Redis error, falling back to in-memory rate limiting");
      // HIGH-1 FIX: Fall back to in-memory instead of failing open
      return rateLimitInMemory(identifier, config);
    }

    const results = await response.json();
    const count = results[0]?.result || 1;
    const resetTime = now + config.interval - (now % config.interval);

    if (count > config.maxRequests) {
      return {
        success: false,
        limit: config.maxRequests,
        remaining: 0,
        reset: resetTime,
      };
    }

    return {
      success: true,
      limit: config.maxRequests,
      remaining: Math.max(0, config.maxRequests - count),
      reset: resetTime,
    };
  } catch (error) {
    console.error("[RATE_LIMIT] Redis connection error:", error);
    // HIGH-1 FIX: Fall back to in-memory instead of failing open
    return rateLimitInMemory(identifier, config);
  }
}

/**
 * Rate limit using in-memory storage (development/single instance)
 */
function rateLimitInMemory(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanupExpiredEntries();

  const now = Date.now();
  const key = identifier;
  const stored = rateLimitStore.get(key);

  // First request or window expired - reset counter
  if (!stored || now > stored.resetTime) {
    const resetTime = now + config.interval;
    rateLimitStore.set(key, { count: 1, resetTime });
    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      reset: resetTime,
    };
  }

  // Check if limit exceeded
  if (stored.count >= config.maxRequests) {
    return {
      success: false,
      limit: config.maxRequests,
      remaining: 0,
      reset: stored.resetTime,
    };
  }

  // Increment counter
  stored.count++;
  return {
    success: true,
    limit: config.maxRequests,
    remaining: config.maxRequests - stored.count,
    reset: stored.resetTime,
  };
}

// =============================================================================
// PRESETS AND UTILITIES
// =============================================================================

/**
 * Preset rate limits for different endpoint types
 */
export const RATE_LIMIT_PRESETS = {
  /** AI generation endpoints - expensive operations */
  AI_GENERATION: { interval: 60000, maxRequests: 10 },
  /** Transcript fetching */
  TRANSCRIPT: { interval: 60000, maxRequests: 20 },
  /** YouTube API proxy */
  YOUTUBE: { interval: 60000, maxRequests: 30 },
  /** Certificate operations */
  CERTIFICATE: { interval: 60000, maxRequests: 5 },
  /** Video creation */
  VIDEO_CREATE: { interval: 60000, maxRequests: 15 },
  /** Chat operations */
  CHAT: { interval: 60000, maxRequests: 20 },
  /** Authentication attempts - strict limit to prevent brute force */
  AUTH: { interval: 300000, maxRequests: 5 }, // 5 attempts per 5 minutes
  /** Capsule creation - expensive operation */
  CAPSULE_CREATE: { interval: 60000, maxRequests: 5 },
  /** Course creation */
  COURSE_CREATE: { interval: 60000, maxRequests: 10 },
  /** Admin operations */
  ADMIN: { interval: 60000, maxRequests: 30 },
  /** Public API calls (listing, etc.) */
  PUBLIC_API: { interval: 60000, maxRequests: 60 },
  /** General API calls */
  GENERAL: { interval: 60000, maxRequests: 100 },
} as const;

/**
 * Extract identifier from request for rate limiting
 * Uses IP address or falls back to a header-based identifier
 */
function getIdentifier(request: NextRequest): string {
  // Try to get real IP from various headers (for proxied requests)
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback to a combination of user-agent and accept-language
  // This is less reliable but better than nothing
  const userAgent = request.headers.get("user-agent") || "unknown";
  const acceptLang = request.headers.get("accept-language") || "unknown";
  
  return `fallback-${hashString(userAgent + acceptLang)}`;
}

/**
 * Simple string hash for fallback identifier
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Track if we've already logged the Redis warning (prevent spam)
 */
let redisWarningLogged = false;

/**
 * Core rate limiting function
 * Automatically uses Redis in production (if configured) or in-memory for development
 * 
 * HIGH-2 FIX: In production without Redis, rate limiting still works but logs warnings.
 * For true multi-instance safety, Redis should be configured.
 * 
 * @param identifier - Unique identifier for the client (e.g., IP address)
 * @param config - Rate limit configuration
 * @returns Rate limit result with success status and metadata
 */
export async function rateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  // Use Redis in production if configured, otherwise use in-memory
  if (isRedisConfigured) {
    return rateLimitWithRedis(identifier, config);
  }
  
  // HIGH-2 FIX: Log warning in production if Redis is not configured (only once)
  if (process.env.NODE_ENV === "production" && !redisWarningLogged) {
    redisWarningLogged = true;
    console.error(
      "[RATE_LIMIT] SECURITY WARNING: Redis not configured in production! " +
      "Rate limiting will NOT work across multiple serverless instances. " +
      "This is a security risk. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN. " +
      "Falling back to in-memory rate limiting (single-instance only)."
    );
  }
  
  return rateLimitInMemory(identifier, config);
}

/**
 * Convenience wrapper for Next.js API routes
 * Returns a NextResponse if rate limited, null otherwise
 * 
 * @param request - Next.js request object
 * @param config - Rate limit configuration
 * @param prefix - Optional prefix for the rate limit key (e.g., endpoint name)
 * @returns NextResponse with 429 status if rate limited, null if allowed
 * 
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const rateLimitResponse = await withRateLimit(request, RATE_LIMIT_PRESETS.AI_GENERATION);
 *   if (rateLimitResponse) return rateLimitResponse;
 *   
 *   // ... handle request
 * }
 * ```
 */
export async function withRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  prefix?: string
): Promise<NextResponse | null> {
  const identifier = getIdentifier(request);
  const key = prefix ? `${prefix}:${identifier}` : identifier;
  
  const result = await rateLimit(key, config);

  if (!result.success) {
    const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
    
    return NextResponse.json(
      {
        error: "Too many requests",
        message: "Rate limit exceeded. Please try again later.",
        retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfter.toString(),
          "X-RateLimit-Limit": result.limit.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": result.reset.toString(),
        },
      }
    );
  }

  return null;
}

/**
 * Rate limit with custom identifier (e.g., user ID for authenticated endpoints)
 */
export async function withRateLimitByUser(
  userId: string,
  config: RateLimitConfig,
  prefix?: string
): Promise<RateLimitResult> {
  const key = prefix ? `${prefix}:user:${userId}` : `user:${userId}`;
  return rateLimit(key, config);
}
