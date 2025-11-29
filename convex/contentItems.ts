import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { recalculateCourseProgressSync } from "./completions";
import { requireAuthenticatedUser } from "./utils/auth";
import { validateContentItemFields, validatePositiveNumber } from "./utils/validation";

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

    // Grading fields (optional, will be auto-determined if not provided)
    isGraded: v.optional(v.boolean()),
    maxPoints: v.optional(v.number()),
    passingScore: v.optional(v.number()),
    allowRetakes: v.optional(v.boolean()),

    videoId: v.optional(v.id("videos")),
    textContent: v.optional(v.string()),
    quizData: v.optional(v.any()),
    assignmentData: v.optional(v.any()),
    resourceUrl: v.optional(v.string()),
    resourceTitle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Auth check
    const { user } = await requireAuthenticatedUser(ctx);
    
    // Validate input
    validateContentItemFields({
      title: args.title,
      textContent: args.textContent,
      resourceUrl: args.resourceUrl,
      resourceTitle: args.resourceTitle,
    });
    validatePositiveNumber(args.order, "Order");
    if (args.maxPoints !== undefined) {
      validatePositiveNumber(args.maxPoints, "Max points");
    }
    if (args.passingScore !== undefined) {
      validatePositiveNumber(args.passingScore, "Passing score");
    }
    
    const now = Date.now();

    // Get chapter to find courseId
    const chapter = await ctx.db.get(args.chapterId);
    if (!chapter) {
      throw new Error("Chapter not found");
    }

    // Get course to check if it's a certification course
    const course = await ctx.db.get(chapter.courseId);
    if (!course) {
      throw new Error("Course not found");
    }
    
    // Check if user is admin or course creator
    if (user.role !== "admin" && course.createdBy !== user._id.toString()) {
      throw new Error("Unauthorized: You can only add content to your own courses");
    }

    // Auto-determine grading based on course type and content type
    let isGraded = args.isGraded;

    if (isGraded === undefined) {
      if (course.isCertification) {
        // For certification courses, auto-grade certain types
        if (args.type === "video" && args.videoId) {
          // Check if video has a quiz
          const video = await ctx.db.get(args.videoId);
          isGraded = video?.quiz ? true : false;
        } else if (args.type === "quiz" || args.type === "assignment") {
          isGraded = true; // Quizzes and assignments are graded by default
        } else {
          isGraded = false; // Text and resources are not graded by default
        }
      } else {
        isGraded = false; // Non-certification courses default to non-graded
      }
    }

    const contentItemId = await ctx.db.insert("contentItems", {
      chapterId: args.chapterId,
      type: args.type,
      title: args.title,
      order: args.order,

      // Grading configuration
      isGraded,
      maxPoints: args.maxPoints ?? (isGraded ? 100 : undefined),
      passingScore: args.passingScore ?? (isGraded ? (course.passingGrade ?? 70) : undefined),
      allowRetakes: args.allowRetakes ?? true,

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
    isGraded: v.optional(v.boolean()),
    maxPoints: v.optional(v.number()),
    passingScore: v.optional(v.number()),
    allowRetakes: v.optional(v.boolean()),
    videoId: v.optional(v.id("videos")),
    textContent: v.optional(v.string()),
    quizData: v.optional(v.any()),
    assignmentData: v.optional(v.any()),
    resourceUrl: v.optional(v.string()),
    resourceTitle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Auth check
    const { user } = await requireAuthenticatedUser(ctx);
    
    // Validate input
    validateContentItemFields({
      title: args.title,
      textContent: args.textContent,
      resourceUrl: args.resourceUrl,
      resourceTitle: args.resourceTitle,
    });
    if (args.order !== undefined) {
      validatePositiveNumber(args.order, "Order");
    }
    if (args.maxPoints !== undefined) {
      validatePositiveNumber(args.maxPoints, "Max points");
    }
    if (args.passingScore !== undefined) {
      validatePositiveNumber(args.passingScore, "Passing score");
    }
    
    // Get content item and verify ownership
    const contentItem = await ctx.db.get(args.id);
    if (!contentItem) {
      throw new Error("Content item not found");
    }
    
    const chapter = await ctx.db.get(contentItem.chapterId);
    if (!chapter) {
      throw new Error("Chapter not found");
    }
    
    const course = await ctx.db.get(chapter.courseId);
    if (!course) {
      throw new Error("Course not found");
    }
    
    // Check if user is admin or course creator
    if (user.role !== "admin" && course.createdBy !== user._id.toString()) {
      throw new Error("Unauthorized: You can only update content in your own courses");
    }
    
    const { id, ...updates } = args;

    await ctx.db.patch(id, updates);
    return await ctx.db.get(id);
  },
});

// Toggle grading for a content item
export const toggleContentItemGrading = mutation({
  args: {
    contentItemId: v.id("contentItems"),
    isGraded: v.boolean(),
    maxPoints: v.optional(v.number()),
    passingScore: v.optional(v.number()),
    allowRetakes: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Auth check
    const { user } = await requireAuthenticatedUser(ctx);
    
    // Validate input
    if (args.maxPoints !== undefined) {
      validatePositiveNumber(args.maxPoints, "Max points");
    }
    if (args.passingScore !== undefined) {
      validatePositiveNumber(args.passingScore, "Passing score");
    }
    
    const contentItem = await ctx.db.get(args.contentItemId);
    if (!contentItem) {
      throw new Error("Content item not found");
    }

    // Get chapter and course for default values
    const chapter = await ctx.db.get(contentItem.chapterId);
    if (!chapter) {
      throw new Error("Chapter not found");
    }

    const course = await ctx.db.get(chapter.courseId);
    if (!course) {
      throw new Error("Course not found");
    }
    
    // Check if user is admin or course creator
    if (user.role !== "admin" && course.createdBy !== user._id.toString()) {
      throw new Error("Unauthorized: You can only modify content in your own courses");
    }

    await ctx.db.patch(args.contentItemId, {
      isGraded: args.isGraded,
      maxPoints: args.maxPoints ?? (args.isGraded ? 100 : undefined),
      passingScore: args.passingScore ?? (args.isGraded ? (course.passingGrade ?? 70) : undefined),
      allowRetakes: args.allowRetakes ?? true,
    });

    await recalculateCourseProgressSync(ctx, { courseId: chapter.courseId });

    return await ctx.db.get(args.contentItemId);
  },
});

// Delete a content item
export const deleteContentItem = mutation({
  args: {
    id: v.id("contentItems"),
  },
  handler: async (ctx, args) => {
    // Auth check
    const { user } = await requireAuthenticatedUser(ctx);
    
    // Get content item and verify ownership
    const contentItem = await ctx.db.get(args.id);
    if (!contentItem) {
      throw new Error("Content item not found");
    }
    
    const chapter = await ctx.db.get(contentItem.chapterId);
    if (!chapter) {
      throw new Error("Chapter not found");
    }
    
    const course = await ctx.db.get(chapter.courseId);
    if (!course) {
      throw new Error("Course not found");
    }
    
    // Check if user is admin or course creator
    if (user.role !== "admin" && course.createdBy !== user._id.toString()) {
      throw new Error("Unauthorized: You can only delete content from your own courses");
    }
    
    // Delete any progress records for this content item
    const progressRecords = await ctx.db
      .query("progress")
      .withIndex("by_userId_contentItemId")
      .filter((q) => q.eq(q.field("contentItemId"), args.id))
      .collect();
    
    for (const record of progressRecords) {
      await ctx.db.delete(record._id);
    }
    
    // Delete any quiz attempts for this content item
    const quizAttempts = await ctx.db
      .query("quizAttempts")
      .withIndex("by_contentItemId", (q) => q.eq("contentItemId", args.id))
      .collect();
    
    for (const attempt of quizAttempts) {
      await ctx.db.delete(attempt._id);
    }
    
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
              hasTranscript: !!(video.transcript && video.transcript.trim().length > 0),
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
    // Auth check
    const { user } = await requireAuthenticatedUser(ctx);
    
    // Validate all updates have positive order numbers
    for (const item of args.items) {
      validatePositiveNumber(item.order, "Order");
    }
    
    // Verify all items belong to courses the user owns
    for (const item of args.items) {
      const contentItem = await ctx.db.get(item.id);
      if (!contentItem) {
        throw new Error(`Content item not found: ${item.id}`);
      }
      
      const chapter = await ctx.db.get(contentItem.chapterId);
      if (!chapter) {
        throw new Error("Chapter not found");
      }
      
      const course = await ctx.db.get(chapter.courseId);
      if (!course) {
        throw new Error("Course not found");
      }
      
      if (user.role !== "admin" && course.createdBy !== user._id.toString()) {
        throw new Error("Unauthorized: You can only reorder content in your own courses");
      }
    }
    
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
    // Auth check
    const { user } = await requireAuthenticatedUser(ctx);
    
    // Get content item and verify ownership
    const contentItem = await ctx.db.get(args.contentItemId);
    if (!contentItem) {
      throw new Error("Content item not found");
    }
    
    const chapter = await ctx.db.get(contentItem.chapterId);
    if (!chapter) {
      throw new Error("Chapter not found");
    }
    
    const course = await ctx.db.get(chapter.courseId);
    if (!course) {
      throw new Error("Course not found");
    }
    
    // Check if user is admin or course creator
    if (user.role !== "admin" && course.createdBy !== user._id.toString()) {
      throw new Error("Unauthorized: You can only update content in your own courses");
    }
    
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

// Get content item with full details (including video transcript)
export const getContentItemWithDetails = query({
  args: {
    id: v.id("contentItems"),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) return null;

    if (item.type === "video" && item.videoId) {
      const video = await ctx.db.get(item.videoId);
      return {
        ...item,
        videoDetails: video ? {
          title: video.title,
          url: video.url,
          thumbnailUrl: video.thumbnailUrl,
          durationInSeconds: video.durationInSeconds,
          status: video.status,
          transcript: video.transcript,
        } : null,
      };
    }

    return item;
  },
});

/**
 * Sync content items' grading status when course certification status changes
 * This should be called after updating a course's isCertification field
 */
export const syncContentItemsGradingStatus = mutation({
  args: {
    courseId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    // Auth check
    const { user } = await requireAuthenticatedUser(ctx);
    
    // Get the course
    const course = await ctx.db.get(args.courseId);
    if (!course) {
      throw new Error("Course not found");
    }
    
    // Check if user is admin or course creator
    if (user.role !== "admin" && course.createdBy !== user._id.toString()) {
      throw new Error("Unauthorized: You can only modify your own courses");
    }

    // Get all chapters for this course
    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
      .collect();

    let updatedCount = 0;

    // For each chapter, update its content items
    for (const chapter of chapters) {
      const contentItems = await ctx.db
        .query("contentItems")
        .withIndex("by_chapterId", (q) => q.eq("chapterId", chapter._id))
        .collect();

      for (const item of contentItems) {
        let shouldBeGraded: boolean;

        if (course.isCertification) {
          // For certification courses, determine grading based on type
          if (item.type === "video" && item.videoId) {
            // Check if video has a quiz
            const video = await ctx.db.get(item.videoId);
            shouldBeGraded = video?.quiz ? true : false;
          } else if (item.type === "quiz" || item.type === "assignment") {
            shouldBeGraded = true;
          } else {
            shouldBeGraded = false;
          }
        } else {
          // Non-certification courses: all items are non-graded
          shouldBeGraded = false;
        }

        // Update if different from current status
        if (item.isGraded !== shouldBeGraded) {
          await ctx.db.patch(item._id, {
            isGraded: shouldBeGraded,
            maxPoints: shouldBeGraded ? (item.maxPoints ?? 100) : undefined,
            passingScore: shouldBeGraded
              ? (item.passingScore ?? course.passingGrade ?? 70)
              : undefined,
          });
          updatedCount++;
        }
      }
    }

    return {
      success: true,
      updatedCount,
      message: `Updated ${updatedCount} content items`,
    };
  },
});
