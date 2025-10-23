import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Mutation to create a new chapter
export const createChapter = mutation({
  args: {
    name: v.string(),
    order: v.number(),
    courseId: v.id("courses"),
    videoId: v.optional(v.id("videos")), // Optional for backward compatibility
  },
  handler: async (ctx, args) => {
    const chapterId = await ctx.db.insert("chapters", {
      ...args,
      createdAt: Date.now(),
    });
    return chapterId;
  },
});

// Query to get a chapter by ID
export const getChapter = query({
  args: {
    id: v.id("chapters"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Query to get chapters by course ID
export const getChaptersByCourseId = query({
  args: {
    courseId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
      .collect();
    
    // Sort by order
    chapters.sort((a, b) => a.order - b.order);
    return chapters;
  },
});

// Query to get chapters with content items by course ID
export const getChaptersByCourse = query({
  args: {
    courseId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
      .collect();
    
    // Sort by order
    chapters.sort((a, b) => a.order - b.order);
    
    // Get content items for each chapter
    const chaptersWithContent = await Promise.all(
      chapters.map(async (chapter) => {
        const contentItems = await ctx.db
          .query("contentItems")
          .withIndex("by_chapterId", (q) => q.eq("chapterId", chapter._id))
          .collect();
        
        // Sort content items by order
        contentItems.sort((a, b) => a.order - b.order);
        
        // Enrich video content items with video details
        const enrichedContentItems = await Promise.all(
          contentItems.map(async (item) => {
            if (item.type === "video" && item.videoId) {
              const video = await ctx.db.get(item.videoId);
              return { ...item, video };
            }
            return item;
          })
        );
        
        return {
          ...chapter,
          contentItems: enrichedContentItems,
        };
      })
    );
    
    return chaptersWithContent;
  },
});

// Mutation to update a chapter
export const updateChapter = mutation({
  args: {
    id: v.id("chapters"),
    name: v.optional(v.string()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    return await ctx.db.get(id);
  },
});

// Mutation to delete a chapter
export const deleteChapter = mutation({
  args: {
    id: v.id("chapters"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { id: args.id };
  },
});

// Query to get a chapter with full details (course and video info)
export const getChapterWithDetails = query({
  args: {
    id: v.id("chapters"),
  },
  handler: async (ctx, args) => {
    const chapter = await ctx.db.get(args.id);
    if (!chapter) return null;
    
    const course = await ctx.db.get(chapter.courseId);
    
    let video = null;
    // First, check if chapter has direct videoId (old system)
    if (chapter.videoId) {
      video = await ctx.db.get(chapter.videoId);
    } 
    // If no direct videoId, check for video content items (new system)
    else {
      const contentItems = await ctx.db
        .query("contentItems")
        .withIndex("by_chapterId", (q) => q.eq("chapterId", args.id))
        .collect();
      
      // Find the first video-type content item
      const videoContent = contentItems.find(item => item.type === "video" && item.videoId);
      if (videoContent && videoContent.videoId) {
        video = await ctx.db.get(videoContent.videoId);
      }
    }
    
    return {
      id: chapter._id,
      name: chapter.name,
      order: chapter.order,
      course: course ? {
        id: course._id,
        name: course.name,
        description: course.description,
      } : null,
      video: video ? {
        videoId: video.youtubeVideoId,
        title: video.title,
        url: video.url,
        thumbnailUrl: video.thumbnailUrl,
        durationInSeconds: video.durationInSeconds,
        notes: video.notes,
        quiz: video.quiz,
        transcript: video.transcript,
      } : null,
    };
  },
});

// SCHEMA V2: Create chapter with title and description
export const createChapterV2 = mutation({
  args: {
    courseId: v.id("courses"),
    title: v.string(),
    description: v.optional(v.string()),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    const chapterId = await ctx.db.insert("chapters", {
      courseId: args.courseId,
      name: args.title, // Map title to name for backward compatibility
      order: args.order,
      videoId: undefined, // videoId is now optional in schema v2
      createdAt: Date.now(),
    });
    return chapterId;
  },
});

// SCHEMA V2: Update chapter
export const updateChapterV2 = mutation({
  args: {
    chapterId: v.id("chapters"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { chapterId, title, description, order } = args;
    const updates: Record<string, string | number> = {};
    
    if (title) {
      updates.name = title; // Map title to name for backward compatibility
    }
    if (description) {
      updates.description = description;
    }
    if (order !== undefined) {
      updates.order = order;
    }
    
    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(chapterId, updates);
    }
    return await ctx.db.get(chapterId);
  },
});

// SCHEMA V2: Delete chapter
export const deleteChapterV2 = mutation({
  args: {
    chapterId: v.id("chapters"),
  },
  handler: async (ctx, args) => {
    // First delete all content items for this chapter
    const contentItems = await ctx.db
      .query("contentItems")
      .withIndex("by_chapterId", (q) => q.eq("chapterId", args.chapterId))
      .collect();
    
    for (const item of contentItems) {
      await ctx.db.delete(item._id);
    }
    
    // Then delete the chapter
    await ctx.db.delete(args.chapterId);
    return { chapterId: args.chapterId };
  },
});

// SCHEMA V2: Reorder chapters
export const reorderChapters = mutation({
  args: {
    updates: v.array(
      v.object({
        chapterId: v.id("chapters"),
        order: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const update of args.updates) {
      await ctx.db.patch(update.chapterId, { order: update.order });
    }
    return { success: true };
  },
});
