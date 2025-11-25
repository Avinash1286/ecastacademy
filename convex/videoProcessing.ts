import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, query, mutation } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { generateNotes, generateQuiz } from "@shared/ai/generation";
import { validateAndCorrectJson } from "@shared/ai/structuredValidation";
import {
  generatedQuizSchema,
  generatedQuizSchemaDescription,
  interactiveNotesSchema,
  interactiveNotesSchemaDescription,
} from "@/lib/validators/generatedContentSchemas";

const RATE_LIMIT_DELAY = 5000; // 5 seconds between videos

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
export const processVideoInternal = internalAction({
  args: {
    videoId: v.id("videos"),
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

      const rawTranscript = typeof video.transcript === "string" ? video.transcript : "";
      if (!rawTranscript) {
        throw new Error("Transcript missing for video. Unable to generate notes.");
      }

      // Fetch AI Configs
      const notesConfig = await ctx.runQuery(api.aiConfig.getFeatureModel, {
        featureKey: "notes_generation",
      });

      const quizConfig = await ctx.runQuery(api.aiConfig.getFeatureModel, {
        featureKey: "quiz_generation",
      });

      const notesModelConfig = notesConfig ? {
        provider: notesConfig.provider,
        modelId: notesConfig.modelId,
      } : undefined;

      const quizModelConfig = quizConfig ? {
        provider: quizConfig.provider,
        modelId: quizConfig.modelId,
      } : undefined;

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
      });
      const notes = JSON.parse(notesJson);

      // Wait 5 seconds before making the next API call to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 5000));

      const notesContext = JSON.stringify(notes);
      let quizJson = await generateQuiz(notesContext, quizModelConfig);

      quizJson = await validateAndCorrectJson(quizJson, {
        schema: generatedQuizSchema,
        schemaName: "InteractiveQuiz",
        schemaDescription: generatedQuizSchemaDescription,
        originalInput: notesContext,
        format: "interactive-quiz",
      });
      const quiz = JSON.parse(quizJson);

      // Update video with generated content
      await ctx.runMutation(internal.videoProcessing.updateVideoContent, {
        videoId: args.videoId,
        notes,
        quiz,
        status: "completed",
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // Check if it's a rate limit error
      if (errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
        console.error("Rate limit exceeded. Video will remain in processing state.");
        // Don't mark as failed for rate limit errors - it will be retried
        await ctx.runMutation(internal.videoProcessing.updateVideoStatus, {
          videoId: args.videoId,
          status: "pending",
          errorMessage: "Rate limit exceeded. Will retry automatically.",
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
    await ctx.db.patch(args.videoId, {
      status: args.status,
      errorMessage: args.errorMessage,
      updatedAt: Date.now(),
    });
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

// Public mutation to retry failed video processing
export const retryFailedVideo = mutation({
  args: {
    videoId: v.id("videos"),
  },
  handler: async (ctx, args) => {
    const video = await ctx.db.get(args.videoId);

    if (!video) {
      throw new Error("Video not found");
    }

    if (video.status !== "failed" && video.status !== "completed") {
      throw new Error("Can only retry failed or completed videos");
    }

    // Reset status to pending
    await ctx.db.patch(args.videoId, {
      status: "pending",
      errorMessage: undefined,
      updatedAt: Date.now(),
    });

    // Trigger processing for this single video
    await ctx.scheduler.runAfter(0, internal.videoProcessing.processVideoInternal, {
      videoId: args.videoId,
    });

    return { success: true };
  },
});
