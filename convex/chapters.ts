import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireAuthenticatedUser, requireAdminUser } from "./utils/auth";
import { validateChapterFields, validatePositiveNumber } from "./utils/validation";

// Mutation to create a new chapter
export const createChapter = mutation({
  args: {
    name: v.string(),
    order: v.number(),
    courseId: v.id("courses"),
    videoId: v.optional(v.id("videos")), // Optional for backward compatibility
  },
  handler: async (ctx, args) => {
    // Auth check - must be admin or course creator
    const { user } = await requireAuthenticatedUser(ctx);
    
    // Validate input
    validateChapterFields({ name: args.name });
    validatePositiveNumber(args.order, "Order");
    
    // Verify course exists and user has permission
    const course = await ctx.db.get(args.courseId);
    if (!course) {
      throw new Error("Course not found");
    }
    
    // Check if user is admin or course creator
    if (user.role !== "admin" && course.createdBy !== user._id.toString()) {
      throw new Error("Unauthorized: You can only add chapters to your own courses");
    }
    
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
// OPTIMIZED: Batch loads content items and videos to avoid N+1 queries
export const getChaptersByCourse = query({
  args: {
    courseId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    // 1. Get all chapters
    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
      .collect();
    
    if (chapters.length === 0) return [];
    
    // Sort by order
    chapters.sort((a, b) => a.order - b.order);
    
    // 2. Batch fetch ALL content items for ALL chapters in one query
    const chapterIds = chapters.map(ch => ch._id);
    const allContentItems = await ctx.db
      .query("contentItems")
      .filter((q) => 
        q.or(...chapterIds.map(id => q.eq(q.field("chapterId"), id)))
      )
      .collect();
    
    // Group content items by chapter
    const contentByChapter = new Map<string, typeof allContentItems>();
    for (const item of allContentItems) {
      const key = item.chapterId.toString();
      if (!contentByChapter.has(key)) {
        contentByChapter.set(key, []);
      }
      contentByChapter.get(key)!.push(item);
    }
    
    // 3. Batch fetch ALL videos referenced by content items
    const videoIdsSet = new Set<string>();
    for (const item of allContentItems) {
      if (item.type === "video" && item.videoId) {
        videoIdsSet.add(item.videoId.toString());
      }
    }
    const videoIds = Array.from(videoIdsSet);
    const videos = videoIds.length > 0
      ? await Promise.all(videoIds.map(id => ctx.db.get(id as Id<"videos">)))
      : [];
    
    // Create video lookup map
    const videoMap = new Map(
      videos.filter(Boolean).map(v => [v!._id.toString(), v!])
    );
    
    // 4. Build response (no more database queries!)
    const chaptersWithContent = chapters.map((chapter) => {
      const contentItems = contentByChapter.get(chapter._id.toString()) || [];
      contentItems.sort((a, b) => a.order - b.order);
      
      // Enrich video content items with video details from our map
      const enrichedContentItems = contentItems.map((item) => {
        if (item.type === "video" && item.videoId) {
          const video = videoMap.get(item.videoId.toString()) || null;
          return { ...item, video };
        }
        return item;
      });
      
      return {
        ...chapter,
        contentItems: enrichedContentItems,
      };
    });
    
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
    // Auth check
    const { user } = await requireAuthenticatedUser(ctx);
    
    // Validate input
    validateChapterFields({ name: args.name });
    if (args.order !== undefined) {
      validatePositiveNumber(args.order, "Order");
    }
    
    // Get chapter and verify ownership
    const chapter = await ctx.db.get(args.id);
    if (!chapter) {
      throw new Error("Chapter not found");
    }
    
    const course = await ctx.db.get(chapter.courseId);
    if (!course) {
      throw new Error("Course not found");
    }
    
    // Check if user is admin or course creator
    if (user.role !== "admin" && course.createdBy !== user._id.toString()) {
      throw new Error("Unauthorized: You can only update chapters in your own courses");
    }
    
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
    // Auth check
    const { user } = await requireAuthenticatedUser(ctx);
    
    // Get chapter and verify ownership
    const chapter = await ctx.db.get(args.id);
    if (!chapter) {
      throw new Error("Chapter not found");
    }
    
    const course = await ctx.db.get(chapter.courseId);
    if (!course) {
      throw new Error("Course not found");
    }
    
    // Check if user is admin or course creator
    if (user.role !== "admin" && course.createdBy !== user._id.toString()) {
      throw new Error("Unauthorized: You can only delete chapters from your own courses");
    }
    
    // Delete all content items for this chapter first
    const contentItems = await ctx.db
      .query("contentItems")
      .withIndex("by_chapterId", (q) => q.eq("chapterId", args.id))
      .collect();
    
    for (const item of contentItems) {
      await ctx.db.delete(item._id);
    }
    
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
    // Auth check
    const { user } = await requireAuthenticatedUser(ctx);
    
    // Validate input
    validateChapterFields({ title: args.title, description: args.description });
    validatePositiveNumber(args.order, "Order");
    
    // Verify course exists and user has permission
    const course = await ctx.db.get(args.courseId);
    if (!course) {
      throw new Error("Course not found");
    }
    
    // Check if user is admin or course creator
    if (user.role !== "admin" && course.createdBy !== user._id.toString()) {
      throw new Error("Unauthorized: You can only add chapters to your own courses");
    }
    
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
    // Auth check
    const { user } = await requireAuthenticatedUser(ctx);
    
    // Validate input
    validateChapterFields({ title: args.title, description: args.description });
    if (args.order !== undefined) {
      validatePositiveNumber(args.order, "Order");
    }
    
    // Get chapter and verify ownership
    const chapter = await ctx.db.get(args.chapterId);
    if (!chapter) {
      throw new Error("Chapter not found");
    }
    
    const course = await ctx.db.get(chapter.courseId);
    if (!course) {
      throw new Error("Course not found");
    }
    
    // Check if user is admin or course creator
    if (user.role !== "admin" && course.createdBy !== user._id.toString()) {
      throw new Error("Unauthorized: You can only update chapters in your own courses");
    }
    
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
    // Auth check
    const { user } = await requireAuthenticatedUser(ctx);
    
    // Get chapter and verify ownership
    const chapter = await ctx.db.get(args.chapterId);
    if (!chapter) {
      throw new Error("Chapter not found");
    }
    
    const course = await ctx.db.get(chapter.courseId);
    if (!course) {
      throw new Error("Course not found");
    }
    
    // Check if user is admin or course creator
    if (user.role !== "admin" && course.createdBy !== user._id.toString()) {
      throw new Error("Unauthorized: You can only delete chapters from your own courses");
    }
    
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
    // Auth check
    const { user } = await requireAuthenticatedUser(ctx);
    
    // Validate all updates have positive order numbers
    for (const update of args.updates) {
      validatePositiveNumber(update.order, "Order");
    }
    
    // Verify all chapters belong to courses the user owns
    for (const update of args.updates) {
      const chapter = await ctx.db.get(update.chapterId);
      if (!chapter) {
        throw new Error(`Chapter not found: ${update.chapterId}`);
      }
      
      const course = await ctx.db.get(chapter.courseId);
      if (!course) {
        throw new Error("Course not found");
      }
      
      if (user.role !== "admin" && course.createdBy !== user._id.toString()) {
        throw new Error("Unauthorized: You can only reorder chapters in your own courses");
      }
    }
    
    for (const update of args.updates) {
      await ctx.db.patch(update.chapterId, { order: update.order });
    }
    return { success: true };
  },
});
