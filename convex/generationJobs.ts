/**
 * Generation Jobs Management
 * 
 * This module provides queries and mutations for managing capsule generation jobs.
 * 
 * Module-wise Pipeline Job States (see convex/utils/types.ts):
 * - idle: Job created but not started
 * - generating_outline: Creating course outline (1 AI call)
 * - outline_complete: Outline done
 * - generating_module_content: Creating module content (1 AI call per module)
 * - module_X_complete: Module X done
 * - completed: Generation finished successfully
 * - failed: Generation failed
 */

import { v } from "convex/values";
import { internalMutation, internalQuery, query, mutation } from "./_generated/server";
import { GENERATION_STAGES, type GenerationStage } from "./utils/types";

// =============================================================================
// Constants
// =============================================================================

/** Stale job threshold - if a job hasn't updated in this time, consider it stale */
const STALE_JOB_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

// =============================================================================
// Type-safe state validator for Convex
// =============================================================================

/**
 * Convex value schema for generation states
 * Uses the centralized type definitions from utils/types.ts
 * Note: We use v.string() to allow dynamic module stages like "module_1_complete"
 */
export const generationStateValidator = v.string();

// =============================================================================
// Queries
// =============================================================================

/**
 * Get generation job status
 */
export const getGenerationJob = query({
  args: {
    capsuleId: v.id("capsules"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("generationJobs")
      .withIndex("by_capsuleId", (q) => q.eq("capsuleId", args.capsuleId))
      .order("desc")
      .first();
  },
});

/**
 * Get generation job by ID
 */
export const getGenerationJobById = query({
  args: {
    generationId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("generationJobs")
      .withIndex("by_generationId", (q) => q.eq("generationId", args.generationId))
      .unique();
  },
});

/**
 * Get active generation jobs for a user's capsules (for progress tracking)
 */
export const getActiveGenerationJobs = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Get user's capsules that are currently processing
    const processingCapsules = await ctx.db
      .query("capsules")
      .withIndex("by_userId_status", (q) => 
        q.eq("userId", args.userId).eq("status", "processing")
      )
      .collect();
    
    if (processingCapsules.length === 0) return [];
    
    // Get generation jobs for those capsules
    const jobs = await Promise.all(
      processingCapsules.map(async (capsule) => {
        const job = await ctx.db
          .query("generationJobs")
          .withIndex("by_capsuleId", (q) => q.eq("capsuleId", capsule._id))
          .order("desc")
          .first();
        return job;
      })
    );
    
    // Filter out null jobs and return
    return jobs.filter((job): job is NonNullable<typeof job> => job !== null);
  },
});

/**
 * Get active (non-failed, non-completed) generation job for a capsule
 * Used for idempotency checks
 */
export const getActiveJobForCapsule = query({
  args: {
    capsuleId: v.id("capsules"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db
      .query("generationJobs")
      .withIndex("by_capsuleId", (q) => q.eq("capsuleId", args.capsuleId))
      .order("desc")
      .first();
    
    if (!job) return null;
    
    // Check if job is still active (not completed or failed)
    const isActive = job.state !== GENERATION_STAGES.COMPLETED && 
                     job.state !== GENERATION_STAGES.FAILED;
    
    // Check if job is stale (hasn't updated in a long time)
    const isStale = Date.now() - job.updatedAt > STALE_JOB_THRESHOLD_MS;
    
    if (isActive && !isStale) {
      return job;
    }
    
    return null;
  },
});

/**
 * Internal version for use in actions
 */
export const getActiveJobForCapsuleInternal = internalQuery({
  args: {
    capsuleId: v.id("capsules"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db
      .query("generationJobs")
      .withIndex("by_capsuleId", (q) => q.eq("capsuleId", args.capsuleId))
      .order("desc")
      .first();
    
    if (!job) return null;
    
    const isActive = job.state !== GENERATION_STAGES.COMPLETED && 
                     job.state !== GENERATION_STAGES.FAILED;
    const isStale = Date.now() - job.updatedAt > STALE_JOB_THRESHOLD_MS;
    
    return (isActive && !isStale) ? job : null;
  },
});

// =============================================================================
// Mutations
// =============================================================================

/**
 * Create a new generation job for module-wise pipeline
 */
export const createGenerationJob = mutation({
  args: {
    capsuleId: v.id("capsules"),
    generationId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    return await ctx.db.insert("generationJobs", {
      capsuleId: args.capsuleId,
      generationId: args.generationId,
      version: 1, // Initial version for optimistic locking
      state: GENERATION_STAGES.IDLE,
      currentStage: GENERATION_STAGES.IDLE,
      outlineGenerated: false,
      modulesGenerated: 0,
      totalModules: 0,
      totalLessons: 0,
      currentModuleIndex: 0,
      // Legacy fields
      lessonPlansGenerated: 0,
      lessonsGenerated: 0,
      currentLessonIndex: 0,
      startedAt: now,
      updatedAt: now,
      retryCount: 0,
      totalTokensUsed: 0,
    });
  },
});

/**
 * Internal version for use in actions
 */
export const createGenerationJobInternal = internalMutation({
  args: {
    capsuleId: v.id("capsules"),
    generationId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    return await ctx.db.insert("generationJobs", {
      capsuleId: args.capsuleId,
      generationId: args.generationId,
      version: 1,
      state: GENERATION_STAGES.IDLE,
      currentStage: GENERATION_STAGES.IDLE,
      outlineGenerated: false,
      modulesGenerated: 0,
      totalModules: 0,
      totalLessons: 0,
      currentModuleIndex: 0,
      // Legacy fields
      lessonPlansGenerated: 0,
      lessonsGenerated: 0,
      currentLessonIndex: 0,
      startedAt: now,
      updatedAt: now,
      retryCount: 0,
      totalTokensUsed: 0,
    });
  },
});

/**
 * Update generation job progress with optimistic locking
 * 
 * This prevents race conditions when multiple processes try to update the same job.
 * If the version doesn't match, it means another process has modified the job
 * since we last read it, and we should retry with the latest data.
 */
export const updateGenerationJob = mutation({
  args: {
    generationId: v.string(),
    expectedVersion: v.optional(v.number()), // For optimistic locking
    state: v.optional(generationStateValidator),
    outlineGenerated: v.optional(v.boolean()),
    lessonPlansGenerated: v.optional(v.number()),
    lessonsGenerated: v.optional(v.number()),
    totalModules: v.optional(v.number()),
    totalLessons: v.optional(v.number()),
    currentModuleIndex: v.optional(v.number()),
    currentLessonIndex: v.optional(v.number()),
    lastError: v.optional(v.string()),
    lastErrorCode: v.optional(v.string()),
    retryCount: v.optional(v.number()),
    totalTokensUsed: v.optional(v.number()),
    outlineJson: v.optional(v.string()),
    lessonPlansJson: v.optional(v.string()),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { generationId, expectedVersion, ...updates } = args;
    
    const job = await ctx.db
      .query("generationJobs")
      .withIndex("by_generationId", (q) => q.eq("generationId", generationId))
      .unique();
    
    if (!job) {
      throw new Error(`Generation job not found: ${generationId}`);
    }
    
    // Optimistic locking: check version if provided
    if (expectedVersion !== undefined && job.version !== expectedVersion) {
      throw new Error(
        `Concurrent modification detected for job ${generationId}. ` +
        `Expected version ${expectedVersion}, but found ${job.version}. ` +
        `Please retry with the latest version.`
      );
    }
    
    await ctx.db.patch(job._id, {
      ...updates,
      version: (job.version || 0) + 1, // Increment version on every update
      updatedAt: Date.now(),
    });
    
    return { newVersion: (job.version || 0) + 1 };
  },
});

/**
 * Internal version for use in actions
 */
export const updateGenerationJobInternal = internalMutation({
  args: {
    generationId: v.string(),
    expectedVersion: v.optional(v.number()),
    state: v.optional(generationStateValidator),
    outlineGenerated: v.optional(v.boolean()),
    lessonPlansGenerated: v.optional(v.number()),
    lessonsGenerated: v.optional(v.number()),
    totalModules: v.optional(v.number()),
    totalLessons: v.optional(v.number()),
    currentModuleIndex: v.optional(v.number()),
    currentLessonIndex: v.optional(v.number()),
    lastError: v.optional(v.string()),
    lastErrorCode: v.optional(v.string()),
    retryCount: v.optional(v.number()),
    totalTokensUsed: v.optional(v.number()),
    outlineJson: v.optional(v.string()),
    lessonPlansJson: v.optional(v.string()),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { generationId, expectedVersion, ...updates } = args;
    
    const job = await ctx.db
      .query("generationJobs")
      .withIndex("by_generationId", (q) => q.eq("generationId", generationId))
      .unique();
    
    if (!job) {
      throw new Error(`Generation job not found: ${generationId}`);
    }
    
    if (expectedVersion !== undefined && job.version !== expectedVersion) {
      throw new Error(
        `Concurrent modification detected for job ${generationId}. ` +
        `Expected version ${expectedVersion}, but found ${job.version}. ` +
        `Please retry with the latest version.`
      );
    }
    
    await ctx.db.patch(job._id, {
      ...updates,
      version: (job.version || 0) + 1,
      updatedAt: Date.now(),
    });
    
    return { newVersion: (job.version || 0) + 1 };
  },
});

/**
 * Mark a generation job as failed
 */
export const markJobFailed = internalMutation({
  args: {
    generationId: v.string(),
    error: v.string(),
    errorCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db
      .query("generationJobs")
      .withIndex("by_generationId", (q) => q.eq("generationId", args.generationId))
      .unique();
    
    if (!job) {
      console.error(`Cannot mark job failed - not found: ${args.generationId}`);
      return;
    }
    
    await ctx.db.patch(job._id, {
      state: GENERATION_STAGES.FAILED as GenerationStage,
      lastError: args.error,
      lastErrorCode: args.errorCode,
      updatedAt: Date.now(),
      version: (job.version || 0) + 1,
    });
  },
});

/**
 * Mark a stale/timed-out job as failed
 * This can be called from the frontend when it detects a job hasn't updated in too long
 */
export const markStaleJobAsFailed = mutation({
  args: {
    capsuleId: v.id("capsules"),
  },
  handler: async (ctx, args) => {
    // Get the latest job for this capsule
    const job = await ctx.db
      .query("generationJobs")
      .withIndex("by_capsuleId", (q) => q.eq("capsuleId", args.capsuleId))
      .order("desc")
      .first();
    
    if (!job) {
      console.warn(`[StaleJob] No job found for capsule: ${args.capsuleId}`);
      return { success: false, reason: "no_job" };
    }
    
    // Check if job is already completed or failed
    if (job.state === GENERATION_STAGES.COMPLETED || job.state === GENERATION_STAGES.FAILED) {
      return { success: false, reason: "already_terminal" };
    }
    
    // Check if job is actually stale
    const isStale = Date.now() - job.updatedAt > STALE_JOB_THRESHOLD_MS;
    if (!isStale) {
      return { success: false, reason: "not_stale" };
    }
    
    const errorMessage = "Generation timed out. The AI service took too long to respond. Please try again.";
    
    // Mark job as failed
    await ctx.db.patch(job._id, {
      state: GENERATION_STAGES.FAILED as GenerationStage,
      lastError: errorMessage,
      lastErrorCode: "TIMEOUT",
      updatedAt: Date.now(),
      completedAt: Date.now(),
      version: (job.version || 0) + 1,
    });
    
    // Mark capsule as failed
    await ctx.db.patch(args.capsuleId, {
      status: "failed",
      errorMessage: errorMessage,
      updatedAt: Date.now(),
    });
    
    console.log(`[StaleJob] Marked job ${job.generationId} as failed due to timeout`);
    
    return { success: true };
  },
});

/**
 * Get recent failed jobs for monitoring
 */
export const getRecentFailedJobs = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    
    // Get recent jobs and filter for failed ones
    const recentJobs = await ctx.db
      .query("generationJobs")
      .order("desc")
      .take(100);
    
    return recentJobs
      .filter(job => job.state === GENERATION_STAGES.FAILED)
      .slice(0, limit);
  },
});

/**
 * Get job statistics for monitoring
 */
export const getJobStatistics = query({
  args: {
    sinceDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sinceDays = args.sinceDays || 7;
    const cutoff = Date.now() - (sinceDays * 24 * 60 * 60 * 1000);
    
    const jobs = await ctx.db
      .query("generationJobs")
      .order("desc")
      .collect();
    
    const recentJobs = jobs.filter(j => j.startedAt >= cutoff);
    
    const stats = {
      total: recentJobs.length,
      completed: recentJobs.filter(j => j.state === GENERATION_STAGES.COMPLETED).length,
      failed: recentJobs.filter(j => j.state === GENERATION_STAGES.FAILED).length,
      inProgress: recentJobs.filter(j => 
        j.state !== GENERATION_STAGES.COMPLETED && 
        j.state !== GENERATION_STAGES.FAILED
      ).length,
      avgDurationMs: 0,
      totalTokensUsed: 0,
    };
    
    // Calculate average duration for completed jobs
    const completedWithDuration = recentJobs.filter(
      j => j.state === GENERATION_STAGES.COMPLETED && j.completedAt && j.startedAt
    );
    
    if (completedWithDuration.length > 0) {
      const totalDuration = completedWithDuration.reduce(
        (sum, j) => sum + ((j.completedAt || 0) - j.startedAt),
        0
      );
      stats.avgDurationMs = Math.round(totalDuration / completedWithDuration.length);
    }
    
    // Sum tokens
    stats.totalTokensUsed = recentJobs.reduce(
      (sum, j) => sum + (j.totalTokensUsed || 0),
      0
    );
    
    return stats;
  },
});

// =============================================================================
// Cancellation Support
// =============================================================================

/**
 * Cancel all active generation jobs for a capsule
 * Called when a capsule is deleted during generation
 */
export const cancelGenerationJobsForCapsule = internalMutation({
  args: {
    capsuleId: v.id("capsules"),
  },
  handler: async (ctx, args) => {
    // Find all jobs for this capsule that are not already completed/failed/cancelled
    const jobs = await ctx.db
      .query("generationJobs")
      .withIndex("by_capsuleId", (q) => q.eq("capsuleId", args.capsuleId))
      .collect();
    
    let cancelledCount = 0;
    
    for (const job of jobs) {
      // Only cancel jobs that are still active (not completed, failed, or already cancelled)
      if (
        job.state !== GENERATION_STAGES.COMPLETED &&
        job.state !== GENERATION_STAGES.FAILED &&
        job.state !== GENERATION_STAGES.CANCELLED
      ) {
        await ctx.db.patch(job._id, {
          state: GENERATION_STAGES.CANCELLED as GenerationStage,
          lastError: "Generation cancelled: capsule was deleted",
          updatedAt: Date.now(),
          completedAt: Date.now(),
          version: (job.version || 0) + 1,
        });
        cancelledCount++;
        console.log(`[CancelJob] Cancelled job ${job.generationId} for deleted capsule ${args.capsuleId}`);
      }
    }
    
    return { cancelledCount };
  },
});

/**
 * Check if a generation job is still valid (not cancelled, capsule still exists)
 * Used by generation stages to abort early if the capsule was deleted
 */
export const isGenerationJobValid = internalQuery({
  args: {
    generationId: v.string(),
    capsuleId: v.id("capsules"),
  },
  handler: async (ctx, args) => {
    // Check if capsule still exists
    const capsule = await ctx.db.get(args.capsuleId);
    if (!capsule) {
      return { valid: false, reason: "capsule_deleted" };
    }
    
    // Check if job exists and is not cancelled
    const job = await ctx.db
      .query("generationJobs")
      .withIndex("by_generationId", (q) => q.eq("generationId", args.generationId))
      .unique();
    
    if (!job) {
      return { valid: false, reason: "job_not_found" };
    }
    
    if (job.state === GENERATION_STAGES.CANCELLED) {
      return { valid: false, reason: "job_cancelled" };
    }
    
    if (job.state === GENERATION_STAGES.FAILED) {
      return { valid: false, reason: "job_failed" };
    }
    
    return { valid: true, reason: null };
  },
});
