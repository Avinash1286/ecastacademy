import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent";

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

      const geminiApiKey = process.env.GEMINI_API_KEY;

      if (!geminiApiKey) {
        throw new Error("GEMINI_API_KEY not configured. Please set it in Convex environment variables.");
      }

      // Notes generation prompt
      const notesPrompt = `You are an expert educator creating comprehensive, interactive study notes. Generate detailed notes for the provided youtube transcript.

Structure your response as a JSON object with this exact format:
{
  "topic": "Topic Name",
  "sections": [
    {
      "title": "Section Title",
      "content": "Detailed explanation in paragraph form",
      "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
      "examples": ["Example 1", "Example 2"],
      "callouts": [],
      "codeBlocks": [],
      "highlights": [],
      "definitions": [],
      "quiz": []
    }
  ]
}

Video Title: ${video.title}

Transcript:
${video.transcript}

Respond ONLY with valid JSON - no other text or markdown formatting.`;

      // Generate notes using Gemini API directly
      const notesResponse = await fetch(`${GEMINI_API_URL}?key=${geminiApiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: notesPrompt }]
          }]
        }),
      });

      if (!notesResponse.ok) {
        const errorText = await notesResponse.text();
        throw new Error(`Failed to generate notes: ${notesResponse.status} - ${errorText}`);
      }

      const notesResult = await notesResponse.json();
      const notesText = notesResult.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!notesText) {
        throw new Error("No notes generated from AI");
      }

      // Parse the JSON response (remove markdown code blocks if present)
      const cleanNotesText = notesText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const notes = JSON.parse(cleanNotesText);

      // Wait 5 seconds before making the next API call to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Quiz generation prompt
      const quizPrompt = `Generate a quiz about the provided content with 5-8 multiple-choice questions. 
Format the response as a JSON object with this exact structure:
{
  "topic": "Topic name",
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "explanation": "Brief explanation of why this is correct"
    }
  ]
}

Make sure:
- Each question has exactly 4 options
- The "correct" field is the index (0-3) of the correct answer
- Questions test understanding of key concepts

Video Title: ${video.title}

Content:
${JSON.stringify(notes)}

Respond ONLY with valid JSON - no other text or markdown formatting.`;

      // Generate quiz using Gemini API
      const quizResponse = await fetch(`${GEMINI_API_URL}?key=${geminiApiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: quizPrompt }]
          }]
        }),
      });

      if (!quizResponse.ok) {
        const errorText = await quizResponse.text();
        throw new Error(`Failed to generate quiz: ${quizResponse.status} - ${errorText}`);
      }

      const quizResult = await quizResponse.json();
      const quizText = quizResult.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!quizText) {
        throw new Error("No quiz generated from AI");
      }

      // Parse the JSON response (remove markdown code blocks if present)
      const cleanQuizText = quizText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const quiz = JSON.parse(cleanQuizText);

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
