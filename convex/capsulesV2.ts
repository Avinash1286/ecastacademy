/**
 * V2 Capsule Generation
 * 
 * Multi-stage generation system with:
 * - Smaller, more reliable AI calls
 * - State machine for resumption
 * - Better error handling
 * - Observability and metrics
 */

import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

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

// =============================================================================
// Mutations
// =============================================================================

/**
 * Create a new generation job
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
      state: "idle",
      outlineGenerated: false,
      lessonPlansGenerated: 0,
      lessonsGenerated: 0,
      totalModules: 0,
      totalLessons: 0,
      currentModuleIndex: 0,
      currentLessonIndex: 0,
      startedAt: now,
      updatedAt: now,
      retryCount: 0,
      totalTokensUsed: 0,
    });
  },
});

/**
 * Update generation job progress
 */
export const updateGenerationJob = mutation({
  args: {
    generationId: v.string(),
    state: v.optional(v.union(
      v.literal("idle"),
      v.literal("generating_outline"),
      v.literal("outline_complete"),
      v.literal("generating_lesson_plans"),
      v.literal("lesson_plans_complete"),
      v.literal("generating_content"),
      v.literal("content_complete"),
      v.literal("completed"),
      v.literal("failed")
    )),
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
    const { generationId, ...updates } = args;
    
    const job = await ctx.db
      .query("generationJobs")
      .withIndex("by_generationId", (q) => q.eq("generationId", generationId))
      .unique();
    
    if (!job) {
      throw new Error(`Generation job not found: ${generationId}`);
    }
    
    await ctx.db.patch(job._id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

// =============================================================================
// V2 Generation Action
// =============================================================================

/**
 * Generate capsule content using V2 multi-stage system
 */
export const generateCapsuleContentV2 = action({
  args: {
    capsuleId: v.id("capsules"),
  },
  handler: async (ctx, args): Promise<{ generationId: string; success: boolean }> => {
    // Get capsule
    const capsule = await ctx.runQuery(api.capsules.getCapsule, {
      capsuleId: args.capsuleId,
    });
    
    if (!capsule) {
      throw new Error("Capsule not found");
    }
    
    // Validate source content
    if (capsule.sourceType === "pdf" && !capsule.sourcePdfStorageId && !capsule.sourcePdfData) {
      await ctx.runMutation(api.capsules.updateCapsuleStatus, {
        capsuleId: args.capsuleId,
        status: "failed",
        errorMessage: "PDF data missing for capsule",
      });
      throw new Error("PDF data missing for capsule");
    }
    
    if (capsule.sourceType === "topic" && !capsule.sourceTopic) {
      await ctx.runMutation(api.capsules.updateCapsuleStatus, {
        capsuleId: args.capsuleId,
        status: "failed",
        errorMessage: "Topic missing for capsule",
      });
      throw new Error("Topic missing for capsule");
    }
    
    // Reset capsule content before starting generation (handles retries)
    await ctx.runMutation(api.capsules.resetCapsule, {
      capsuleId: args.capsuleId,
    });
    
    // Update status to processing FIRST so user sees progress
    await ctx.runMutation(api.capsules.updateCapsuleStatus, {
      capsuleId: args.capsuleId,
      status: "processing",
    });
    
    // Generate unique ID for this generation
    const generationId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    // Create generation job record
    await ctx.runMutation(api.capsulesV2.createGenerationJob, {
      capsuleId: args.capsuleId,
      generationId,
    });
    
    try {
      // Fetch PDF from storage if needed (inside try block for proper error handling)
      let pdfBase64: string | undefined;
      if (capsule.sourceType === "pdf") {
        if (capsule.sourcePdfStorageId) {
          // Fetch from Convex storage
          console.log("[V2 Generation] Fetching PDF from Convex storage...");
          pdfBase64 = await ctx.runAction(api.capsules.getPdfBase64, {
            storageId: capsule.sourcePdfStorageId,
          });
          console.log("[V2 Generation] PDF fetched successfully");
        } else if (capsule.sourcePdfData) {
          // Legacy: use inline base64
          pdfBase64 = capsule.sourcePdfData;
        }
        
        if (!pdfBase64) {
          throw new Error("Failed to retrieve PDF data for generation");
        }
      }
      
      // Get AI model configuration
      const { resolveWithConvexCtx, MissingAIModelMappingError } = await import(
        "../shared/ai/modelResolver"
      );
      
      let modelConfig;
      try {
        modelConfig = await resolveWithConvexCtx(ctx, "capsule_generation");
      } catch (resolverError) {
        const friendlyMessage =
          resolverError instanceof MissingAIModelMappingError
            ? "Capsule generation is currently unavailable. Please configure an AI model in the admin panel."
            : "Failed to resolve capsule generation model configuration.";
        throw new Error(friendlyMessage);
      }
      
      // Import the orchestrator
      const { createCapsuleOrchestrator } = await import(
        "../shared/ai/generation/orchestrator"
      );
      const { createMetricsCollector } = await import(
        "../shared/ai/observability/metrics"
      );
      
      // Create metrics collector with persistence callback (for future use)
      createMetricsCollector({
        generationId,
        capsuleId: args.capsuleId,
        provider: modelConfig.provider,
        model: modelConfig.modelId,
        onPersist: async (metric) => {
          await ctx.runMutation(api.generationMetrics.recordStageMetric, {
            generationId: metric.generationId,
            capsuleId: args.capsuleId,
            stage: metric.stage,
            stageDurationMs: metric.stageDurationMs,
            stageTokensUsed: metric.stageTokensUsed,
            stageSuccess: metric.stageSuccess,
            stageError: metric.stageError,
            provider: metric.provider,
            model: metric.model,
            attempt: metric.attempt,
            startedAt: metric.startedAt,
            completedAt: metric.completedAt,
          });
        },
      });
      
      // Create orchestrator
      const orchestrator = createCapsuleOrchestrator(
        {
          aiConfig: {
            provider: modelConfig.provider as "google" | "openai",
            apiKey: modelConfig.apiKey,
            modelId: modelConfig.modelId,
          },
          maxRetries: 2,
          debug: true,
          onProgress: async (progress, message) => {
            // Update job progress in database
            await ctx.runMutation(api.capsulesV2.updateGenerationJob, {
              generationId,
              state: progress.state,
              outlineGenerated: progress.outlineGenerated,
              lessonPlansGenerated: progress.lessonPlansGenerated,
              lessonsGenerated: progress.lessonsGenerated,
              totalModules: progress.totalModules,
              totalLessons: progress.totalLessons,
              currentModuleIndex: progress.currentModuleIndex,
              currentLessonIndex: progress.currentLessonIndex,
              totalTokensUsed: progress.totalTokensUsed,
            });
            
            console.log(`[V2 Generation] ${message}`);
          },
        },
        generationId,
        args.capsuleId
      );
      
      // Build input based on source type
      const input = capsule.sourceType === "pdf"
        ? {
            type: "pdf" as const,
            pdfBase64: pdfBase64!,
            pdfMimeType: capsule.sourcePdfMime,
            guidance: capsule.userPrompt,
          }
        : {
            type: "topic" as const,
            topic: capsule.sourceTopic!,
            guidance: capsule.userPrompt,
          };
      
      // Run generation
      const result = await orchestrator.generate(input);
      
      if (!result.success || !result.capsule) {
        // Update job with error
        await ctx.runMutation(api.capsulesV2.updateGenerationJob, {
          generationId,
          state: "failed",
          lastError: result.error || "Unknown error",
        });
        
        // Update capsule status
        await ctx.runMutation(api.capsules.updateCapsuleStatus, {
          capsuleId: args.capsuleId,
          status: "failed",
          errorMessage: result.error || "Generation failed",
        });
        
        return { generationId, success: false };
      }
      
      // Persist the generated content
      console.log(`[V2 Generation] Persisting ${result.capsule.modules.length} modules`);
      
      // Update capsule metadata
      await ctx.runMutation(api.capsules.updateCapsuleMetadata, {
        capsuleId: args.capsuleId,
        description: result.capsule.description,
      });
      
      // Persist modules and lessons
      const { moduleCount } = await ctx.runMutation(
        api.capsules.persistGeneratedCapsuleContent,
        {
          capsuleId: args.capsuleId,
          modules: result.capsule.modules.map((mod) => ({
            title: mod.title,
            description: mod.description,
            lessons: mod.lessons.map((lesson) => ({
              title: lesson.title,
              lessonType: lesson.type,
              content: lesson.content,
            })),
          })),
        }
      );
      
      // Clear source data
      await ctx.runMutation(api.capsules.clearCapsuleSourceData, {
        capsuleId: args.capsuleId,
      });
      
      // Update final status
      await ctx.runMutation(api.capsules.updateCapsuleStatus, {
        capsuleId: args.capsuleId,
        status: "completed",
        moduleCount,
      });
      
      // Update job as completed
      await ctx.runMutation(api.capsulesV2.updateGenerationJob, {
        generationId,
        state: "completed",
        completedAt: Date.now(),
      });
      
      console.log(`[V2 Generation] Completed successfully`);
      return { generationId, success: true };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[V2 Generation] Failed:`, error);
      
      // Update job with error
      await ctx.runMutation(api.capsulesV2.updateGenerationJob, {
        generationId,
        state: "failed",
        lastError: errorMessage,
      });
      
      // Update capsule status
      await ctx.runMutation(api.capsules.updateCapsuleStatus, {
        capsuleId: args.capsuleId,
        status: "failed",
        errorMessage,
      });
      
      return { generationId, success: false };
    }
  },
});
