import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Query to check videos without proper notes/quiz
export const checkVideosWithoutContent = query({
  args: {},
  handler: async (ctx) => {
    const videos = await ctx.db.query("videos").collect();
    
    const videosWithoutContent = videos.filter(video => {
      const hasValidNotes = video.notes && 
                           typeof video.notes === 'object' && 
                           'topic' in video.notes && 
                           'sections' in video.notes;
      const hasValidQuiz = video.quiz && 
                          typeof video.quiz === 'object' && 
                          'topic' in video.quiz && 
                          'questions' in video.quiz;
      return !hasValidNotes || !hasValidQuiz;
    });
    
    return {
      total: videos.length,
      withoutContent: videosWithoutContent.length,
      videos: videosWithoutContent.map(v => ({
        id: v._id,
        title: v.title,
        hasValidNotes: !!(v.notes && typeof v.notes === 'object' && 'topic' in v.notes),
        hasValidQuiz: !!(v.quiz && typeof v.quiz === 'object' && 'topic' in v.quiz),
        notesType: typeof v.notes,
        quizType: typeof v.quiz,
      }))
    };
  },
});

// Mutation to fix videos with stringified JSON
export const fixStringifiedVideos = mutation({
  args: {},
  handler: async (ctx) => {
    const videos = await ctx.db.query("videos").collect();
    let fixedCount = 0;
    
    for (const video of videos) {
      let needsUpdate = false;
      let updatedNotes = video.notes;
      let updatedQuiz = video.quiz;
      
      // Check if notes is a string and parse it
      if (typeof video.notes === 'string') {
        try {
          updatedNotes = JSON.parse(video.notes);
          needsUpdate = true;
        } catch (e) {
          console.error(`Failed to parse notes for video ${video._id}:`, e);
        }
      }
      
      // Check if quiz is a string and parse it
      if (typeof video.quiz === 'string') {
        try {
          updatedQuiz = JSON.parse(video.quiz);
          needsUpdate = true;
        } catch (e) {
          console.error(`Failed to parse quiz for video ${video._id}:`, e);
        }
      }
      
      if (needsUpdate) {
        await ctx.db.patch(video._id, {
          notes: updatedNotes,
          quiz: updatedQuiz,
        });
        fixedCount++;
      }
    }
    
    return {
      totalVideos: videos.length,
      fixedVideos: fixedCount,
    };
  },
});

// Note: To regenerate notes and quizzes for existing videos, 
// you'll need to either:
// 1. Delete and recreate the courses (recommended)
// 2. Manually run the AI generation again for each video

// Query to check videos without status field
export const checkVideosWithoutStatus = query({
  args: {},
  handler: async (ctx) => {
    const videos = await ctx.db.query("videos").collect();
    
    const videosWithoutStatus = videos.filter(video => !video.status);
    
    return {
      total: videos.length,
      withoutStatus: videosWithoutStatus.length,
      videos: videosWithoutStatus.map(v => ({
        id: v._id,
        title: v.title,
        createdAt: v.createdAt,
      }))
    };
  },
});

// Mutation to add default status to existing videos
export const addDefaultStatusToVideos = mutation({
  args: {},
  handler: async (ctx) => {
    const videos = await ctx.db.query("videos").collect();
    let updatedCount = 0;
    
    for (const video of videos) {
      if (!video.status) {
        await ctx.db.patch(video._id, {
          status: "completed", // Existing videos are already processed
          updatedAt: Date.now(),
        });
        updatedCount++;
      }
    }
    
    return {
      totalVideos: videos.length,
      updatedVideos: updatedCount,
    };
  },
});

// Mutation to migrate chapters with videoId to content items
export const migrateChaptersToContentItems = mutation({
  args: {},
  handler: async (ctx) => {
    const chapters = await ctx.db.query("chapters").collect();
    let migratedCount = 0;
    
    for (const chapter of chapters) {
      // Check if chapter has a videoId but no content items
      if (chapter.videoId) {
        const existingContentItems = await ctx.db
          .query("contentItems")
          .withIndex("by_chapterId", (q) => q.eq("chapterId", chapter._id))
          .collect();
        
        // Only migrate if there are no content items yet
        if (existingContentItems.length === 0) {
          const video = await ctx.db.get(chapter.videoId);
          
          if (video) {
            // Create a content item for this video
            await ctx.db.insert("contentItems", {
              chapterId: chapter._id,
              type: "video",
              title: video.title,
              order: 1,
              videoId: chapter.videoId,
              createdAt: Date.now(),
            });
            migratedCount++;
          }
        }
      }
    }
    
    return {
      totalChapters: chapters.length,
      migratedChapters: migratedCount,
      message: `Successfully migrated ${migratedCount} chapters to use content items`,
    };
  },
});

/**
 * Manual migration to fix content items grading status for a specific course
 * Run this from Convex dashboard if you need to fix a course's content items
 */
export const fixCourseContentItemsGrading = mutation({
  args: {
    courseId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    // Get the course
    const course = await ctx.db.get(args.courseId);
    if (!course) {
      throw new Error("Course not found");
    }

    console.log(`Fixing content items for course: ${course.name}`);
    console.log(`Course is certification: ${course.isCertification}`);

    // Get all chapters for this course
    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
      .collect();

    let updatedCount = 0;
    const updates: Array<{ itemId: string; title: string; wasGraded: boolean; nowGraded: boolean }> = [];

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
          
          updates.push({
            itemId: item._id,
            title: item.title,
            wasGraded: item.isGraded ?? false,
            nowGraded: shouldBeGraded,
          });
          
          updatedCount++;
        }
      }
    }

    console.log(`Updated ${updatedCount} content items`);
    console.log('Updates:', updates);

    return {
      success: true,
      updatedCount,
      updates,
      message: `Updated ${updatedCount} content items for course "${course.name}"`,
    };
  },
});

/**
 * Fix progress records to match content items' grading status
 * This updates the isGradedItem field in progress records
 */
export const fixProgressRecordsGradingStatus = mutation({
  args: {
    courseId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    // Get all progress records (we'll filter by courseId)
    const allProgress = await ctx.db.query("progress").collect();
    const progressRecords = allProgress.filter(p => p.courseId === args.courseId);

    let updatedCount = 0;
    const updates: Array<{ progressId: string; contentItemId: string; wasGraded: boolean; nowGraded: boolean }> = [];

    for (const progress of progressRecords) {
      if (progress.contentItemId) {
        // Get the content item to check its current grading status
        const contentItem = await ctx.db.get(progress.contentItemId);
        
        if (contentItem && progress.isGradedItem !== contentItem.isGraded) {
          await ctx.db.patch(progress._id, {
            isGradedItem: contentItem.isGraded ?? false,
          });

          updates.push({
            progressId: progress._id,
            contentItemId: progress.contentItemId,
            wasGraded: progress.isGradedItem ?? false,
            nowGraded: contentItem.isGraded ?? false,
          });

          updatedCount++;
        }
      }
    }

    console.log(`Updated ${updatedCount} progress records`);
    console.log('Updates:', updates);

    return {
      success: true,
      updatedCount,
      updates,
      message: `Updated ${updatedCount} progress records`,
    };
  },
});

/**
 * Complete migration - fix both content items and progress records
 */
export const fixCourseCertificationComplete = mutation({
  args: {
    courseId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.courseId);
    if (!course) {
      throw new Error("Course not found");
    }

    console.log(`=== Starting complete certification fix for course: ${course.name} ===`);

    // Step 1: Fix content items
    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
      .collect();

    let contentItemsUpdated = 0;

    for (const chapter of chapters) {
      const contentItems = await ctx.db
        .query("contentItems")
        .withIndex("by_chapterId", (q) => q.eq("chapterId", chapter._id))
        .collect();

      for (const item of contentItems) {
        let shouldBeGraded: boolean;

        if (course.isCertification) {
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

        if (item.isGraded !== shouldBeGraded) {
          await ctx.db.patch(item._id, {
            isGraded: shouldBeGraded,
            maxPoints: shouldBeGraded ? (item.maxPoints ?? 100) : undefined,
            passingScore: shouldBeGraded
              ? (item.passingScore ?? course.passingGrade ?? 70)
              : undefined,
          });
          contentItemsUpdated++;
        }
      }
    }

    console.log(`Step 1: Updated ${contentItemsUpdated} content items`);

    // Step 2: Fix progress records - clean up invalid data
    const allProgress = await ctx.db.query("progress").collect();
    const progressRecords = allProgress.filter(p => p.courseId === args.courseId);

    let progressUpdated = 0;

    for (const progress of progressRecords) {
      if (progress.contentItemId) {
        const contentItem = await ctx.db.get(progress.contentItemId);
        
        if (contentItem) {
          // Check if this progress record is valid
          const hasScore = progress.score !== undefined && progress.score !== null;
          const isGradedItem = contentItem.isGraded ?? false;
          
          // Determine if item should be marked as completed
          let shouldBeCompleted: boolean;
          let shouldBePassed: boolean | undefined;
          
          if (isGradedItem) {
            // Graded items: only completed if they have a score and passed
            if (hasScore) {
              const percentage = progress.percentage ?? ((progress.score ?? 0) / (progress.maxScore ?? 100)) * 100;
              const passingScore = contentItem.passingScore ?? 70;
              shouldBePassed = percentage >= passingScore;
              shouldBeCompleted = shouldBePassed;
            } else {
              // No score = not attempted = not completed
              shouldBeCompleted = false;
              shouldBePassed = undefined;
            }
          } else {
            // Non-graded items: completed if they have any progress record
            // (they were marked complete when viewed)
            shouldBeCompleted = progress.completed ?? false;
            shouldBePassed = undefined;
          }
          
          // Update if needed
          const needsUpdate = 
            progress.isGradedItem !== isGradedItem ||
            progress.completed !== shouldBeCompleted ||
            (shouldBePassed !== undefined && progress.passed !== shouldBePassed);
          
          if (needsUpdate) {
            const updates: {
              isGradedItem: boolean;
              completed: boolean;
              passed?: boolean;
              completedAt?: number;
            } = {
              isGradedItem,
              completed: shouldBeCompleted,
            };
            
            if (shouldBePassed !== undefined) {
              updates.passed = shouldBePassed;
            }
            
            // If not completed, clear completion timestamp
            if (!shouldBeCompleted && progress.completedAt) {
              updates.completedAt = undefined;
            }
            
            await ctx.db.patch(progress._id, updates);
            progressUpdated++;
          }
        }
      }
    }

    console.log(`Step 2: Updated ${progressUpdated} progress records`);
    console.log(`=== Complete! ===`);

    return {
      success: true,
      courseName: course.name,
      contentItemsUpdated,
      progressRecordsUpdated: progressUpdated,
      message: `Fixed ${contentItemsUpdated} content items and ${progressUpdated} progress records for "${course.name}"`,
    };
  },
});
