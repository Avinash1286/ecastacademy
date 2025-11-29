/**
 * Caching Layer for Progress Calculations
 * 
 * Provides in-memory caching with TTL for expensive progress calculations.
 * Designed to reduce database load for frequently accessed progress data.
 * 
 * Features:
 * - TTL-based expiration
 * - Manual invalidation
 * - Size-limited cache
 * - Automatic cleanup
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
}

interface CacheConfig {
  /** Time-to-live in milliseconds */
  ttl: number;
  /** Maximum number of entries */
  maxSize: number;
  /** Cleanup interval in milliseconds */
  cleanupInterval: number;
}

const DEFAULT_CONFIG: CacheConfig = {
  ttl: 60 * 1000, // 1 minute
  maxSize: 1000,
  cleanupInterval: 5 * 60 * 1000, // 5 minutes
};

/**
 * Cache keys for different types of progress data
 */
export const CACHE_KEYS = {
  courseProgress: (courseId: string, userId: string) => 
    `course_progress:${courseId}:${userId}`,
  contentItemProgress: (contentItemId: string, userId: string) => 
    `content_progress:${contentItemId}:${userId}`,
  userCertificates: (userId: string) => 
    `user_certificates:${userId}`,
  certificateEligibility: (courseId: string, userId: string) => 
    `cert_eligibility:${courseId}:${userId}`,
} as const;

/**
 * TTL presets for different cache types (in milliseconds)
 */
export const CACHE_TTL = {
  /** Progress data - relatively short TTL as it changes frequently */
  PROGRESS: 30 * 1000, // 30 seconds
  /** Course structure - longer TTL as it changes rarely */
  COURSE_STRUCTURE: 5 * 60 * 1000, // 5 minutes
  /** Certificate data - medium TTL */
  CERTIFICATE: 2 * 60 * 1000, // 2 minutes
  /** Eligibility checks - short TTL */
  ELIGIBILITY: 15 * 1000, // 15 seconds
} as const;

class ProgressCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private config: CacheConfig;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanupTimer();
  }

  /**
   * Get a cached value
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set a cached value
   */
  set<T>(key: string, data: T, ttl?: number): void {
    // Enforce max size
    if (this.cache.size >= this.config.maxSize) {
      this.evictOldest();
    }

    const now = Date.now();
    this.cache.set(key, {
      data,
      expiresAt: now + (ttl ?? this.config.ttl),
      createdAt: now,
    });
  }

  /**
   * Delete a specific cache entry
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  invalidatePattern(pattern: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Invalidate all cache entries for a user
   */
  invalidateUser(userId: string): number {
    return this.invalidatePattern(`:${userId}`);
  }

  /**
   * Invalidate all cache entries for a course
   */
  invalidateCourse(courseId: string): number {
    return this.invalidatePattern(`:${courseId}:`);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    oldestEntry: number | null;
  } {
    let oldestEntry: number | null = null;
    
    for (const entry of this.cache.values()) {
      if (oldestEntry === null || entry.createdAt < oldestEntry) {
        oldestEntry = entry.createdAt;
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hitRate: 0, // Would need tracking hits/misses
      oldestEntry,
    };
  }

  /**
   * Get or compute a cached value
   * If the value is not in cache, compute it and cache the result
   */
  async getOrCompute<T>(
    key: string,
    compute: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const result = await compute();
    this.set(key, result, ttl);
    return result;
  }

  /**
   * Evict the oldest entries to make room
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Start the cleanup timer
   */
  private startCleanupTimer(): void {
    if (typeof window !== "undefined") {
      // Client-side: use setInterval
      this.cleanupTimer = setInterval(
        () => this.cleanup(),
        this.config.cleanupInterval
      );
    }
  }

  /**
   * Stop the cleanup timer
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }
}

// Create singleton instance for server-side caching
let serverCache: ProgressCache | null = null;

export function getProgressCache(): ProgressCache {
  if (!serverCache) {
    serverCache = new ProgressCache({
      ttl: CACHE_TTL.PROGRESS,
      maxSize: 5000,
      cleanupInterval: 60 * 1000, // 1 minute
    });
  }
  return serverCache;
}

/**
 * Decorator-style cache wrapper for async functions
 */
export function withCache<T extends unknown[], R>(
  keyGenerator: (...args: T) => string,
  fn: (...args: T) => Promise<R>,
  ttl?: number
): (...args: T) => Promise<R> {
  const cache = getProgressCache();

  return async (...args: T): Promise<R> => {
    const key = keyGenerator(...args);
    return cache.getOrCompute(key, () => fn(...args), ttl);
  };
}

/**
 * Export the class for testing or custom instances
 */
export { ProgressCache };
export type { CacheConfig, CacheEntry };
