import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Mutation to create a new course
export const createCourse = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const courseId = await ctx.db.insert("courses", {
      name: args.name,
      description: args.description,
      status: "draft",
      isPublished: false,
      createdAt: now,
      updatedAt: now,
    });
    return courseId;
  },
});

// Mutation to update a course
export const updateCourse = mutation({
  args: {
    id: v.id("courses"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const now = Date.now();
    
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: now,
    });
    
    return await ctx.db.get(id);
  },
});

// Mutation to delete a course (will cascade delete chapters via Convex)
export const deleteCourse = mutation({
  args: {
    id: v.id("courses"),
  },
  handler: async (ctx, args) => {
    // First, delete all chapters associated with this course
    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_courseId", (q) => q.eq("courseId", args.id))
      .collect();
    
    for (const chapter of chapters) {
      await ctx.db.delete(chapter._id);
    }
    
    // Then delete the course
    await ctx.db.delete(args.id);
    return { id: args.id };
  },
});

// Query to get a single course by ID
export const getCourse = query({
  args: {
    id: v.id("courses"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Query to get all courses with pagination
export const getAllCourses = query({
  args: {
    limit: v.number(),
    offset: v.number(),
  },
  handler: async (ctx, args) => {
    const courses = await ctx.db
      .query("courses")
      .order("desc")
      .take(args.limit + args.offset);
    
    // Filter only published courses
    const publishedCourses = courses.filter(course => course.isPublished === true);
    
    // Manual pagination since Convex doesn't have built-in offset
    const paginatedCourses = publishedCourses.slice(args.offset, args.offset + args.limit);
    
    // Use course's thumbnailUrl if available, otherwise get from first video
    const coursesWithThumbnails = await Promise.all(
      paginatedCourses.map(async (course) => {
        let thumbnailUrl = course.thumbnailUrl || null;
        
        // If no thumbnail set, try to get from first chapter's video
        if (!thumbnailUrl) {
          const firstChapter = await ctx.db
            .query("chapters")
            .withIndex("by_courseId_order", (q) => 
              q.eq("courseId", course._id).eq("order", 1)
            )
            .first();
          
          if (firstChapter && firstChapter.videoId) {
            const video = await ctx.db.get(firstChapter.videoId);
            thumbnailUrl = video?.thumbnailUrl || null;
          }
        }
        
        return {
          ...course,
          thumbnailUrl,
        };
      })
    );
    
    return coursesWithThumbnails;
  },
});

// Query to get a course with its thumbnail
export const getCourseWithThumbnail = query({
  args: {
    id: v.id("courses"),
  },
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.id);
    if (!course) return null;
    
    // Get the first chapter to get thumbnail
    const firstChapter = await ctx.db
      .query("chapters")
      .withIndex("by_courseId_order", (q) => 
        q.eq("courseId", args.id).eq("order", 1)
      )
      .first();
    
    let thumbnailUrl = null;
    if (firstChapter && firstChapter.videoId) {
      const video = await ctx.db.get(firstChapter.videoId);
      thumbnailUrl = video?.thumbnailUrl || null;
    }
    
    return {
      ...course,
      thumbnailUrl,
    };
  },
});

// Query to get chapters for a course
export const getChaptersForCourse = query({
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
    
    // Get video details for each chapter
    const chaptersWithVideos = await Promise.all(
      chapters.map(async (chapter) => {
        const video = chapter.videoId ? await ctx.db.get(chapter.videoId) : null;
        return {
          id: chapter._id,
          name: chapter.name,
          order: chapter.order,
          durationInSeconds: video?.durationInSeconds || null,
        };
      })
    );
    
    return chaptersWithVideos;
  },
});

// Query to get full course with all chapters and video details
export const getFullCourseChapters = query({
  args: {
    courseId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.courseId);
    if (!course) return [];
    
    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
      .collect();
    
    // Sort by order
    chapters.sort((a, b) => a.order - b.order);
    
    // Get full video details for each chapter
    const fullChapters = await Promise.all(
      chapters.map(async (chapter) => {
        const video = chapter.videoId ? await ctx.db.get(chapter.videoId) : null;
        return {
          id: chapter._id,
          name: chapter.name,
          order: chapter.order,
          course: {
            id: course._id,
            name: course.name,
            description: course.description,
          },
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
      })
    );
    
    return fullChapters;
  },
});

// Query to get chapters with videos (with full notes, quiz, transcript data)
export const getChaptersWithVideosByCourseId = query({
  args: {
    courseId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.courseId);
    if (!course) return [];
    
    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
      .collect();
    
    // Sort by order
    chapters.sort((a, b) => a.order - b.order);
    
    // Get full video details and content items for each chapter
    const chaptersWithVideos = await Promise.all(
      chapters.map(async (chapter) => {
        let video = null;
        
        // Get all content items for this chapter
        const contentItems = await ctx.db
          .query("contentItems")
          .withIndex("by_chapterId", (q) => q.eq("chapterId", chapter._id))
          .collect();
        
        // Sort content items by order
        contentItems.sort((a, b) => a.order - b.order);
        
        // Enrich content items with video details
        const enrichedContentItems = await Promise.all(
          contentItems.map(async (item) => {
            if (item.type === "video" && item.videoId) {
              const videoData = await ctx.db.get(item.videoId);
              return {
                id: item._id,
                type: item.type,
                title: item.title,
                order: item.order,
                videoId: item.videoId,
                textContent: item.textContent,
                videoDetails: videoData ? {
                  youtubeVideoId: videoData.youtubeVideoId,
                  url: videoData.url,
                  thumbnailUrl: videoData.thumbnailUrl,
                  durationInSeconds: videoData.durationInSeconds,
                  notes: videoData.notes,
                  quiz: videoData.quiz,
                  transcript: videoData.transcript,
                } : null,
              };
            }
            return {
              id: item._id,
              type: item.type,
              title: item.title,
              order: item.order,
              textContent: item.textContent,
              textQuiz: item.textQuiz,
              textQuizStatus: item.textQuizStatus,
              textQuizError: item.textQuizError,
              videoId: item.videoId,
              resourceUrl: item.resourceUrl,
              resourceTitle: item.resourceTitle,
            };
          })
        );
        
        // First, check if chapter has direct videoId (old system - backward compatibility)
        if (chapter.videoId) {
          video = await ctx.db.get(chapter.videoId);
        } 
        // If no direct videoId, use the first video from content items
        else if (enrichedContentItems.length > 0) {
          const firstVideoContent = enrichedContentItems.find(item => item.type === "video" && item.videoDetails);
          if (firstVideoContent && firstVideoContent.videoDetails) {
            video = {
              youtubeVideoId: firstVideoContent.videoDetails.youtubeVideoId,
              title: firstVideoContent.videoDetails.url.split('v=')[1] || firstVideoContent.title,
              url: firstVideoContent.videoDetails.url,
              thumbnailUrl: firstVideoContent.videoDetails.thumbnailUrl,
              durationInSeconds: firstVideoContent.videoDetails.durationInSeconds,
              notes: firstVideoContent.videoDetails.notes,
              quiz: firstVideoContent.videoDetails.quiz,
              transcript: firstVideoContent.videoDetails.transcript,
            };
          }
        }
        
        return {
          id: chapter._id,
          name: chapter.name,
          order: chapter.order,
          course: {
            id: course._id,
            name: course.name,
            description: course.description,
          },
          contentItems: enrichedContentItems,
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
      })
    );
    
    return chaptersWithVideos;
  },
});

// Mutation to toggle course publish status
export const togglePublishCourse = mutation({
  args: {
    id: v.id("courses"),
    isPublished: v.boolean(),
  },
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.id);
    if (!course) throw new Error("Course not found");
    
    let thumbnailUrl = course.thumbnailUrl;
    
    // If publishing and no thumbnail is set, get from first video
    if (args.isPublished && !thumbnailUrl) {
      // Try to get thumbnail from first chapter's video
      const firstChapter = await ctx.db
        .query("chapters")
        .withIndex("by_courseId_order", (q) => 
          q.eq("courseId", args.id).eq("order", 1)
        )
        .first();
      
      if (firstChapter) {
        // Check if chapter has direct videoId (old system)
        if (firstChapter.videoId) {
          const video = await ctx.db.get(firstChapter.videoId);
          if (video?.thumbnailUrl) {
            thumbnailUrl = video.thumbnailUrl;
          }
        } else {
          // Check contentItems for first video (new system)
          const contentItems = await ctx.db
            .query("contentItems")
            .withIndex("by_chapterId_order", (q) => 
              q.eq("chapterId", firstChapter._id).eq("order", 1)
            )
            .first();
          
          if (contentItems && contentItems.type === "video" && contentItems.videoId) {
            const video = await ctx.db.get(contentItems.videoId);
            if (video?.thumbnailUrl) {
              thumbnailUrl = video.thumbnailUrl;
            }
          }
        }
      }
    }
    
    await ctx.db.patch(args.id, {
      isPublished: args.isPublished,
      status: args.isPublished ? "ready" : "draft",
      thumbnailUrl: thumbnailUrl,
      updatedAt: Date.now(),
    });
    return await ctx.db.get(args.id);
  },
});

// Mutation to update course status
export const updateCourseStatus = mutation({
  args: {
    id: v.id("courses"),
    status: v.union(
      v.literal("draft"),
      v.literal("generating"),
      v.literal("ready"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });
    return await ctx.db.get(args.id);
  },
});

// Query to get courses with statistics
export const getCoursesWithStats = query({
  args: {},
  handler: async (ctx) => {
    const courses = await ctx.db.query("courses").collect();
    
    const coursesWithStats = await Promise.all(
      courses.map(async (course) => {
        // Get chapter count
        const chapters = await ctx.db
          .query("chapters")
          .withIndex("by_courseId", (q) => q.eq("courseId", course._id))
          .collect();
        
        return {
          ...course,
          id: course._id,
          chapterCount: chapters.length,
        };
      })
    );
    
    return coursesWithStats;
  },
});
