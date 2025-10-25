import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

/**
 * =============================================================================
 * UNIFIED COMPLETION SYSTEM
 * =============================================================================
 * This module replaces the fragmented logic from progress.ts with a clean,
 * unified approach to handling all types of content completion.
 * 
 * Key improvements:
 * 1. Single entry point for all completions (recordCompletion)
 * 2. Clear separation between "completed" (attempted) and "passed" (scored well)
 * 3. Proper bestScore tracking across attempts
 * 4. Validation at entry point
 * 5. Async certificate checking (doesn't block user)
 * =============================================================================
 */

/**
 * Main mutation to record any type of content completion
 * Handles: videos, text, quizzes, assignments, resources
 */
export const recordCompletion = mutation({
  args: {
    userId: v.id("users"),
    contentItemId: v.id("contentItems"),
    // For quizzes and assignments
    score: v.optional(v.number()),
    maxScore: v.optional(v.number()),
    answers: v.optional(v.any()), // Quiz answers for quizAttempts table
    // For tracking time (optional)
    timeSpent: v.optional(v.number()),
    // For granular progress (optional, e.g., video watch percentage)
    progressPercentage: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // 1. Validate user exists
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // 2. Get content item with all related data
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

    // 3. Validate enrollment
    const enrollment = await ctx.db
      .query("enrollments")
      .withIndex("by_userId_courseId", (q) =>
        q.eq("userId", args.userId).eq("courseId", chapter.courseId)
      )
      .first();

    if (!enrollment || enrollment.status !== "active") {
      throw new Error("User is not enrolled in this course");
    }

    // 4. Validate score if provided
    if (args.score !== undefined) {
      const maxScore = args.maxScore ?? contentItem.maxPoints ?? 100;
      
      if (args.score < 0) {
        throw new Error("Score cannot be negative");
      }
      
      if (args.score > maxScore) {
        throw new Error(`Score (${args.score}) cannot exceed maxScore (${maxScore})`);
      }
    }

    // 5. Record quiz attempt if this is a quiz with answers
    let attemptId: Id<"quizAttempts"> | undefined;
    if (contentItem.type === "quiz" && args.answers && args.score !== undefined) {
      attemptId = await recordQuizAttempt(ctx, {
        userId: args.userId,
        contentItemId: args.contentItemId,
        courseId: chapter.courseId,
        answers: args.answers,
        score: args.score,
        maxScore: args.maxScore ?? contentItem.maxPoints ?? 100,
        timeSpent: args.timeSpent ?? 0,
      });
    }

    // 6. Update or create progress record
    await updateOrCreateProgress(ctx, {
      userId: args.userId,
      courseId: chapter.courseId,
      chapterId: chapter._id,
      contentItemId: args.contentItemId,
      contentItem: contentItem,
      score: args.score,
      maxScore: args.maxScore,
      progressPercentage: args.progressPercentage,
    });

    // 7. Trigger async certificate check (if certification course)
    if (course.isCertification) {
      await ctx.scheduler.runAfter(0, internal.certificates.checkEligibility, {
        userId: args.userId,
        courseId: chapter.courseId,
      });
    }

    return {
      success: true,
      attemptId,
      message: "Completion recorded successfully",
    };
  },
});

/**
 * Helper: Record a quiz attempt in the quizAttempts table
 */
async function recordQuizAttempt(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    contentItemId: Id<"contentItems">;
    courseId: Id<"courses">;
    answers: unknown;
    score: number;
    maxScore: number;
    timeSpent: number;
  }
): Promise<Id<"quizAttempts">> {
  // Get existing attempts to determine attempt number
  const existingAttempts = await ctx.db
    .query("quizAttempts")
    .withIndex("by_userId_contentItemId", (q) =>
      q.eq("userId", args.userId).eq("contentItemId", args.contentItemId)
    )
    .collect();

  const attemptNumber = existingAttempts.length + 1;
  const percentage = (args.score / args.maxScore) * 100;

  // Get content item to check passing score
  const contentItem = await ctx.db.get(args.contentItemId);
  const passingScore = contentItem?.passingScore ?? 70;
  const passed = percentage >= passingScore;

  const now = Date.now();

  return await ctx.db.insert("quizAttempts", {
    userId: args.userId,
    contentItemId: args.contentItemId,
    courseId: args.courseId,
    attemptNumber,
    answers: args.answers,
    score: args.score,
    maxScore: args.maxScore,
    percentage,
    passed,
    startedAt: now, // TODO: Pass actual start time from frontend
    completedAt: now,
    timeSpent: args.timeSpent,
  });
}

/**
 * Helper: Update or create progress record
 * Key logic: completed = attempted (always true once user tries)
 *           passed = scored above threshold (separate field)
 */
async function updateOrCreateProgress(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    courseId: Id<"courses">;
    chapterId: Id<"chapters">;
    contentItemId: Id<"contentItems">;
    contentItem: {
      isGraded?: boolean;
      maxPoints?: number;
      passingScore?: number;
    };
    score?: number;
    maxScore?: number;
    progressPercentage?: number;
  }
): Promise<void> {
  // Get existing progress
  const existingProgress = await ctx.db
    .query("progress")
    .withIndex("by_userId_courseId_contentItemId", (q) =>
      q
        .eq("userId", args.userId)
        .eq("courseId", args.courseId)
        .eq("contentItemId", args.contentItemId)
    )
    .first();

  const isGraded = args.contentItem.isGraded ?? false;
  const now = Date.now();

  // Calculate score and passing status if score provided
  let percentage: number | undefined;
  let passed: boolean | undefined;
  let bestScore: number | undefined;

  if (args.score !== undefined && isGraded) {
    const maxScore = args.maxScore ?? args.contentItem.maxPoints ?? 100;
    percentage = (args.score / maxScore) * 100;
    const passingScore = args.contentItem.passingScore ?? 70;
    passed = percentage >= passingScore;

    // Calculate best score
    if (existingProgress) {
      bestScore = Math.max(existingProgress.bestScore ?? 0, percentage);
    } else {
      bestScore = percentage;
    }
  }

  // Determine progress percentage (for granular tracking like video watch %)
  const itemProgressPercentage = args.progressPercentage ?? 100;

  if (existingProgress) {
    // Update existing progress
    const baseUpdates = {
      completed: true, // ✅ Always mark as completed once attempted
      completedAt: existingProgress.completedAt ?? now, // Keep original completion time
      lastAttemptAt: now,
      attempts: (existingProgress.attempts ?? 0) + 1,
      progressPercentage: Math.max(
        existingProgress.progressPercentage ?? 0,
        itemProgressPercentage
      ),
    };

    // Add score data if this is a graded item
    const updates = isGraded && args.score !== undefined
      ? {
          ...baseUpdates,
          score: args.score,
          maxScore: args.maxScore ?? args.contentItem.maxPoints ?? 100,
          percentage: percentage,
          passed: passed,
          bestScore: bestScore,
        }
      : baseUpdates;

    await ctx.db.patch(existingProgress._id, updates);
  } else {
    // Create new progress record
    const baseProgress = {
      userId: args.userId,
      courseId: args.courseId,
      chapterId: args.chapterId,
      contentItemId: args.contentItemId,
      completed: true, // ✅ Always true on first attempt
      completedAt: now,
      lastAttemptAt: now,
      attempts: 1,
      progressPercentage: itemProgressPercentage,
    };

    // Add score data if this is a graded item
    const newProgress = isGraded && args.score !== undefined
      ? {
          ...baseProgress,
          score: args.score,
          maxScore: args.maxScore ?? args.contentItem.maxPoints ?? 100,
          percentage: percentage,
          passed: passed,
          bestScore: bestScore,
        }
      : baseProgress;

    await ctx.db.insert("progress", newProgress);
  }
}

/**
 * =============================================================================
 * QUERIES - Progress and attempt history
 * =============================================================================
 */

/**
 * Get quiz attempt history for a specific content item
 */
export const getQuizAttemptHistory = query({
  args: {
    userId: v.id("users"),
    contentItemId: v.id("contentItems"),
  },
  handler: async (ctx, args) => {
    const attempts = await ctx.db
      .query("quizAttempts")
      .withIndex("by_userId_contentItemId", (q) =>
        q.eq("userId", args.userId).eq("contentItemId", args.contentItemId)
      )
      .collect();

    // Sort by completion date descending (most recent first)
    return attempts.sort((a, b) => b.completedAt - a.completedAt);
  },
});

/**
 * Get progress for a specific content item
 */
export const getContentItemProgress = query({
  args: {
    userId: v.id("users"),
    contentItemId: v.id("contentItems"),
  },
  handler: async (ctx, args) => {
    const progress = await ctx.db
      .query("progress")
      .withIndex("by_userId_contentItemId", (q) =>
        q.eq("userId", args.userId).eq("contentItemId", args.contentItemId)
      )
      .first();

    return progress;
  },
});

/**
 * Calculate overall course progress for a user
 * Returns completion percentage and grade for certification courses
 */
export const calculateCourseProgress = query({
  args: {
    courseId: v.id("courses"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.courseId);
    if (!course) {
      throw new Error("Course not found");
    }

    // Get all chapters for this course
    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
      .collect();

    // Get all content items for these chapters
    const allContentItems = await Promise.all(
      chapters.map((chapter) =>
        ctx.db
          .query("contentItems")
          .withIndex("by_chapterId", (q) => q.eq("chapterId", chapter._id))
          .collect()
      )
    );

    const contentItems = allContentItems.flat();
    const totalItems = contentItems.length;

    if (totalItems === 0) {
      return {
        courseId: args.courseId,
        totalItems: 0,
        completedItems: 0,
        completionPercentage: 0,
        isCertification: course.isCertification,
        gradedItems: 0,
        passedGradedItems: 0,
        overallGrade: null,
        eligibleForCertificate: false,
      };
    }

    // Get user's progress for all items
    const progressRecords = await ctx.db
      .query("progress")
      .withIndex("by_userId_courseId", (q) =>
        q.eq("userId", args.userId).eq("courseId", args.courseId)
      )
      .collect();

    // Count completed items (attempted = completed)
    const completedItems = progressRecords.filter((p) => p.completed).length;
    const completionPercentage = (completedItems / totalItems) * 100;

    // Calculate grading info for certification courses
    const gradingInfo = {
      gradedItems: 0,
      passedGradedItems: 0,
      overallGrade: null as number | null,
      eligibleForCertificate: false,
    };

    if (course.isCertification) {
      // Get graded content items
      const gradedContentItems = contentItems.filter((item) => item.isGraded);
      const gradedItemIds = new Set(gradedContentItems.map((item) => item._id));

      // Get progress for graded items only
      const gradedProgress = progressRecords.filter(
        (p) => p.contentItemId && gradedItemIds.has(p.contentItemId)
      );

      gradingInfo.gradedItems = gradedContentItems.length;
      gradingInfo.passedGradedItems = gradedProgress.filter((p) => p.passed).length;

      // Calculate overall grade using bestScore and proper weighting
      if (gradedProgress.length > 0) {
        let totalPossiblePoints = 0;
        let totalEarnedPoints = 0;

        for (const progress of gradedProgress) {
          const contentItem = contentItems.find((item) => item._id === progress.contentItemId);
          const maxPoints = contentItem?.maxPoints ?? 100;
          
          totalPossiblePoints += maxPoints;
          
          // Use bestScore for grading (highest score across attempts)
          const bestPercentage = progress.bestScore ?? 0;
          totalEarnedPoints += (bestPercentage / 100) * maxPoints;
        }

        if (totalPossiblePoints > 0) {
          gradingInfo.overallGrade = (totalEarnedPoints / totalPossiblePoints) * 100;
        }
      }

      // Check certificate eligibility
      const passingGrade = course.passingGrade ?? 70;
      gradingInfo.eligibleForCertificate =
        gradingInfo.gradedItems > 0 &&
        gradedProgress.length === gradingInfo.gradedItems && // All graded items attempted
        gradingInfo.passedGradedItems === gradingInfo.gradedItems && // All passed
        (gradingInfo.overallGrade ?? 0) >= passingGrade; // Overall grade meets threshold
    }

    return {
      courseId: args.courseId,
      totalItems,
      completedItems,
      completionPercentage,
      isCertification: course.isCertification,
      ...gradingInfo,
    };
  },
});

/**
 * Get detailed progress for a user in a course
 */
export const getCourseProgress = query({
  args: {
    userId: v.id("users"),
    courseId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    // Get all progress records for this course
    const progressRecords = await ctx.db
      .query("progress")
      .withIndex("by_userId_courseId", (q) =>
        q.eq("userId", args.userId).eq("courseId", args.courseId)
      )
      .collect();

    // Get course details
    const course = await ctx.db.get(args.courseId);
    if (!course) {
      throw new Error("Course not found");
    }

    // Check if user has a certificate
    const certificate = await ctx.db
      .query("certificates")
      .withIndex("by_userId_courseId", (q) =>
        q.eq("userId", args.userId).eq("courseId", args.courseId)
      )
      .first();

    return {
      progress: progressRecords,
      hasCertificate: !!certificate,
      certificate: certificate,
    };
  },
});


