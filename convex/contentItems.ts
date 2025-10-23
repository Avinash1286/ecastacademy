import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create a content item
export const createContentItem = mutation({
  args: {
    chapterId: v.id("chapters"),
    type: v.union(
      v.literal("video"),
      v.literal("text"),
      v.literal("quiz"),
      v.literal("assignment"),
      v.literal("resource")
    ),
    title: v.string(),
    order: v.number(),
    videoId: v.optional(v.id("videos")),
    textContent: v.optional(v.string()),
    quizData: v.optional(v.any()),
    assignmentData: v.optional(v.any()),
    resourceUrl: v.optional(v.string()),
    resourceTitle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Get chapter to find courseId
    const chapter = await ctx.db.get(args.chapterId);
    if (!chapter) {
      throw new Error("Chapter not found");
    }
    
    const contentItemId = await ctx.db.insert("contentItems", {
      chapterId: args.chapterId,
      type: args.type,
      title: args.title,
      order: args.order,
      videoId: args.videoId,
      textContent: args.textContent,
      quizData: args.quizData,
      assignmentData: args.assignmentData,
      resourceUrl: args.resourceUrl,
      resourceTitle: args.resourceTitle,
      createdAt: now,
    });
    
    return contentItemId;
  },
});

// Update a content item
export const updateContentItem = mutation({
  args: {
    id: v.id("contentItems"),
    title: v.optional(v.string()),
    order: v.optional(v.number()),
    videoId: v.optional(v.id("videos")),
    textContent: v.optional(v.string()),
    quizData: v.optional(v.any()),
    assignmentData: v.optional(v.any()),
    resourceUrl: v.optional(v.string()),
    resourceTitle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    
    await ctx.db.patch(id, updates);
    return await ctx.db.get(id);
  },
});

// Delete a content item
export const deleteContentItem = mutation({
  args: {
    id: v.id("contentItems"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { id: args.id };
  },
});

// Get content items by chapter
export const getContentItemsByChapter = query({
  args: {
    chapterId: v.id("chapters"),
  },
  handler: async (ctx, args) => {
    const contentItems = await ctx.db
      .query("contentItems")
      .withIndex("by_chapterId", (q) => q.eq("chapterId", args.chapterId))
      .collect();
    
    // Sort by order
    contentItems.sort((a, b) => a.order - b.order);
    
    // Enrich video content items with video details
    const enrichedItems = await Promise.all(
      contentItems.map(async (item) => {
        if (item.type === "video" && item.videoId) {
          const video = await ctx.db.get(item.videoId);
          return {
            ...item,
            id: item._id,
            videoDetails: video ? {
              title: video.title,
              url: video.url,
              thumbnailUrl: video.thumbnailUrl,
              durationInSeconds: video.durationInSeconds,
              status: video.status,
            } : null,
          };
        }
        return {
          ...item,
          id: item._id,
        };
      })
    );
    
    return enrichedItems;
  },
});

// Reorder content items
export const reorderContentItems = mutation({
  args: {
    items: v.array(
      v.object({
        id: v.id("contentItems"),
        order: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const item of args.items) {
      await ctx.db.patch(item.id, { order: item.order });
    }
    return { success: true };
  },
});

// Update text quiz status
export const updateTextQuizStatus = mutation({
  args: {
    contentItemId: v.id("contentItems"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    textQuiz: v.optional(v.any()),
    textQuizError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { contentItemId, status, textQuiz, textQuizError } = args;
    
    const updates: {
      textQuizStatus: "pending" | "processing" | "completed" | "failed";
      textQuiz?: unknown;
      textQuizError?: string;
    } = {
      textQuizStatus: status,
    };
    
    if (textQuiz !== undefined) {
      updates.textQuiz = textQuiz;
    }
    
    if (textQuizError !== undefined) {
      updates.textQuizError = textQuizError;
    }
    
    await ctx.db.patch(contentItemId, updates);
    return await ctx.db.get(contentItemId);
  },
});

// Get content item by ID
export const getContentItemById = query({
  args: {
    id: v.id("contentItems"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
