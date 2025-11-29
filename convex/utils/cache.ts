/**
 * Convex Caching Layer
 * 
 * Provides caching utilities for Convex queries using a simple in-memory cache.
 * Note: In Convex, queries are already cached by the runtime, but this provides
 * additional application-level caching for computed values.
 * 
 * For production use with multiple instances, consider using:
 * - Convex's built-in caching (queries are automatically cached)
 * - External cache like Redis for cross-instance caching
 */

import { Id } from "../_generated/dataModel";

/**
 * Cache entry with TTL
 */
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/**
 * Simple in-memory cache for computed values
 * Note: This cache is per-worker instance in Convex
 */
const computedCache = new Map<string, CacheEntry<unknown>>();

/**
 * Default TTL: 30 seconds
 */
const DEFAULT_TTL = 30 * 1000;

/**
 * Maximum cache size
 */
const MAX_CACHE_SIZE = 1000;

/**
 * Generate cache key for course progress
 */
export function courseProgressKey(courseId: Id<"courses">, userId: Id<"users">): string {
  return `course_progress:${courseId}:${userId}`;
}

/**
 * Generate cache key for content item progress
 */
export function contentItemProgressKey(
  contentItemId: Id<"contentItems">,
  userId: Id<"users">
): string {
  return `content_progress:${contentItemId}:${userId}`;
}

/**
 * Generate cache key for certificate eligibility
 */
export function certificateEligibilityKey(
  courseId: Id<"courses">,
  userId: Id<"users">
): string {
  return `cert_eligibility:${courseId}:${userId}`;
}

/**
 * Get cached value
 */
export function getCached<T>(key: string): T | null {
  const entry = computedCache.get(key) as CacheEntry<T> | undefined;
  
  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    computedCache.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * Set cached value
 */
export function setCached<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
  // Enforce max size
  if (computedCache.size >= MAX_CACHE_SIZE) {
    // Simple eviction: delete oldest entries
    const keysToDelete: string[] = [];
    const now = Date.now();
    
    for (const [k, v] of computedCache.entries()) {
      if (now > v.expiresAt) {
        keysToDelete.push(k);
      }
    }
    
    for (const k of keysToDelete) {
      computedCache.delete(k);
    }

    // If still at max, delete first entry
    if (computedCache.size >= MAX_CACHE_SIZE) {
      const firstKey = computedCache.keys().next().value;
      if (firstKey) {
        computedCache.delete(firstKey);
      }
    }
  }

  computedCache.set(key, {
    data,
    expiresAt: Date.now() + ttl,
  });
}

/**
 * Invalidate cache by key
 */
export function invalidateCache(key: string): boolean {
  return computedCache.delete(key);
}

/**
 * Invalidate cache by pattern
 */
export function invalidateCachePattern(pattern: string): number {
  let count = 0;
  for (const key of computedCache.keys()) {
    if (key.includes(pattern)) {
      computedCache.delete(key);
      count++;
    }
  }
  return count;
}

/**
 * Invalidate all cache entries for a user
 */
export function invalidateUserCache(userId: Id<"users">): number {
  return invalidateCachePattern(`:${userId}`);
}

/**
 * Invalidate all cache entries for a course
 */
export function invalidateCourseCache(courseId: Id<"courses">): number {
  return invalidateCachePattern(`:${courseId}:`);
}

/**
 * Clear entire cache
 */
export function clearCache(): void {
  computedCache.clear();
}

/**
 * Get or compute cached value
 * Useful for expensive computations
 */
export async function getOrComputeCached<T>(
  key: string,
  compute: () => Promise<T>,
  ttl: number = DEFAULT_TTL
): Promise<T> {
  const cached = getCached<T>(key);
  if (cached !== null) {
    return cached;
  }

  const result = await compute();
  setCached(key, result, ttl);
  return result;
}

/**
 * Cache statistics
 */
export function getCacheStats(): {
  size: number;
  maxSize: number;
} {
  return {
    size: computedCache.size,
    maxSize: MAX_CACHE_SIZE,
  };
}

/**
 * Batch fetch with caching
 * Fetches multiple items, using cache where available
 */
export async function batchFetchWithCache<T>(
  keys: string[],
  fetcher: (missingKeys: string[]) => Promise<Map<string, T>>,
  ttl: number = DEFAULT_TTL
): Promise<Map<string, T>> {
  const results = new Map<string, T>();
  const missingKeys: string[] = [];

  // Check cache first
  for (const key of keys) {
    const cached = getCached<T>(key);
    if (cached !== null) {
      results.set(key, cached);
    } else {
      missingKeys.push(key);
    }
  }

  // Fetch missing items
  if (missingKeys.length > 0) {
    const fetched = await fetcher(missingKeys);
    for (const [key, value] of fetched.entries()) {
      results.set(key, value);
      setCached(key, value, ttl);
    }
  }

  return results;
}

/**
 * Progress Summary Cache
 * Specialized caching for progress summary computations
 */
export interface CachedProgressSummary {
  courseId: Id<"courses">;
  userId: Id<"users">;
  totalItems: number;
  completedItems: number;
  completionPercentage: number;
  gradedItems: number;
  passedGradedItems: number;
  overallGrade: number | null;
  eligibleForCertificate: boolean;
  hasCertificate: boolean;
  computedAt: number;
}

/**
 * Cache a progress summary
 */
export function cacheProgressSummary(summary: CachedProgressSummary): void {
  const key = courseProgressKey(summary.courseId, summary.userId);
  setCached(key, summary, 30 * 1000); // 30 second TTL
}

/**
 * Get cached progress summary
 */
export function getCachedProgressSummary(
  courseId: Id<"courses">,
  userId: Id<"users">
): CachedProgressSummary | null {
  const key = courseProgressKey(courseId, userId);
  return getCached<CachedProgressSummary>(key);
}
