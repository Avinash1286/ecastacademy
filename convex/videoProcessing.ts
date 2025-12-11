import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, query, mutation } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { generateNotes, generateQuiz } from "@shared/ai/generation";
import { validateAndCorrectJson } from "@shared/ai/structuredValidation";
import {
  generatedQuizSchema,
  generatedQuizSchemaDescription,
  interactiveNotesSchema,
  interactiveNotesSchemaDescription,
} from "@/lib/validators/generatedContentSchemas";

const RATE_LIMIT_DELAY = 15000; // 15 seconds between videos to avoid AI provider rate limits

// Helper to check if notes/quiz content is valid (not undefined, null, or empty object)
function hasValidNotes(notes: unknown): boolean {
  if (!notes) return false;
  if (typeof notes !== 'object') return false;
  // Check if it's an empty object {}
  if (Object.keys(notes as object).length === 0) return false;
  // Check if it has required sections property
  return 'sections' in (notes as object);
}

function hasValidQuiz(quiz: unknown): boolean {
  if (!quiz) return false;
  if (typeof quiz !== 'object') return false;
  // Check if it's an empty object {}
  if (Object.keys(quiz as object).length === 0) return false;
  // Check if it has required questions property
  return 'questions' in (quiz as object);
}

// Action to process multiple videos sequentially (one at a time)
export const processVideosSequentially = action({
  args: {
    videoIds: v.array(v.id("videos")),
  },
  handler: async (ctx, args) => {
    // Schedule the first video to process immediately
    // The internal action will handle scheduling the next ones
    await ctx.scheduler.runAfter(0, internal.videoProcessing.processVideoSequentialInternal, {
      videoIds: args.videoIds,
      currentIndex: 0,
    });

    return { success: true, message: `Sequential processing started for ${args.videoIds.length} video(s)` };
  },
});

// Internal action to process videos one by one
export const processVideoSequentialInternal = internalAction({
  args: {
    videoIds: v.array(v.id("videos")),
    currentIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const { videoIds, currentIndex } = args;

    // Check if we've processed all videos
    if (currentIndex >= videoIds.length) {
      console.log("All videos processed successfully!");
      return { success: true, message: "All videos processed" };
    }

    const videoId = videoIds[currentIndex];

    try {
      // Process this video
      await ctx.runAction(internal.videoProcessing.processVideoInternal, {
        videoId,
      });

      console.log(`Video ${currentIndex + 1}/${videoIds.length} processed successfully`);
    } catch (error) {
      console.error(`Failed to process video ${currentIndex + 1}/${videoIds.length}:`, error);
      // Continue to next video even if this one failed
    }

    // Schedule the next video with a delay to respect rate limits
    const nextIndex = currentIndex + 1;
    if (nextIndex < videoIds.length) {
      await ctx.scheduler.runAfter(
        RATE_LIMIT_DELAY,
        internal.videoProcessing.processVideoSequentialInternal,
        {
          videoIds,
          currentIndex: nextIndex,
        }
      );
    }

    return { success: true, currentIndex, total: videoIds.length };
  },
});

// Action to initiate video processing (legacy - for single video)
export const processVideo = action({
  args: {
    videoId: v.id("videos"),
  },
  handler: async (ctx, args) => {
    // Schedule the background job
    await ctx.scheduler.runAfter(0, internal.videoProcessing.processVideoInternal, {
      videoId: args.videoId,
    });

    return { success: true, message: "Video processing started" };
  },
});

// Internal action that does the actual processing
// This now only generates notes, then schedules quiz generation
export const processVideoInternal = internalAction({
  args: {
    videoId: v.id("videos"),
    generateNotes: v.optional(v.boolean()), // Whether to generate notes (default: true if missing)
    generateQuiz: v.optional(v.boolean()),  // Whether to generate quiz (default: true if missing)
  },
  handler: async (ctx, args) => {
    try {
      // Update status to processing
      await ctx.runMutation(internal.videoProcessing.updateVideoStatus, {
        videoId: args.videoId,
        status: "processing",
      });

      // Get video data
      const video = await ctx.runQuery(internal.videoProcessing.getVideo, {
        videoId: args.videoId,
      });

      if (!video) {
        throw new Error("Video not found");
      }

      // Determine what needs to be generated (check for empty objects as well)
      const needsNotes = args.generateNotes !== false && !hasValidNotes(video.notes);
      const needsQuiz = args.generateQuiz !== false && !hasValidQuiz(video.quiz);

      console.log(`[Video ${args.videoId}] needsNotes: ${needsNotes}, needsQuiz: ${needsQuiz}, existingNotes: ${hasValidNotes(video.notes)}, existingQuiz: ${hasValidQuiz(video.quiz)}`);

      // If nothing needs to be generated, mark as completed
      if (!needsNotes && !needsQuiz) {
        await ctx.runMutation(internal.videoProcessing.updateVideoStatus, {
          videoId: args.videoId,
          status: "completed",
        });
        return { success: true, message: "Nothing to generate - notes and quiz already exist" };
      }

      const rawTranscript = typeof video.transcript === "string" ? video.transcript : "";
      if (!rawTranscript) {
        throw new Error("Transcript missing for video. Unable to generate notes.");
      }

      // Fetch AI Configs - These MUST be configured in admin panel
      const notesConfig = await ctx.runQuery(api.aiConfig.getFeatureModel, {
        featureKey: "notes_generation",
      });

      const quizConfig = await ctx.runQuery(api.aiConfig.getFeatureModel, {
        featureKey: "quiz_generation",
      });

      // Validate that AI models are configured - no fallbacks allowed
      if (needsNotes && !notesConfig) {
        throw new Error("AI model for notes generation is not configured. Please configure it in the admin panel.");
      }
      
      if (needsQuiz && !quizConfig) {
        throw new Error("AI model for quiz generation is not configured. Please configure it in the admin panel.");
      }

      let notes = video.notes;

      // Generate notes if needed
      if (needsNotes) {
        const notesModelConfig = {
          provider: notesConfig!.provider,
          modelId: notesConfig!.modelId,
        };

        let notesJson = await generateNotes(rawTranscript, {
          videoTitle: video.title,
          modelConfig: notesModelConfig
        });

        notesJson = await validateAndCorrectJson(notesJson, {
          schema: interactiveNotesSchema,
          schemaName: "InteractiveNotes",
          schemaDescription: interactiveNotesSchemaDescription,
          originalInput: rawTranscript,
          format: "interactive-notes",
          modelConfig: notesModelConfig,
        });
        notes = JSON.parse(notesJson);

        // Save notes immediately to database
        await ctx.runMutation(internal.videoProcessing.updateVideoNotes, {
          videoId: args.videoId,
          notes,
        });

        console.log(`[Video ${args.videoId}] Notes generated and saved successfully`);
      }

      // If quiz needs to be generated, schedule it as a separate job
      if (needsQuiz && notes) {
        // Schedule quiz generation with a small delay to avoid rate limits
        await ctx.scheduler.runAfter(2000, internal.videoProcessing.processVideoQuizInternal, {
          videoId: args.videoId,
        });
        
        console.log(`[Video ${args.videoId}] Quiz generation scheduled`);
        return { success: true, message: "Notes completed, quiz generation scheduled" };
      } else if (needsQuiz && !notes) {
        throw new Error("Cannot generate quiz without notes. Notes generation may have failed.");
      }

      // If we only needed notes (quiz already existed), mark as completed
      await ctx.runMutation(internal.videoProcessing.updateVideoStatus, {
        videoId: args.videoId,
        status: "completed",
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // Check if it's a rate limit error
      if (errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
        console.error("Rate limit exceeded. Scheduling automatic retry in 60 seconds.");
        // Set to pending and schedule retry
        await ctx.runMutation(internal.videoProcessing.updateVideoStatus, {
          videoId: args.videoId,
          status: "pending",
          errorMessage: "Rate limit exceeded. Will retry automatically.",
        });
        // Schedule automatic retry after 60 seconds
        await ctx.scheduler.runAfter(60000, internal.videoProcessing.processVideoInternal, {
          videoId: args.videoId,
        });
      } else {
        // For other errors, mark as failed
        await ctx.runMutation(internal.videoProcessing.updateVideoStatus, {
          videoId: args.videoId,
          status: "failed",
          errorMessage,
        });
      }

      return { success: false, error: errorMessage };
    }
  },
});

// Internal action to generate quiz (called after notes are saved)
export const processVideoQuizInternal = internalAction({
  args: {
    videoId: v.id("videos"),
  },
  handler: async (ctx, args) => {
    try {
      // Get video data with notes
      const video = await ctx.runQuery(internal.videoProcessing.getVideo, {
        videoId: args.videoId,
      });

      if (!video) {
        throw new Error("Video not found");
      }

      if (!hasValidNotes(video.notes)) {
        throw new Error("Notes not found. Cannot generate quiz without notes.");
      }

      // If quiz already exists, just mark as completed
      if (hasValidQuiz(video.quiz)) {
        await ctx.runMutation(internal.videoProcessing.updateVideoStatus, {
          videoId: args.videoId,
          status: "completed",
        });
        return { success: true, message: "Quiz already exists" };
      }

      // Fetch quiz AI Config
      const quizConfig = await ctx.runQuery(api.aiConfig.getFeatureModel, {
        featureKey: "quiz_generation",
      });

      if (!quizConfig) {
        throw new Error("AI model for quiz generation is not configured. Please configure it in the admin panel.");
      }

      const quizModelConfig = {
        provider: quizConfig.provider,
        modelId: quizConfig.modelId,
      };

      const notesContext = JSON.stringify(video.notes);
      let quizJson = await generateQuiz(notesContext, quizModelConfig);

      quizJson = await validateAndCorrectJson(quizJson, {
        schema: generatedQuizSchema,
        schemaName: "InteractiveQuiz",
        schemaDescription: generatedQuizSchemaDescription,
        originalInput: notesContext,
        format: "interactive-quiz",
        modelConfig: quizModelConfig,
      });
      const quiz = JSON.parse(quizJson);

      // Update video with quiz and mark as completed
      await ctx.runMutation(internal.videoProcessing.updateVideoQuiz, {
        videoId: args.videoId,
        quiz,
        status: "completed",
      });

      console.log(`[Video ${args.videoId}] Quiz generated and saved. Video processing completed.`);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // Check if it's a rate limit error
      if (errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
        console.error("Rate limit exceeded during quiz generation. Scheduling retry in 60 seconds.");
        // Keep in processing state, schedule retry
        await ctx.runMutation(internal.videoProcessing.updateVideoStatus, {
          videoId: args.videoId,
          status: "processing",
          errorMessage: "Quiz generation rate limited. Will retry.",
        });
        // Schedule automatic retry after 60 seconds
        await ctx.scheduler.runAfter(60000, internal.videoProcessing.processVideoQuizInternal, {
          videoId: args.videoId,
        });
      } else {
        // For other errors, mark as failed but keep notes
        await ctx.runMutation(internal.videoProcessing.updateVideoStatus, {
          videoId: args.videoId,
          status: "failed",
          errorMessage: `Quiz generation failed: ${errorMessage}`,
        });
      }

      return { success: false, error: errorMessage };
    }
  },
});

// Internal mutation to update video status
export const updateVideoStatus = internalMutation({
  args: {
    videoId: v.id("videos"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updateData: Record<string, unknown> = {
      status: args.status,
      errorMessage: args.errorMessage,
      updatedAt: Date.now(),
    };
    
    // Track when processing started for timeout detection
    if (args.status === "processing") {
      updateData.processingStartedAt = Date.now();
    } else {
      // Clear processing start time when not processing
      updateData.processingStartedAt = undefined;
    }
    
    await ctx.db.patch(args.videoId, updateData);
  },
});

// Internal mutation to update video with generated content
export const updateVideoContent = internalMutation({
  args: {
    videoId: v.id("videos"),
    notes: v.any(),
    quiz: v.any(),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.videoId, {
      notes: args.notes,
      quiz: args.quiz,
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

// Internal mutation to update video notes only (keeps status as processing for quiz to follow)
export const updateVideoNotes = internalMutation({
  args: {
    videoId: v.id("videos"),
    notes: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.videoId, {
      notes: args.notes,
      updatedAt: Date.now(),
    });
  },
});

// Internal mutation to update video quiz and mark as completed
export const updateVideoQuiz = internalMutation({
  args: {
    videoId: v.id("videos"),
    quiz: v.any(),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.videoId, {
      quiz: args.quiz,
      status: args.status,
      errorMessage: undefined, // Clear any error message on successful quiz generation
      updatedAt: Date.now(),
    });
  },
});

// Internal query to get video  
export const getVideo = internalQuery({
  args: {
    videoId: v.id("videos"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.videoId);
  },
});

// Public query to get videos by status
export const getVideosByStatus = query({
  args: {
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    )),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("videos")
        .withIndex("by_status", (q) => q.eq("status", args.status))
        .collect();
    }
    // Return all videos if no status filter
    return await ctx.db.query("videos").collect();
  },
});

// Query to get all videos
export const getAllVideos = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("videos").order("desc").collect();
  },
});

// Helper to strip heavy fields from video documents for listing
function toVideoListItem(video: Doc<"videos">) {
  // Exclude notes, quiz, and transcript to reduce bandwidth
  const { notes, quiz, transcript, ...lightVideo } = video;
  return lightVideo;
}

// Query to get videos with cursor-based pagination
// Returns { videos, nextCursor, hasMore } for efficient pagination
// OPTIMIZED: Excludes notes, quiz, and transcript fields to reduce bandwidth
export const getVideosPaginated = query({
  args: {
    limit: v.number(),
    cursor: v.optional(v.string()), // Cursor is the _id of the last item
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    )),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit, 100); // Cap at 100 for performance
    
    let paginatedVideos: Doc<"videos">[] = [];
    let hasMore = false;
    let nextCursor: string | null = null;
    
    if (args.cursor) {
      // Cursor-based: Fetch videos after the cursor
      const cursorVideo = await ctx.db.get(args.cursor as Id<"videos">);
      
      if (cursorVideo) {
        // Get videos created before the cursor (since we order desc)
        let queryBuilder = ctx.db
          .query("videos")
          .order("desc")
          .filter((q) => 
            args.status 
              ? q.and(
                  q.eq(q.field("status"), args.status),
                  q.lt(q.field("_creationTime"), cursorVideo._creationTime)
                )
              : q.lt(q.field("_creationTime"), cursorVideo._creationTime)
          );
        
        const videos = await queryBuilder.take(limit + 1);
        
        hasMore = videos.length > limit;
        paginatedVideos = hasMore ? videos.slice(0, limit) : videos;
        nextCursor = hasMore && paginatedVideos.length > 0 
          ? paginatedVideos[paginatedVideos.length - 1]._id 
          : null;
      }
    } else {
      // First page - no cursor
      let queryBuilder = ctx.db
        .query("videos")
        .order("desc");
      
      if (args.status) {
        queryBuilder = queryBuilder.filter((q) => q.eq(q.field("status"), args.status));
      }
      
      const videos = await queryBuilder.take(limit + 1);
      
      hasMore = videos.length > limit;
      paginatedVideos = hasMore ? videos.slice(0, limit) : videos;
      nextCursor = hasMore && paginatedVideos.length > 0 
        ? paginatedVideos[paginatedVideos.length - 1]._id 
        : null;
    }
    
    // Return lightweight video objects without notes, quiz, transcript
    return { 
      videos: paginatedVideos.map(toVideoListItem), 
      nextCursor, 
      hasMore 
    };
  },
});

// Public mutation to retry failed video processing
// Smart retry: only regenerates what's missing (notes, quiz, or both)
export const retryFailedVideo = mutation({
  args: {
    videoId: v.id("videos"),
    forceRegenerateAll: v.optional(v.boolean()), // If true, regenerate both notes and quiz
  },
  handler: async (ctx, args) => {
    const video = await ctx.db.get(args.videoId);

    if (!video) {
      throw new Error("Video not found");
    }

    if (video.status !== "failed" && video.status !== "completed") {
      throw new Error("Can only retry failed or completed videos");
    }

    // Determine what needs to be regenerated (use helper to check for empty objects)
    const hasNotes = hasValidNotes(video.notes);
    const hasQuiz = hasValidQuiz(video.quiz);
    const forceAll = args.forceRegenerateAll === true;

    console.log(`[retryFailedVideo ${args.videoId}] hasNotes: ${hasNotes}, hasQuiz: ${hasQuiz}, forceAll: ${forceAll}`);

    // If force regenerate, clear existing content
    if (forceAll) {
      await ctx.db.patch(args.videoId, {
        notes: undefined,
        quiz: undefined,
        status: "pending",
        errorMessage: undefined,
        updatedAt: Date.now(),
      });
      
      // Trigger full processing
      await ctx.scheduler.runAfter(0, internal.videoProcessing.processVideoInternal, {
        videoId: args.videoId,
        generateNotes: true,
        generateQuiz: true,
      });
      
      return { success: true, message: "Regenerating both notes and quiz" };
    }

    // Smart retry based on what's missing
    if (!hasNotes && !hasQuiz) {
      // Neither exists - generate both
      await ctx.db.patch(args.videoId, {
        status: "pending",
        errorMessage: undefined,
        updatedAt: Date.now(),
      });
      
      await ctx.scheduler.runAfter(0, internal.videoProcessing.processVideoInternal, {
        videoId: args.videoId,
        generateNotes: true,
        generateQuiz: true,
      });
      
      return { success: true, message: "Generating notes and quiz" };
    } else if (hasNotes && !hasQuiz) {
      // Only quiz is missing - generate quiz only
      await ctx.db.patch(args.videoId, {
        status: "processing",
        errorMessage: undefined,
        updatedAt: Date.now(),
      });
      
      await ctx.scheduler.runAfter(0, internal.videoProcessing.processVideoQuizInternal, {
        videoId: args.videoId,
      });
      
      return { success: true, message: "Generating quiz only (notes already exist)" };
    } else if (!hasNotes && hasQuiz) {
      // Only notes is missing (rare case) - regenerate notes, keep quiz
      await ctx.db.patch(args.videoId, {
        status: "pending",
        errorMessage: undefined,
        updatedAt: Date.now(),
      });
      
      await ctx.scheduler.runAfter(0, internal.videoProcessing.processVideoInternal, {
        videoId: args.videoId,
        generateNotes: true,
        generateQuiz: false, // Don't regenerate quiz
      });
      
      return { success: true, message: "Generating notes only (quiz already exists)" };
    } else {
      // Both exist - nothing to do, just mark as completed
      await ctx.db.patch(args.videoId, {
        status: "completed",
        errorMessage: undefined,
        updatedAt: Date.now(),
      });
      
      return { success: true, message: "Both notes and quiz already exist, marked as completed" };
    }
  },
});

// Timeout threshold: 10 minutes (slightly more than Convex's 600s limit)
const PROCESSING_TIMEOUT_MS = 10 * 60 * 1000;

// Query to find videos stuck in processing state (timed out)
export const getStuckProcessingVideos = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cutoffTime = now - PROCESSING_TIMEOUT_MS;
    
    // Get all videos in processing state
    const processingVideos = await ctx.db
      .query("videos")
      .withIndex("by_status", (q) => q.eq("status", "processing"))
      .collect();
    
    // Filter to only those that have been processing for too long
    return processingVideos.filter((video) => {
      // If no processingStartedAt, check updatedAt as fallback
      const startTime = video.processingStartedAt || video.updatedAt || video.createdAt;
      return startTime < cutoffTime;
    });
  },
});

// Mutation to mark stuck videos as failed
export const markStuckVideosAsFailed = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cutoffTime = now - PROCESSING_TIMEOUT_MS;
    
    // Get all videos in processing state
    const processingVideos = await ctx.db
      .query("videos")
      .withIndex("by_status", (q) => q.eq("status", "processing"))
      .collect();
    
    let markedCount = 0;
    
    for (const video of processingVideos) {
      const startTime = video.processingStartedAt || video.updatedAt || video.createdAt;
      
      if (startTime < cutoffTime) {
        await ctx.db.patch(video._id, {
          status: "failed",
          errorMessage: "Processing timed out. Please retry.",
          updatedAt: now,
          processingStartedAt: undefined,
        });
        markedCount++;
        console.log(`Marked video ${video._id} (${video.title}) as failed due to timeout`);
      }
    }
    
    return { 
      success: true, 
      markedCount,
      message: markedCount > 0 
        ? `Marked ${markedCount} stuck video(s) as failed` 
        : "No stuck videos found"
    };
  },
});

// Internal mutation to be called by a scheduled job (cron)
export const cleanupStuckVideos = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cutoffTime = now - PROCESSING_TIMEOUT_MS;
    
    const processingVideos = await ctx.db
      .query("videos")
      .withIndex("by_status", (q) => q.eq("status", "processing"))
      .collect();
    
    let markedCount = 0;
    
    for (const video of processingVideos) {
      const startTime = video.processingStartedAt || video.updatedAt || video.createdAt;
      
      if (startTime < cutoffTime) {
        await ctx.db.patch(video._id, {
          status: "failed",
          errorMessage: "Processing timed out. Please retry.",
          updatedAt: now,
          processingStartedAt: undefined,
        });
        markedCount++;
        console.log(`[Cleanup] Marked video ${video._id} as failed due to timeout`);
      }
    }
    
    if (markedCount > 0) {
      console.log(`[Cleanup] Marked ${markedCount} stuck video(s) as failed`);
    }
    
    return { markedCount };
  },
});
