import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    return await ctx.db.get(id);
  },
});

// Mutation to delete a video (only if not referenced by any chapters)
export const deleteVideo = mutation({
  args: {
    id: v.id("videos"),
  },
  handler: async (ctx, args) => {
    // Check if video is referenced by any chapters
    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_videoId", (q) => q.eq("videoId", args.id))
      .first();
    
    if (chapters) {
      throw new Error("Cannot delete video that is referenced by chapters");
    }
    
    await ctx.db.delete(args.id);
    return { id: args.id };
  },
});

// Query to get all videos
export const getAllVideos = query({
  args: {},
  handler: async (ctx) => {
    const videos = await ctx.db.query("videos").order("desc").collect();
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
