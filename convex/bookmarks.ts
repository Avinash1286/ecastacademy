import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthenticatedUser } from "./utils/auth";

// =============================================================================
// Bookmarks - CRUD operations for user bookmarks
// =============================================================================

/**
 * Toggle a course bookmark (add if not exists, remove if exists)
 * SECURITY: Verifies the authenticated user matches the userId parameter
 */
export const toggleCourseBookmark = mutation({
  args: {
    userId: v.id("users"),
    courseId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    const { userId, courseId } = args;

    // SECURITY: Verify the authenticated user matches the userId parameter
    const { user } = await requireAuthenticatedUser(ctx);
    if (user._id !== userId) {
      throw new Error("Unauthorized: You can only manage your own bookmarks");
    }

    // Check if course exists
    const course = await ctx.db.get(courseId);
    if (!course) {
      throw new Error("Course not found");
    }

    const existingBookmark = await ctx.db
      .query("bookmarks")
      .withIndex("by_userId_courseId", (q) =>
        q.eq("userId", userId).eq("courseId", courseId)
      )
      .first();

    if (existingBookmark) {
      await ctx.db.delete(existingBookmark._id);
      return { action: "removed" as const, bookmarkId: null };
    }

    const bookmarkId = await ctx.db.insert("bookmarks", {
      userId: userId,
      type: "course",
      courseId: courseId,
      createdAt: Date.now(),
    });

    return { action: "added" as const, bookmarkId };
  },
});

/**
 * Toggle a capsule bookmark (add if not exists, remove if exists)
 * SECURITY: Verifies the authenticated user matches the userId parameter
 */
export const toggleCapsuleBookmark = mutation({
  args: {
    userId: v.id("users"),
    capsuleId: v.id("capsules"),
  },
  handler: async (ctx, args) => {
    const { userId, capsuleId } = args;

    // SECURITY: Verify the authenticated user matches the userId parameter
    const { user } = await requireAuthenticatedUser(ctx);
    if (user._id !== userId) {
      throw new Error("Unauthorized: You can only manage your own bookmarks");
    }

    // Check if capsule exists
    const capsule = await ctx.db.get(capsuleId);
    if (!capsule) {
      throw new Error("Capsule not found");
    }

    // Only allow bookmarking public capsules or user's own capsules
    if (!capsule.isPublic && capsule.userId.toString() !== userId.toString()) {
      throw new Error("Cannot bookmark a private capsule that doesn't belong to you");
    }

    const existingBookmark = await ctx.db
      .query("bookmarks")
      .withIndex("by_userId_capsuleId", (q) =>
        q.eq("userId", userId).eq("capsuleId", capsuleId)
      )
      .first();

    if (existingBookmark) {
      await ctx.db.delete(existingBookmark._id);
      return { action: "removed" as const, bookmarkId: null };
    }

    const bookmarkId = await ctx.db.insert("bookmarks", {
      userId: userId,
      type: "capsule",
      capsuleId: capsuleId,
      createdAt: Date.now(),
    });

    return { action: "added" as const, bookmarkId };
  },
});

/**
 * Check if a course is bookmarked by a user
 */
export const isCourseBookmarked = query({
  args: {
    userId: v.optional(v.id("users")),
    courseId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    if (!args.userId) {
      return false;
    }

    const bookmark = await ctx.db
      .query("bookmarks")
      .withIndex("by_userId_courseId", (q) =>
        q.eq("userId", args.userId!).eq("courseId", args.courseId)
      )
      .first();

    return !!bookmark;
  },
});

/**
 * Check if a capsule is bookmarked by a user
 */
export const isCapsuleBookmarked = query({
  args: {
    userId: v.optional(v.id("users")),
    capsuleId: v.id("capsules"),
  },
  handler: async (ctx, args) => {
    if (!args.userId) {
      return false;
    }

    const bookmark = await ctx.db
      .query("bookmarks")
      .withIndex("by_userId_capsuleId", (q) =>
        q.eq("userId", args.userId!).eq("capsuleId", args.capsuleId)
      )
      .first();

    return !!bookmark;
  },
});

/**
 * Get all bookmarked courses for a user
 */
export const getBookmarkedCourses = query({
  args: {
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    if (!args.userId) {
      return [];
    }

    const bookmarks = await ctx.db
      .query("bookmarks")
      .withIndex("by_userId_type", (q) =>
        q.eq("userId", args.userId!).eq("type", "course")
      )
      .collect();

    // Fetch the actual course data for each bookmark
    const courses = await Promise.all(
      bookmarks.map(async (bookmark) => {
        if (!bookmark.courseId) return null;
        const course = await ctx.db.get(bookmark.courseId);
        if (!course || !course.isPublished) return null;
        return {
          ...course,
          bookmarkedAt: bookmark.createdAt,
        };
      })
    );

    // Filter out null values (deleted courses) and sort by bookmarkedAt descending
    return courses
      .filter((course): course is NonNullable<typeof course> => course !== null)
      .sort((a, b) => b.bookmarkedAt - a.bookmarkedAt);
  },
});

/**
 * Get all bookmarked capsules for a user
 */
export const getBookmarkedCapsules = query({
  args: {
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    if (!args.userId) {
      return [];
    }

    const userId = args.userId;

    const bookmarks = await ctx.db
      .query("bookmarks")
      .withIndex("by_userId_type", (q) =>
        q.eq("userId", userId).eq("type", "capsule")
      )
      .collect();

    // Fetch the actual capsule data for each bookmark
    const capsules = await Promise.all(
      bookmarks.map(async (bookmark) => {
        if (!bookmark.capsuleId) return null;
        const capsule = await ctx.db.get(bookmark.capsuleId);
        if (!capsule) return null;
        // Only return public capsules or user's own capsules
        if (!capsule.isPublic && capsule.userId.toString() !== userId.toString()) {
          return null;
        }
        return {
          ...capsule,
          bookmarkedAt: bookmark.createdAt,
        };
      })
    );

    // Filter out null values (deleted/inaccessible capsules) and sort by bookmarkedAt descending
    return capsules
      .filter((capsule): capsule is NonNullable<typeof capsule> => capsule !== null)
      .sort((a, b) => b.bookmarkedAt - a.bookmarkedAt);
  },
});

/**
 * Get bookmark counts for a user (for sidebar badge)
 */
export const getBookmarkCounts = query({
  args: {
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    if (!args.userId) {
      return { courses: 0, capsules: 0, total: 0 };
    }

    const allBookmarks = await ctx.db
      .query("bookmarks")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId!))
      .collect();

    const courseCount = allBookmarks.filter((b) => b.type === "course").length;
    const capsuleCount = allBookmarks.filter((b) => b.type === "capsule").length;

    return {
      courses: courseCount,
      capsules: capsuleCount,
      total: courseCount + capsuleCount,
    };
  },
});
