/**
 * Optimistic Locking Utilities for Convex
 * 
 * Provides mechanisms to prevent race conditions in progress updates
 * by using version numbers to detect concurrent modifications.
 * 
 * How it works:
 * 1. Each progress record has a version number
 * 2. Before updating, read the current version
 * 3. Include version check in the update
 * 4. If version changed, retry or fail
 */

import { MutationCtx } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";

/**
 * Version-aware document interface
 */
export interface VersionedDocument {
  _id: Id<"progress">;
  version?: number;
}

/**
 * Result of an optimistic update attempt
 */
export type OptimisticUpdateResult<T> =
  | { success: true; data: T }
  | { success: false; reason: "version_conflict" | "not_found" | "error"; message: string };

/**
 * Check if a document version matches expected version
 */
export function checkVersion(
  doc: { version?: number } | null,
  expectedVersion: number
): boolean {
  if (!doc) return false;
  const currentVersion = doc.version ?? 0;
  return currentVersion === expectedVersion;
}

/**
 * Get the next version number
 */
export function nextVersion(currentVersion?: number): number {
  return (currentVersion ?? 0) + 1;
}

/**
 * Attempt an optimistic update on a progress record
 * 
 * @param ctx - Mutation context
 * @param progressId - ID of the progress record to update
 * @param expectedVersion - Expected version of the record
 * @param updates - Fields to update (version will be incremented automatically)
 * @returns Result indicating success or failure reason
 */
export async function optimisticProgressUpdate(
  ctx: MutationCtx,
  progressId: Id<"progress">,
  expectedVersion: number,
  updates: Partial<Omit<Doc<"progress">, "_id" | "_creationTime" | "version">>
): Promise<OptimisticUpdateResult<Doc<"progress">>> {
  try {
    // Read current state
    const current = await ctx.db.get(progressId);
    
    if (!current) {
      return {
        success: false,
        reason: "not_found",
        message: `Progress record ${progressId} not found`,
      };
    }

    // Check version
    const currentVersion = current.version ?? 0;
    if (currentVersion !== expectedVersion) {
      return {
        success: false,
        reason: "version_conflict",
        message: `Version conflict: expected ${expectedVersion}, found ${currentVersion}`,
      };
    }

    // Apply update with incremented version
    await ctx.db.patch(progressId, {
      ...updates,
      version: nextVersion(currentVersion),
    });

    // Return updated document
    const updated = await ctx.db.get(progressId);
    if (!updated) {
      return {
        success: false,
        reason: "error",
        message: "Failed to read updated document",
      };
    }

    return { success: true, data: updated };
  } catch (error) {
    return {
      success: false,
      reason: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Retry an optimistic update with exponential backoff
 * 
 * @param ctx - Mutation context
 * @param fn - Function that performs the update (should return OptimisticUpdateResult)
 * @param maxRetries - Maximum number of retries (default: 3)
 * @returns Final result after retries
 */
export async function withRetry<T>(
  fn: () => Promise<OptimisticUpdateResult<T>>,
  maxRetries: number = 3
): Promise<OptimisticUpdateResult<T>> {
  let lastResult: OptimisticUpdateResult<T>;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    lastResult = await fn();
    
    if (lastResult.success) {
      return lastResult;
    }

    // Only retry on version conflicts
    if (lastResult.reason !== "version_conflict") {
      return lastResult;
    }

    // Don't wait on last attempt
    if (attempt < maxRetries) {
      // Exponential backoff: 10ms, 20ms, 40ms
      await new Promise(resolve => setTimeout(resolve, 10 * Math.pow(2, attempt)));
    }
  }

  return lastResult!;
}

/**
 * Create a progress record with initial version
 */
export async function createVersionedProgress(
  ctx: MutationCtx,
  data: Omit<Doc<"progress">, "_id" | "_creationTime" | "version">
): Promise<Id<"progress">> {
  return await ctx.db.insert("progress", {
    ...data,
    version: 1,
  });
}

/**
 * Safe progress update that handles version conflicts
 * 
 * This is the main function to use for updating progress records.
 * It will:
 * 1. Read the current record
 * 2. Compute the new values using the updater function
 * 3. Apply the update with version check
 * 4. Retry on version conflict
 */
export async function safeProgressUpdate(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    courseId: Id<"courses">;
    contentItemId: Id<"contentItems">;
  },
  updater: (current: Doc<"progress">) => Partial<Omit<Doc<"progress">, "_id" | "_creationTime" | "version">>
): Promise<OptimisticUpdateResult<Doc<"progress">>> {
  return await withRetry(async () => {
    // Find the progress record
    const existingRecords = await ctx.db
      .query("progress")
      .withIndex("by_userId_courseId_contentItemId", (q) =>
        q
          .eq("userId", args.userId)
          .eq("courseId", args.courseId)
          .eq("contentItemId", args.contentItemId)
      )
      .collect();

    if (existingRecords.length === 0) {
      return {
        success: false,
        reason: "not_found",
        message: "Progress record not found",
      };
    }

    // Use the first record (there should only be one)
    const current = existingRecords[0];
    const expectedVersion = current.version ?? 0;

    // Compute updates
    const updates = updater(current);

    // Apply with version check
    return await optimisticProgressUpdate(ctx, current._id, expectedVersion, updates);
  });
}

/**
 * Compare-and-swap operation for a specific field
 */
export async function compareAndSwap<K extends keyof Doc<"progress">>(
  ctx: MutationCtx,
  progressId: Id<"progress">,
  field: K,
  expectedValue: Doc<"progress">[K],
  newValue: Doc<"progress">[K]
): Promise<OptimisticUpdateResult<Doc<"progress">>> {
  const current = await ctx.db.get(progressId);
  
  if (!current) {
    return {
      success: false,
      reason: "not_found",
      message: "Progress record not found",
    };
  }

  if (current[field] !== expectedValue) {
    return {
      success: false,
      reason: "version_conflict",
      message: `Field ${String(field)} changed: expected ${String(expectedValue)}, found ${String(current[field])}`,
    };
  }

  await ctx.db.patch(progressId, {
    [field]: newValue,
    version: nextVersion(current.version),
  } as Partial<Doc<"progress">>);

  const updated = await ctx.db.get(progressId);
  if (!updated) {
    return {
      success: false,
      reason: "error",
      message: "Failed to read updated document",
    };
  }

  return { success: true, data: updated };
}

/**
 * Merge function type for combining concurrent updates
 */
export type MergeFunction<T> = (current: T, pending: T) => T;

/**
 * Default merge strategies for common fields
 */
export const MERGE_STRATEGIES = {
  /**
   * Take the maximum value (good for bestScore)
   */
  max: (current: number, pending: number) => Math.max(current, pending),

  /**
   * Take the latest value (good for timestamps)
   */
  latest: <T>(current: T, pending: T, currentTime: number, pendingTime: number) =>
    pendingTime > currentTime ? pending : current,

  /**
   * Accumulate values (good for attempts count)
   */
  sum: (current: number, pending: number) => current + pending,

  /**
   * Logical OR (good for passed/completed flags)
   */
  or: (current: boolean, pending: boolean) => current || pending,
} as const;

/**
 * Apply merge strategies to resolve conflicting updates
 */
export function mergeProgressUpdates(
  current: Doc<"progress">,
  pending: Partial<Doc<"progress">>
): Partial<Doc<"progress">> {
  const merged: Partial<Doc<"progress">> = { ...pending };

  // bestScore: always take max
  if (pending.bestScore !== undefined && current.bestScore !== undefined) {
    merged.bestScore = MERGE_STRATEGIES.max(current.bestScore, pending.bestScore);
  }

  // passed: true if ever passed
  if (pending.passed !== undefined && current.passed !== undefined) {
    merged.passed = MERGE_STRATEGIES.or(current.passed, pending.passed);
  }

  // completed: true if ever completed
  if (pending.completed !== undefined && current.completed !== undefined) {
    merged.completed = MERGE_STRATEGIES.or(current.completed, pending.completed);
  }

  // attempts: don't override, handled separately
  if (pending.attempts !== undefined) {
    // Keep pending attempts as it should be incremented by caller
  }

  return merged;
}
