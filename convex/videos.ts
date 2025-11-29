import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthenticatedUser, requireAdminUser } from "./utils/auth";
import { validateStringLength, validateUrl, MAX_TITLE_LENGTH, MAX_URL_LENGTH } from "./utils/validation";

// Maximum number of videos to return in unbounded queries
const MAX_VIDEOS_LIMIT = 500;

// Mutation to create a new video
export const createVideo = mutation({
  args: {
    youtubeVideoId: v.string(),
    title: v.string(),
    url: v.string(),
    thumbnailUrl: v.optional(v.string()),
    channelTitle: v.optional(v.string()),
    durationInSeconds: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
    transcript: v.optional(v.string()),
    notes: v.any(),
    quiz: v.any(),
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    )),
  },
  handler: async (ctx, args) => {
    // Auth check - must be authenticated
    await requireAuthenticatedUser(ctx);
    
    // Validate input
    validateStringLength(args.title, MAX_TITLE_LENGTH, "Title");
    validateStringLength(args.youtubeVideoId, 50, "YouTube Video ID");
    validateUrl(args.url, "URL");
    if (args.thumbnailUrl) {
      validateUrl(args.thumbnailUrl, "Thumbnail URL");
    }
    if (args.channelTitle) {
      validateStringLength(args.channelTitle, MAX_TITLE_LENGTH, "Channel title");
    }
    
    const now = Date.now();
    const { status, ...videoData } = args;
    const videoId = await ctx.db.insert("videos", {
      ...videoData,
      status: status ?? "pending", // Start as pending unless overridden
      createdAt: now,
      updatedAt: now,
    });
    return videoId;
  },
});

// Query to find a video by YouTube video ID
export const findVideoByYoutubeId = query({
  args: {
    youtubeVideoId: v.string(),
  },
  handler: async (ctx, args) => {
    const video = await ctx.db
      .query("videos")
      .withIndex("by_youtubeVideoId", (q) => 
        q.eq("youtubeVideoId", args.youtubeVideoId)
      )
      .first();
    
    return video;
  },
});

// Query to get a video by ID
export const getVideo = query({
  args: {
    id: v.id("videos"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Mutation to update a video
export const updateVideo = mutation({
  args: {
    id: v.id("videos"),
    title: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    channelTitle: v.optional(v.string()),
    durationInSeconds: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
    transcript: v.optional(v.string()),
    notes: v.optional(v.any()),
    quiz: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Auth check - must be authenticated
    await requireAuthenticatedUser(ctx);
    
    // Validate input
    if (args.title) {
      validateStringLength(args.title, MAX_TITLE_LENGTH, "Title");
    }
    if (args.thumbnailUrl) {
      validateUrl(args.thumbnailUrl, "Thumbnail URL");
    }
    if (args.channelTitle) {
      validateStringLength(args.channelTitle, MAX_TITLE_LENGTH, "Channel title");
    }
    
    // Verify video exists
    const video = await ctx.db.get(args.id);
    if (!video) {
      throw new Error("Video not found");
    }
    
    const { id, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    return await ctx.db.get(id);
  },
});

// Mutation to delete a video (only if not referenced by any chapters or content items)
export const deleteVideo = mutation({
  args: {
    id: v.id("videos"),
  },
  handler: async (ctx, args) => {
    // Auth check - must be admin
    await requireAdminUser(ctx);
    
    // Verify video exists
    const video = await ctx.db.get(args.id);
    if (!video) {
      throw new Error("Video not found");
    }
    
    // Check if video is referenced by any chapters (old system)
    const chapter = await ctx.db
      .query("chapters")
      .withIndex("by_videoId", (q) => q.eq("videoId", args.id))
      .first();
    
    if (chapter) {
      throw new Error("Cannot delete video that is referenced by chapters");
    }
    
    // Check if video is referenced by any content items (new system)
    const contentItems = await ctx.db
      .query("contentItems")
      .filter((q) => q.eq(q.field("videoId"), args.id))
      .first();
    
    if (contentItems) {
      throw new Error("Cannot delete video that is referenced by content items");
    }
    
    await ctx.db.delete(args.id);
    return { id: args.id };
  },
});

// Query to get all videos (with limit to prevent memory issues)
export const getAllVideos = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? MAX_VIDEOS_LIMIT, MAX_VIDEOS_LIMIT);
    const videos = await ctx.db.query("videos").order("desc").take(limit);
    return videos;
  },
});

// Query to get a video by ID
export const getVideoById = query({
  args: {
    id: v.id("videos"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
