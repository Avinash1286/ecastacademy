import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { recalculateCourseProgressSync } from "./completions";
import { isTrackableContentItem, mapVideosById } from "./utils/progressUtils";
import { createTransaction, validatePreconditions } from "./utils/transactions";
import { requireAuthenticatedUser, requireAuthenticatedUserWithFallback } from "./utils/auth";
import { validateCourseFields, validatePositiveNumber } from "./utils/validation";

// Helper type for quiz question (input can have correct or correctIndex)
type QuizQuestion = {
  question: string;
  options: string[];
  correct?: number;
  correctIndex?: number;
  explanation?: string;
};

// Helper type for quiz structure
type Quiz = {
  questions?: QuizQuestion[];
  [key: string]: unknown;
};

/**
 * Strips the correct answer field from quiz questions to prevent cheating.
 * This ensures the client cannot see the correct answers in the network response.
 */
function stripCorrectAnswers<T extends Quiz | null | undefined>(quiz: T): T {
  if (!quiz || !quiz.questions) return quiz;
  
  return {
    ...quiz,
    questions: quiz.questions.map((q: QuizQuestion) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { correct, correctIndex, ...rest } = q;
      return rest;
    }),
  } as T;
}

// Mutation to create a new course
export const createCourse = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    isCertification: v.optional(v.boolean()),
    passingGrade: v.optional(v.number()),
    currentUserId: v.optional(v.id("users")), // Fallback for client-side auth
  },
  handler: async (ctx, args) => {
    // Auth check with fallback
    const { user } = await requireAuthenticatedUserWithFallback(ctx, args.currentUserId);
    
    // Validate input
    validateCourseFields({ name: args.name, description: args.description });
    if (args.passingGrade !== undefined) {
      validatePositiveNumber(args.passingGrade, "Passing grade");
      if (args.passingGrade > 100) {
        throw new Error("Passing grade cannot exceed 100");
      }
    }
    
    const now = Date.now();
    const courseId = await ctx.db.insert("courses", {
      name: args.name,
      description: args.description,
      isCertification: args.isCertification ?? false, // Default to non-certification
      passingGrade: args.passingGrade ?? 70, // Default 70%
      status: "draft",
      isPublished: false,
      createdBy: user._id.toString(), // Track creator
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
    currentUserId: v.optional(v.id("users")), // Fallback for client-side auth
  },
  handler: async (ctx, args) => {
    // Auth check with fallback
    const { user } = await requireAuthenticatedUserWithFallback(ctx, args.currentUserId);
    
    // Validate input
    validateCourseFields({ 
      name: args.name, 
      description: args.description,
      thumbnailUrl: args.thumbnailUrl 
    });
    if (args.passingGrade !== undefined) {
      validatePositiveNumber(args.passingGrade, "Passing grade");
      if (args.passingGrade > 100) {
        throw new Error("Passing grade cannot exceed 100");
      }
    }
    
    const { id, currentUserId, ...updates } = args;
    const now = Date.now();
    
    // Get the current course to check ownership and certification status
    const currentCourse = await ctx.db.get(id);
    if (!currentCourse) {
      throw new Error("Course not found");
    }
    
    // Check if user is admin or course creator
    if (user.role !== "admin" && currentCourse.createdBy !== user._id.toString()) {
      throw new Error("Unauthorized: You can only update your own courses");
    }
    
    const certificationChanged = 
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
// Uses transaction pattern for atomic deletion
export const deleteCourse = mutation({
  args: {
    id: v.id("courses"),
    currentUserId: v.optional(v.id("users")), // Fallback for client-side auth
  },
  handler: async (ctx, args) => {
    // Auth check with fallback
    const { user } = await requireAuthenticatedUserWithFallback(ctx, args.currentUserId);
    
    const courseId = args.id;
    
    // Get course and verify ownership
    const course = await ctx.db.get(courseId);
    if (!course) {
      throw new Error("Course not found");
    }
    
    // Check if user is admin or course creator
    if (user.role !== "admin" && course.createdBy !== user._id.toString()) {
      throw new Error("Unauthorized: You can only delete your own courses");
    }

    // Validate preconditions
    await validatePreconditions([
      {
        check: async () => {
          const course = await ctx.db.get(courseId);
          return course !== null;
        },
        errorMessage: "Course not found",
      },
    ]);

    // Create transaction for atomic operations
    const tx = createTransaction();

    // Collect all items to delete first (read phase)
    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_courseId", (q) => q.eq("courseId", courseId))
      .collect();

    const contentItemIds: Id<"contentItems">[] = [];
    const allContentItems: Doc<"contentItems">[] = [];

    for (const chapter of chapters) {
      const contentItems = await ctx.db
        .query("contentItems")
        .withIndex("by_chapterId", (q) => q.eq("chapterId", chapter._id))
        .collect();
      
      allContentItems.push(...contentItems);
      contentItemIds.push(...contentItems.map(item => item._id));
    }

    // Collect quiz attempts
    const allQuizAttempts: Doc<"quizAttempts">[] = [];
    for (const contentItemId of contentItemIds) {
      const attempts = await ctx.db
        .query("quizAttempts")
        .withIndex("by_contentItemId", (q) => q.eq("contentItemId", contentItemId))
        .collect();
      allQuizAttempts.push(...attempts);
    }

    // Collect progress records
    const progressRecords = await ctx.db
      .query("progress")
      .withIndex("by_courseId", (q) => q.eq("courseId", courseId))
      .collect();

    // Collect enrollments
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_courseId", (q) => q.eq("courseId", courseId))
      .collect();

    // Collect certificates (for audit purposes, we might want to keep these)
    const certificates = await ctx.db
      .query("certificates")
      .withIndex("by_courseId", (q) => q.eq("courseId", courseId))
      .collect();

    // Queue all deletions in transaction (write phase)
    // Order matters: delete children before parents

    // 1. Delete quiz attempts
    for (const attempt of allQuizAttempts) {
      tx.delete("quizAttempts", attempt._id);
    }

    // 2. Delete content items
    for (const item of allContentItems) {
      tx.delete("contentItems", item._id);
    }

    // 3. Delete chapters
    for (const chapter of chapters) {
      tx.delete("chapters", chapter._id);
    }

    // 4. Delete progress records
    for (const record of progressRecords) {
      tx.delete("progress", record._id);
    }

    // 5. Delete enrollments
    for (const enrollment of enrollments) {
      tx.delete("enrollments", enrollment._id);
    }

    // 6. Delete certificates (optional - uncomment if certificates should be deleted)
    for (const cert of certificates) {
      tx.delete("certificates", cert._id);
    }

    // 7. Finally delete the course
    tx.delete("courses", courseId);

    // Commit all operations atomically
    await tx.commit(ctx);

    // Log the deletion for audit
    await ctx.scheduler.runAfter(0, internal.audit.logEvent, {
      userId: user._id,
      action: "course_deleted",
      resourceType: "course",
      resourceId: courseId.toString(),
      metadata: {
        courseName: course.name,
        chaptersDeleted: chapters.length,
        contentItemsDeleted: allContentItems.length,
        quizAttemptsDeleted: allQuizAttempts.length,
        progressRecordsDeleted: progressRecords.length,
        enrollmentsDeleted: enrollments.length,
        certificatesDeleted: certificates.length,
      },
      success: true,
    });

    return { 
      id: courseId,
      deletedChapters: chapters.length,
      deletedContentItems: allContentItems.length,
      deletedQuizAttempts: allQuizAttempts.length,
      deletedProgressRecords: progressRecords.length,
      deletedEnrollments: enrollments.length,
      deletedCertificates: certificates.length,
    };
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

// Query to get all courses with cursor-based pagination
// Returns { courses, nextCursor, hasMore } for efficient pagination
export const getAllCourses = query({
  args: {
    limit: v.number(),
    cursor: v.optional(v.string()), // Cursor is the _id of the last item
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit, 100); // Cap at 100 for performance
    
    // First, get all published courses
    const allPublishedCourses = await ctx.db
      .query("courses")
      .filter((q) => q.eq(q.field("isPublished"), true))
      .collect();
    
    // Sort by publishedAt descending (most recently published first)
    // Fall back to createdAt for legacy courses without publishedAt
    allPublishedCourses.sort((a, b) => {
      const aTime = a.publishedAt ?? a.createdAt;
      const bTime = b.publishedAt ?? b.createdAt;
      return bTime - aTime; // Descending order
    });
    
    // Apply cursor-based pagination
    let startIndex = 0;
    if (args.cursor) {
      const cursorIndex = allPublishedCourses.findIndex(c => c._id === args.cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }
    
    // Get the slice for this page
    const paginatedCourses = allPublishedCourses.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < allPublishedCourses.length;
    const nextCursor = hasMore && paginatedCourses.length > 0 
      ? paginatedCourses[paginatedCourses.length - 1]._id 
      : null;
    
    if (paginatedCourses.length === 0) {
      return { courses: [], nextCursor: null, hasMore: false };
    }
    
    // Batch fetch: Get all first chapters for courses that need thumbnails
    const coursesNeedingThumbnails = paginatedCourses.filter(c => !c.thumbnailUrl);
    const courseIds = coursesNeedingThumbnails.map(c => c._id);
    
    // Get all first chapters in one query (batch)
    const firstChapters = courseIds.length > 0 
      ? await ctx.db
          .query("chapters")
          .filter((q) => 
            q.and(
              q.or(...courseIds.map(id => q.eq(q.field("courseId"), id))),
              q.eq(q.field("order"), 1)
            )
          )
          .take(courseIds.length)
      : [];
    
    // Create lookup map for chapters by courseId
    const chapterByCourse = new Map(
      firstChapters.map(ch => [ch.courseId.toString(), ch])
    );
    
    // Get all video IDs needed
    const videoIds = firstChapters
      .filter(ch => ch.videoId)
      .map(ch => ch.videoId!);
    
    // Batch fetch all videos
    const videos = videoIds.length > 0
      ? await Promise.all(videoIds.map(id => ctx.db.get(id)))
      : [];
    
    // Create lookup map for videos
    const videoById = new Map(
      videos.filter(Boolean).map(v => [v!._id.toString(), v!])
    );
    
    // Build response with thumbnails (no N+1)
    const coursesWithThumbnails = paginatedCourses.map((course) => {
      let thumbnailUrl = course.thumbnailUrl || null;
      
      if (!thumbnailUrl) {
        const chapter = chapterByCourse.get(course._id.toString());
        if (chapter?.videoId) {
          const video = videoById.get(chapter.videoId.toString());
          thumbnailUrl = video?.thumbnailUrl || null;
        }
      }
      
      return {
        ...course,
        thumbnailUrl,
      };
    });
    
    return {
      courses: coursesWithThumbnails,
      nextCursor,
      hasMore,
    };
  },
});

// Query to get course ownership for authorization checks
export const getCourseOwnership = query({
  args: {
    id: v.id("courses"),
  },
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.id);
    if (!course) return null;
    
    return {
      createdBy: course.createdBy ?? null,
    };
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
// OPTIMIZED: Batch loads videos to avoid N+1 queries
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
    
    // Batch fetch all videos at once
    const videoIds = chapters
      .filter(ch => ch.videoId)
      .map(ch => ch.videoId!);
    
    const videos = videoIds.length > 0
      ? await Promise.all(videoIds.map(id => ctx.db.get(id)))
      : [];
    
    // Create lookup map
    const videoMap = new Map(
      videos.filter(Boolean).map(v => [v!._id.toString(), v!])
    );
    
    // Build response (no N+1)
    const chaptersWithVideos = chapters.map((chapter) => {
      const video = chapter.videoId 
        ? videoMap.get(chapter.videoId.toString()) 
        : null;
      return {
        id: chapter._id,
        name: chapter.name,
        order: chapter.order,
        durationInSeconds: video?.durationInSeconds || null,
      };
    });
    
    return chaptersWithVideos;
  },
});

// Query to get full course with all chapters and video details
// OPTIMIZED: Batch loads videos to avoid N+1 queries
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
    
    // Batch fetch all videos at once
    const videoIds = chapters
      .filter(ch => ch.videoId)
      .map(ch => ch.videoId!);
    
    const videos = videoIds.length > 0
      ? await Promise.all(videoIds.map(id => ctx.db.get(id)))
      : [];
    
    // Create lookup map
    const videoMap = new Map(
      videos.filter(Boolean).map(v => [v!._id.toString(), v!])
    );
    
    // Build response (no N+1)
    const fullChapters = chapters.map((chapter) => {
      const video = chapter.videoId 
        ? videoMap.get(chapter.videoId.toString()) 
        : null;
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
          quiz: stripCorrectAnswers(video.quiz),
          transcript: video.transcript,
        } : null,
      };
    });
    
    return fullChapters;
  },
});

// Query to get chapters with videos (with full notes, quiz, transcript data)
// OPTIMIZED: Uses batch loading to avoid N+1 queries
export const getChaptersWithVideosByCourseId = query({
  args: {
    courseId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.courseId);
    if (!course) return [];
    
    // 1. Get all chapters in one query
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
    
    // 3. Collect ALL unique video IDs (from chapters and content items)
    const videoIdsSet = new Set<string>();
    
    // From chapters (old system)
    for (const chapter of chapters) {
      if (chapter.videoId) {
        videoIdsSet.add(chapter.videoId.toString());
      }
    }
    
    // From content items (new system)
    for (const item of allContentItems) {
      if (item.type === "video" && item.videoId) {
        videoIdsSet.add(item.videoId.toString());
      }
    }
    
    // 4. Batch fetch ALL videos in one parallel operation
    const videoIds = Array.from(videoIdsSet);
    const videoPromises = videoIds.map(id => ctx.db.get(id as Id<"videos">));
    const videos = await Promise.all(videoPromises);
    
    // Create video lookup map
    const videoMap = new Map<string, Doc<"videos">>();
    for (let i = 0; i < videoIds.length; i++) {
      if (videos[i]) {
        videoMap.set(videoIds[i], videos[i]!);
      }
    }
    
    // 5. Group content items by chapter
    const contentByChapter = new Map<string, typeof allContentItems>();
    for (const item of allContentItems) {
      const chapterId = item.chapterId.toString();
      if (!contentByChapter.has(chapterId)) {
        contentByChapter.set(chapterId, []);
      }
      contentByChapter.get(chapterId)!.push(item);
    }
    
    // 6. Build response (no more database queries!)
    const chaptersWithVideos = chapters.map((chapter) => {
      // Get content items for this chapter from our map
      const contentItems = contentByChapter.get(chapter._id.toString()) || [];
      contentItems.sort((a, b) => a.order - b.order);
      
      // Enrich content items with video details from our map
      const enrichedContentItems = contentItems.map((item) => {
        if (item.type === "video" && item.videoId) {
          const videoData = videoMap.get(item.videoId.toString());
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
              quiz: stripCorrectAnswers(videoData.quiz),
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
          textQuiz: stripCorrectAnswers(item.textQuiz),
          textQuizStatus: item.textQuizStatus,
          textQuizError: item.textQuizError,
          videoId: item.videoId,
          resourceUrl: item.resourceUrl,
          resourceTitle: item.resourceTitle,
        };
      });
      
      // Get video for chapter
      let video = null;
      
      // First, check if chapter has direct videoId (old system - backward compatibility)
      if (chapter.videoId) {
        video = videoMap.get(chapter.videoId.toString()) || null;
      } 
      // If no direct videoId, use the first video from content items
      else if (enrichedContentItems.length > 0) {
        const firstVideoContent = enrichedContentItems.find(
          item => item.type === "video" && item.videoDetails
        );
        if (firstVideoContent && firstVideoContent.videoDetails) {
          video = {
            youtubeVideoId: firstVideoContent.videoDetails.youtubeVideoId,
            title: firstVideoContent.videoDetails.url.split('v=')[1] || firstVideoContent.title,
            url: firstVideoContent.videoDetails.url,
            thumbnailUrl: firstVideoContent.videoDetails.thumbnailUrl,
            durationInSeconds: firstVideoContent.videoDetails.durationInSeconds,
            notes: firstVideoContent.videoDetails.notes,
            quiz: firstVideoContent.videoDetails.quiz, // Already stripped above
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
          quiz: stripCorrectAnswers(video.quiz),
          transcript: video.transcript,
        } : null,
      };
    });
    
    return chaptersWithVideos;
  },
});

// Mutation to toggle course publish status
export const togglePublishCourse = mutation({
  args: {
    id: v.id("courses"),
    isPublished: v.boolean(),
    currentUserId: v.optional(v.id("users")), // Fallback for client-side auth
  },
  handler: async (ctx, args) => {
    // Auth check with fallback
    const { user } = await requireAuthenticatedUserWithFallback(ctx, args.currentUserId);
    
    const course = await ctx.db.get(args.id);
    if (!course) throw new Error("Course not found");
    
    // Check if user is admin or course creator
    if (user.role !== "admin" && course.createdBy !== user._id.toString()) {
      throw new Error("Unauthorized: You can only publish/unpublish your own courses");
    }
    
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
      // Set publishedAt only when publishing, clear it when unpublishing
      publishedAt: args.isPublished ? Date.now() : undefined,
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

// Query to get courses with statistics (paginated)
// Used by admin dashboard to view all courses with chapter counts
export const getCoursesWithStats = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 20, 100); // Default 20, max 100
    
    let paginatedCourses: Doc<"courses">[] = [];
    let hasMore = false;
    let nextCursor: string | null = null;
    
    if (args.cursor) {
      // Cursor-based pagination
      const cursorCourse = await ctx.db.get(args.cursor as Id<"courses">);
      if (cursorCourse) {
        const courses = await ctx.db
          .query("courses")
          .order("desc")
          .filter((q) => q.lt(q.field("_creationTime"), cursorCourse._creationTime))
          .take(limit + 1);
        
        hasMore = courses.length > limit;
        paginatedCourses = hasMore ? courses.slice(0, limit) : courses;
      }
    } else {
      // First page
      const courses = await ctx.db
        .query("courses")
        .order("desc")
        .take(limit + 1);
      
      hasMore = courses.length > limit;
      paginatedCourses = hasMore ? courses.slice(0, limit) : courses;
    }
    
    if (paginatedCourses.length === 0) {
      return { courses: [], nextCursor: null, hasMore: false };
    }
    
    nextCursor = hasMore && paginatedCourses.length > 0 
      ? paginatedCourses[paginatedCourses.length - 1]._id 
      : null;
    
    // Batch fetch all chapters for all courses at once (avoid N+1)
    const courseIds = paginatedCourses.map(c => c._id);
    const allChapters = await ctx.db
      .query("chapters")
      .filter((q) => q.or(...courseIds.map(id => q.eq(q.field("courseId"), id))))
      .collect();
    
    // Count chapters per course
    const chapterCountByCourse = new Map<string, number>();
    for (const chapter of allChapters) {
      const key = chapter.courseId.toString();
      chapterCountByCourse.set(key, (chapterCountByCourse.get(key) ?? 0) + 1);
    }
    
    const coursesWithStats = paginatedCourses.map((course) => ({
      ...course,
      id: course._id,
      chapterCount: chapterCountByCourse.get(course._id.toString()) ?? 0,
    }));
    
    return {
      courses: coursesWithStats,
      nextCursor,
      hasMore,
    };
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
    // 1. Get all active enrollments
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

    if (enrollments.length === 0) return [];

    // 2. Batch fetch all courses
    const courseIds = enrollments.map(e => e.courseId);
    const courses = await Promise.all(courseIds.map(id => ctx.db.get(id)));
    const courseMap = new Map(
      courses.filter(Boolean).map(c => [c!._id.toString(), c!])
    );

    // 3. Batch fetch all chapters for all courses
    const allChapters = await ctx.db
      .query("chapters")
      .filter((q) => 
        q.or(...courseIds.map(id => q.eq(q.field("courseId"), id)))
      )
      .collect();

    // Group chapters by course
    const chaptersByCourse = new Map<string, typeof allChapters>();
    for (const chapter of allChapters) {
      const key = chapter.courseId.toString();
      if (!chaptersByCourse.has(key)) {
        chaptersByCourse.set(key, []);
      }
      chaptersByCourse.get(key)!.push(chapter);
    }

    // 4. Batch fetch all content items for all chapters
    const chapterIds = allChapters.map(ch => ch._id);
    const allContentItems = chapterIds.length > 0
      ? await ctx.db
          .query("contentItems")
          .filter((q) => 
            q.or(...chapterIds.map(id => q.eq(q.field("chapterId"), id)))
          )
          .collect()
      : [];

    // Group content items by chapter
    const contentByChapter = new Map<string, typeof allContentItems>();
    for (const item of allContentItems) {
      const key = item.chapterId.toString();
      if (!contentByChapter.has(key)) {
        contentByChapter.set(key, []);
      }
      contentByChapter.get(key)!.push(item);
    }

    // 5. Batch fetch all videos
    const videoIdsSet = new Set<Id<"videos">>();
    for (const item of allContentItems) {
      if (item.type === "video" && item.videoId) {
        videoIdsSet.add(item.videoId);
      }
    }
    const videoIds = Array.from(videoIdsSet);
    const videos = videoIds.length > 0
      ? await Promise.all(videoIds.map(id => ctx.db.get(id)))
      : [];
    // Create properly typed video lookup map
    const videoLookup = mapVideosById(videoIds, videos);

    // 6. Batch fetch all progress records for this user and all courses
    const allProgress = await ctx.db
      .query("progress")
      .withIndex("by_userId_courseId", (q) => q.eq("userId", args.userId))
      .collect();

    // Group progress by course
    const progressByCourse = new Map<string, typeof allProgress>();
    for (const p of allProgress) {
      const key = p.courseId.toString();
      if (!progressByCourse.has(key)) {
        progressByCourse.set(key, []);
      }
      progressByCourse.get(key)!.push(p);
    }

    // 7. Build response (no more database queries!)
    const result = enrollments.map((enrollment) => {
      const course = courseMap.get(enrollment.courseId.toString());
      if (!course) return null;

      const chapters = chaptersByCourse.get(course._id.toString()) || [];
      
      // Get all content items for this course's chapters
      const contentItems: typeof allContentItems = [];
      for (const chapter of chapters) {
        const items = contentByChapter.get(chapter._id.toString()) || [];
        contentItems.push(...items);
      }

      // Get trackable items
      const trackableItems = contentItems.filter((item) =>
        isTrackableContentItem(item as Doc<"contentItems">, videoLookup)
      );

      const totalItems = trackableItems.length;
      
      // Get completed items from progress
      const progressRecords = progressByCourse.get(course._id.toString()) || [];
      const completedItemIds = new Set(
        progressRecords
          .filter((p) => p.completed && p.contentItemId)
          .map((p) => p.contentItemId as Id<"contentItems">)
      );

      const completedItems = trackableItems.reduce(
        (count, item) => (completedItemIds.has(item._id) ? count + 1 : count),
        0
      );

      const progressPercentage = totalItems > 0
        ? (completedItems / totalItems) * 100
        : 100;

      return {
        ...course,
        enrollmentStatus: enrollment.status,
        enrolledAt: enrollment.enrolledAt,
        lastAccessedAt: enrollment.lastAccessedAt,
        progressPercentage,
        totalChapters: chapters.length,
      };
    });

    return result.filter((course) => course !== null);
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

// Lazy loading query - only loads full content for the first chapter
// Other chapters get minimal info; content loaded on demand
// NEVER includes transcript - that's loaded only by AI tutor chat
export const getChaptersWithVideosLazy = query({
  args: {
    courseId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.courseId);
    if (!course) return [];
    
    // 1. Get all chapters in one query
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
    
    // 3. For first chapter, collect video IDs to load full content
    const firstChapter = chapters[0];
    const firstChapterContentItems = allContentItems.filter(
      item => item.chapterId.toString() === firstChapter._id.toString()
    );
    
    // Collect video IDs for first chapter only (for notes/quiz)
    const firstChapterVideoIds = new Set<string>();
    if (firstChapter.videoId) {
      firstChapterVideoIds.add(firstChapter.videoId.toString());
    }
    for (const item of firstChapterContentItems) {
      if (item.type === "video" && item.videoId) {
        firstChapterVideoIds.add(item.videoId.toString());
      }
    }
    
    // 4. Batch fetch videos for first chapter only
    const videoPromises = Array.from(firstChapterVideoIds).map(id => 
      ctx.db.get(id as Id<"videos">)
    );
    const videos = await Promise.all(videoPromises);
    
    // Create video lookup map for first chapter
    const videoMap = new Map<string, Doc<"videos">>();
    const videoIdArray = Array.from(firstChapterVideoIds);
    for (let i = 0; i < videoIdArray.length; i++) {
      if (videos[i]) {
        videoMap.set(videoIdArray[i], videos[i]!);
      }
    }
    
    // 5. Group content items by chapter
    const contentByChapter = new Map<string, typeof allContentItems>();
    for (const item of allContentItems) {
      const chapterId = item.chapterId.toString();
      if (!contentByChapter.has(chapterId)) {
        contentByChapter.set(chapterId, []);
      }
      contentByChapter.get(chapterId)!.push(item);
    }
    
    // 6. Build response
    const chaptersWithVideos = chapters.map((chapter, index) => {
      const isFirstChapter = index === 0;
      const contentItems = contentByChapter.get(chapter._id.toString()) || [];
      contentItems.sort((a, b) => a.order - b.order);
      
      // Enrich content items
      const enrichedContentItems = contentItems.map((item) => {
        if (item.type === "video" && item.videoId) {
          const videoData = isFirstChapter ? videoMap.get(item.videoId.toString()) : null;
          
          if (isFirstChapter && videoData) {
            // First chapter: include notes/quiz but NOT transcript
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
              videoDetails: {
                youtubeVideoId: videoData.youtubeVideoId,
                url: videoData.url,
                thumbnailUrl: videoData.thumbnailUrl,
                durationInSeconds: videoData.durationInSeconds,
                notes: videoData.notes,
                quiz: stripCorrectAnswers(videoData.quiz),
                transcript: null, // Never include transcript
                hasTranscript: !!videoData.transcript, // Just flag if available
              },
            };
          } else {
            // Other chapters: minimal video info (no notes/quiz/transcript)
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
              videoDetails: null, // Will be loaded on demand
            };
          }
        }
        
        // Non-video content items
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
          textQuiz: isFirstChapter ? stripCorrectAnswers(item.textQuiz) : null,
          textQuizStatus: item.textQuizStatus,
          textQuizError: item.textQuizError,
          videoId: item.videoId,
          resourceUrl: item.resourceUrl,
          resourceTitle: item.resourceTitle,
        };
      });
      
      // Get video for chapter (old system compatibility)
      let video = null;
      
      if (isFirstChapter && chapter.videoId) {
        const videoData = videoMap.get(chapter.videoId.toString());
        if (videoData) {
          video = {
            videoId: videoData.youtubeVideoId,
            title: videoData.title,
            url: videoData.url,
            thumbnailUrl: videoData.thumbnailUrl,
            durationInSeconds: videoData.durationInSeconds,
            notes: videoData.notes,
            quiz: stripCorrectAnswers(videoData.quiz),
            transcript: null, // Never include transcript
            hasTranscript: !!videoData.transcript,
          };
        }
      } else if (isFirstChapter && enrichedContentItems.length > 0) {
        // Use first video from content items
        const firstVideoContent = enrichedContentItems.find(
          item => item.type === "video" && item.videoDetails
        );
        if (firstVideoContent && firstVideoContent.videoDetails) {
          video = {
            videoId: firstVideoContent.videoDetails.youtubeVideoId,
            title: firstVideoContent.videoDetails.url.split('v=')[1] || firstVideoContent.title,
            url: firstVideoContent.videoDetails.url,
            thumbnailUrl: firstVideoContent.videoDetails.thumbnailUrl,
            durationInSeconds: firstVideoContent.videoDetails.durationInSeconds,
            notes: firstVideoContent.videoDetails.notes,
            quiz: firstVideoContent.videoDetails.quiz,
            transcript: null,
            hasTranscript: firstVideoContent.videoDetails.hasTranscript,
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
        video,
        // Flag to indicate if full content is loaded
        isContentLoaded: isFirstChapter,
      };
    });
    
    return chaptersWithVideos;
  },
});

