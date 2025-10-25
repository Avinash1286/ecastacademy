import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { recalculateCourseProgressSync } from "./completions";

// Mutation to create a new course
export const createCourse = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    isCertification: v.optional(v.boolean()),
    passingGrade: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const courseId = await ctx.db.insert("courses", {
      name: args.name,
      description: args.description,
      isCertification: args.isCertification ?? false, // Default to non-certification
      passingGrade: args.passingGrade ?? 70, // Default 70%
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
    isCertification: v.optional(v.boolean()),
    passingGrade: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const now = Date.now();
    
    // Get the current course to check if certification status is changing
    const currentCourse = await ctx.db.get(id);
    const certificationChanged = 
      currentCourse && 
      updates.isCertification !== undefined && 
      currentCourse.isCertification !== updates.isCertification;
    
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: now,
    });
    
    // If certification status changed, sync all content items' grading status
    if (certificationChanged) {
      const updatedCourse = await ctx.db.get(id);
      if (updatedCourse) {
        // Get all chapters for this course
        const chapters = await ctx.db
          .query("chapters")
          .withIndex("by_courseId", (q) => q.eq("courseId", id))
          .collect();

        // For each chapter, update its content items
        for (const chapter of chapters) {
          const contentItems = await ctx.db
            .query("contentItems")
            .withIndex("by_chapterId", (q) => q.eq("chapterId", chapter._id))
            .collect();

          for (const item of contentItems) {
            let shouldBeGraded: boolean;

            if (updatedCourse.isCertification) {
              // For certification courses, determine grading based on type
              if (item.type === "video" && item.videoId) {
                const video = await ctx.db.get(item.videoId);
                shouldBeGraded = video?.quiz ? true : false;
              } else if (item.type === "quiz" || item.type === "assignment") {
                shouldBeGraded = true;
              } else {
                shouldBeGraded = false;
              }
            } else {
              shouldBeGraded = false;
            }

            // Update if different from current status
            if (item.isGraded !== shouldBeGraded) {
              await ctx.db.patch(item._id, {
                isGraded: shouldBeGraded,
                maxPoints: shouldBeGraded ? (item.maxPoints ?? 100) : undefined,
                passingScore: shouldBeGraded
                  ? (item.passingScore ?? updatedCourse.passingGrade ?? 70)
                  : undefined,
              });
            }
          }
        }

        // Recalculate cached progress so course switches remain consistent
        await recalculateCourseProgressSync(ctx, { courseId: id });
      }
    }
    
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
                isGraded: item.isGraded ?? false,
                maxPoints: item.maxPoints ?? undefined,
                passingScore: item.passingScore ?? undefined,
                allowRetakes: item.allowRetakes ?? true,
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
               isGraded: item.isGraded ?? false,
               maxPoints: item.maxPoints ?? undefined,
               passingScore: item.passingScore ?? undefined,
               allowRetakes: item.allowRetakes ?? true,
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
            isCertification: course.isCertification,
            passingGrade: course.passingGrade,
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

// Query to get course grading configuration
export const getCourseGradingConfig = query({
  args: { 
    courseId: v.id("courses") 
  },
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.courseId);
    if (!course) return null;
    
    // Get all chapters for this course
    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
      .collect();
    
    // Count graded items across all chapters
    let totalGradedItems = 0;
    for (const chapter of chapters) {
      const contentItems = await ctx.db
        .query("contentItems")
        .withIndex("by_chapterId", (q) => q.eq("chapterId", chapter._id))
        .collect();
      
      totalGradedItems += contentItems.filter(item => item.isGraded).length;
    }
    
    return {
      courseId: args.courseId,
      courseName: course.name,
      isCertification: course.isCertification ?? false,
      passingGrade: course.passingGrade ?? 70,
      totalGradedItems,
    };
  },
});

// ========== ENROLLMENT MUTATIONS & QUERIES ==========

/**
 * Enroll a user in a course
 */
export const enrollInCourse = mutation({
  args: {
    courseId: v.id("courses"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Check if course exists
    const course = await ctx.db.get(args.courseId);
    if (!course) {
      throw new Error("Course not found");
    }

    // Check if already enrolled
    const existingEnrollment = await ctx.db
      .query("enrollments")
      .withIndex("by_userId_courseId", (q) =>
        q.eq("userId", args.userId).eq("courseId", args.courseId)
      )
      .first();

    if (existingEnrollment) {
      // If previously dropped, reactivate enrollment
      if (existingEnrollment.status === "dropped") {
        await ctx.db.patch(existingEnrollment._id, {
          status: "active",
          enrolledAt: Date.now(),
          lastAccessedAt: Date.now(),
        });
        return { enrollmentId: existingEnrollment._id, message: "Re-enrolled successfully" };
      }
      throw new Error("Already enrolled in this course");
    }

    // Create new enrollment
    const enrollmentId = await ctx.db.insert("enrollments", {
      userId: args.userId,
      courseId: args.courseId,
      enrolledAt: Date.now(),
      status: "active",
      lastAccessedAt: Date.now(),
    });

    return { enrollmentId, message: "Enrolled successfully" };
  },
});

/**
 * Unenroll a user from a course
 */
export const unenrollFromCourse = mutation({
  args: {
    courseId: v.id("courses"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Find enrollment
    const enrollment = await ctx.db
      .query("enrollments")
      .withIndex("by_userId_courseId", (q) =>
        q.eq("userId", args.userId).eq("courseId", args.courseId)
      )
      .first();

    if (!enrollment) {
      throw new Error("Not enrolled in this course");
    }

    if (enrollment.status === "completed") {
      throw new Error("Cannot unenroll from a completed course");
    }

    // Mark as dropped instead of deleting
    await ctx.db.patch(enrollment._id, {
      status: "dropped",
    });

    return { message: "Unenrolled successfully" };
  },
});

/**
 * Check if current user is enrolled in a course
 */
export const isUserEnrolled = query({
  args: {
    courseId: v.id("courses"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const enrollment = await ctx.db
      .query("enrollments")
      .withIndex("by_userId_courseId", (q) =>
        q.eq("userId", args.userId).eq("courseId", args.courseId)
      )
      .first();

    return {
      isEnrolled: enrollment?.status === "active" || enrollment?.status === "completed",
      status: enrollment?.status,
      enrolledAt: enrollment?.enrolledAt,
    };
  },
});

/**
 * Get all courses the current user is enrolled in
 */
export const getEnrolledCourses = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Get all active enrollments
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .filter((q) => 
        q.or(
          q.eq(q.field("status"), "active"),
          q.eq(q.field("status"), "completed")
        )
      )
      .collect();

    // Get course details for each enrollment
    const courses = await Promise.all(
      enrollments.map(async (enrollment) => {
        const course = await ctx.db.get(enrollment.courseId);
        if (!course) return null;

        // Get chapter count
        const chapters = await ctx.db
          .query("chapters")
          .withIndex("by_courseId", (q) => q.eq("courseId", course._id))
          .collect();

        // Get progress
        const progressRecords = await ctx.db
          .query("progress")
          .withIndex("by_userId_courseId", (q) =>
            q.eq("userId", args.userId).eq("courseId", course._id)
          )
          .collect();

        // Count total content items
        let totalItems = 0;
        for (const chapter of chapters) {
          const items = await ctx.db
            .query("contentItems")
            .withIndex("by_chapterId", (q) => q.eq("chapterId", chapter._id))
            .collect();
          totalItems += items.length;
        }

        const completedItems = progressRecords.filter((p) => p.completed).length;
        const progressPercentage = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

        return {
          ...course,
          enrollmentStatus: enrollment.status,
          enrolledAt: enrollment.enrolledAt,
          lastAccessedAt: enrollment.lastAccessedAt,
          progressPercentage,
          totalChapters: chapters.length,
        };
      })
    );

    return courses.filter((course) => course !== null);
  },
});

/**
 * Update last accessed time for a course enrollment
 */
export const updateLastAccessed = mutation({
  args: {
    courseId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();

    if (!user) return;

    const enrollment = await ctx.db
      .query("enrollments")
      .withIndex("by_userId_courseId", (q) =>
        q.eq("userId", user._id).eq("courseId", args.courseId)
      )
      .first();

    if (enrollment) {
      await ctx.db.patch(enrollment._id, {
        lastAccessedAt: Date.now(),
      });
    }
  },
});

