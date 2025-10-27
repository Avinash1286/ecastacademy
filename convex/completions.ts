import { v } from "convex/values";
import { mutation, query, MutationCtx, internalMutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { summarizeProgressByContentItem, isTrackableContentItem, mapVideosById } from "./utils/progressUtils";

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

    if (
      !enrollment ||
      (enrollment.status !== "active" && enrollment.status !== "completed")
    ) {
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

    // 5. Record quiz attempt whenever we have answer data and a score
    let attemptId: Id<"quizAttempts"> | undefined;
    const hasAnswersArray = Array.isArray(args.answers) && args.answers.length > 0;
    const hasScore = args.score !== undefined;

    if (hasAnswersArray && hasScore) {
      const answerCount = (args.answers as unknown[]).length;
      const maxScoreForAttempt = args.maxScore ?? contentItem.maxPoints ?? (answerCount > 0 ? answerCount : 100);
      const attemptScore = args.score ?? 0;

      attemptId = await recordQuizAttempt(ctx, {
        userId: args.userId,
        contentItemId: args.contentItemId,
        courseId: chapter.courseId,
        answers: args.answers,
        score: attemptScore,
        maxScore: maxScoreForAttempt,
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
 * Helper: Update or create progress record and keep derived state stable across retakes.
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
      allowRetakes?: boolean;
      type?: string;
    };
    score?: number;
    maxScore?: number;
    progressPercentage?: number;
  }
): Promise<void> {
  const course = await ctx.db.get(args.courseId);
  if (!course) {
    throw new Error("Course not found while updating progress");
  }

  const isCertificationCourse = course.isCertification ?? false;
  const defaultPassingScore = course.passingGrade ?? 70;

  const existingRecords = await ctx.db
    .query("progress")
    .withIndex("by_userId_courseId_contentItemId", (q) =>
      q
        .eq("userId", args.userId)
        .eq("courseId", args.courseId)
        .eq("contentItemId", args.contentItemId)
    )
    .collect();

  const summaries = summarizeProgressByContentItem(existingRecords);
  const summary = summaries.get(args.contentItemId);
  const existingProgress = summary?.canonical;
  const duplicateRecords = summary
    ? summary.entries.filter((entry) => entry._id !== summary.canonical._id)
    : [];

  if (duplicateRecords.length > 0) {
    for (const duplicate of duplicateRecords) {
      await ctx.db.delete(duplicate._id);
    }
  }

  if (existingProgress && args.contentItem.allowRetakes === false) {
    throw new Error("Retakes are not allowed for this content item");
  }

  const isGraded = args.contentItem.isGraded ?? false;
  const now = Date.now();
  const passingScore = args.contentItem.passingScore ?? defaultPassingScore;
  const maxScore = args.maxScore ?? args.contentItem.maxPoints ?? 100;

  let percentage: number | undefined;
  let latestPassed: boolean | undefined;

  if (args.score !== undefined) {
    if (maxScore <= 0) {
      throw new Error("maxScore must be greater than zero");
    }
    percentage = (args.score / maxScore) * 100;
    latestPassed = percentage >= passingScore;
  }

  const previousBestPercentage =
    summary?.bestPercentage ??
    existingProgress?.bestScore ??
    (typeof existingProgress?.percentage === "number" ? existingProgress.percentage : 0);

  const bestPercentage =
    percentage !== undefined
      ? Math.max(previousBestPercentage, percentage)
      : previousBestPercentage;

  const everPassed = isGraded
    ? bestPercentage >= passingScore
    : (existingProgress?.passed ?? true);

  const previousProgressPercentage =
    summary?.progressPercentage ?? existingProgress?.progressPercentage ?? 0;
  const itemProgressPercentage = args.progressPercentage ?? 100;

  const newCompletedStatus =
    isGraded && isCertificationCourse
      ? (summary?.completed ?? existingProgress?.completed ?? false) || everPassed
      : true;

  const progressPercentageValue = Math.max(
    previousProgressPercentage,
    newCompletedStatus
      ? itemProgressPercentage
      : (args.progressPercentage ?? previousProgressPercentage)
  );

  const updatedAttempts = (existingProgress?.attempts ?? summary?.attempts ?? 0) + 1;

  if (existingProgress) {
    const updates: Partial<Doc<"progress">> = {
      completed: newCompletedStatus,
      completedAt: newCompletedStatus
        ? existingProgress.completedAt ?? summary?.completedAt ?? now
        : existingProgress.completedAt,
      lastAttemptAt: now,
      attempts: updatedAttempts,
      progressPercentage: progressPercentageValue,
      isGradedItem: isGraded,
      passed: isGraded ? everPassed : (existingProgress.passed ?? true),
      latestPassed: isGraded
        ? (typeof latestPassed === "boolean"
            ? latestPassed
            : existingProgress.latestPassed ?? summary?.latestPassed)
        : existingProgress.latestPassed,
      bestScore: bestPercentage,
    };

    if (args.score !== undefined) {
      updates.score = args.score;
      updates.maxScore = maxScore;
      updates.percentage = percentage;
    }

    await ctx.db.patch(existingProgress._id, updates);
  } else {
    await ctx.db.insert("progress", {
      userId: args.userId,
      courseId: args.courseId,
      chapterId: args.chapterId,
      contentItemId: args.contentItemId,
      completed: newCompletedStatus,
      completedAt: newCompletedStatus ? now : undefined,
      lastAttemptAt: now,
      attempts: 1,
      progressPercentage: newCompletedStatus
        ? itemProgressPercentage
        : args.progressPercentage ?? 0,
      isGradedItem: isGraded,
      score: args.score,
      maxScore: args.score !== undefined ? maxScore : undefined,
      percentage,
      passed: isGraded ? everPassed : true,
      latestPassed: isGraded ? latestPassed : undefined,
      bestScore: bestPercentage,
    });
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

    const coursePassingGrade = course.passingGrade ?? 70;

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

    const videoIds = Array.from(
      new Set(
        contentItems
          .filter((item) => item.type === "video" && item.videoId)
          .map((item) => item.videoId as Id<"videos">)
      )
    );

    const videoDocs = await Promise.all(videoIds.map((videoId) => ctx.db.get(videoId)));
    const videoLookup = mapVideosById(videoIds, videoDocs);

    const trackableItems = contentItems.filter((item) =>
      isTrackableContentItem(item, videoLookup)
    );

    const totalItems = trackableItems.length;

    if (totalItems === 0) {
      return {
        courseId: args.courseId,
        totalItems: 0,
        completedItems: 0,
        completionPercentage: 100,
        isCertification: course.isCertification,
        gradedItems: 0,
        passedGradedItems: 0,
        overallGrade: null,
        eligibleForCertificate: false,
        hasCertificate: false,
        requirementsMet: false,
        passingGrade: coursePassingGrade,
      };
    }

    // Get user's progress for all items
    const progressRecords = await ctx.db
      .query("progress")
      .withIndex("by_userId_courseId", (q) =>
        q.eq("userId", args.userId).eq("courseId", args.courseId)
      )
      .collect();

    const progressSummaryMap = summarizeProgressByContentItem(progressRecords);

    const completedItems = trackableItems.reduce((count, item) => {
      const summary = progressSummaryMap.get(item._id);
      return summary?.completed ? count + 1 : count;
    }, 0);
    const completionPercentage = totalItems > 0
      ? (completedItems / totalItems) * 100
      : 100;

    const existingCertificate = await ctx.db
      .query("certificates")
      .withIndex("by_userId_courseId", (q) =>
        q.eq("userId", args.userId).eq("courseId", args.courseId)
      )
      .first();

    const hasCertificate = !!existingCertificate;

    const gradingInfo = {
      gradedItems: 0,
      passedGradedItems: 0,
      overallGrade: null as number | null,
      eligibleForCertificate: hasCertificate,
      hasCertificate,
      requirementsMet: false,
    };

    if (course.isCertification) {
  const gradedContentItems = trackableItems.filter((item) => item.isGraded);
      gradingInfo.gradedItems = gradedContentItems.length;

      let totalPossiblePoints = 0;
      let totalEarnedPoints = 0;
      let attemptedGradedItems = 0;
      let passedGradedItems = 0;

      for (const item of gradedContentItems) {
        const summary = progressSummaryMap.get(item._id);
        if (!summary) {
          continue;
        }

        attemptedGradedItems += 1;

        const maxPoints = item.maxPoints ?? 100;
        const bestPercentage = summary.bestPercentage ?? 0;
        totalPossiblePoints += maxPoints;
        totalEarnedPoints += (bestPercentage / 100) * maxPoints;

        const itemPassingScore = item.passingScore ?? course.passingGrade ?? 70;
        if (bestPercentage >= itemPassingScore) {
          passedGradedItems += 1;
        }
      }

      gradingInfo.passedGradedItems = passedGradedItems;

      if (totalPossiblePoints > 0) {
        gradingInfo.overallGrade = (totalEarnedPoints / totalPossiblePoints) * 100;
      }

      const requirementsMet =
        gradingInfo.gradedItems > 0 &&
        attemptedGradedItems === gradingInfo.gradedItems &&
        passedGradedItems === gradingInfo.gradedItems &&
        (gradingInfo.overallGrade ?? 0) >= coursePassingGrade;

      gradingInfo.requirementsMet = requirementsMet;
      gradingInfo.eligibleForCertificate = hasCertificate || requirementsMet;
    }

    return {
      courseId: args.courseId,
      totalItems,
      completedItems,
      completionPercentage,
      isCertification: course.isCertification,
      ...gradingInfo,
      passingGrade: coursePassingGrade,
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

/**
 * =============================================================================
 * MIGRATION & COURSE TYPE TRANSITION UTILITIES
 * =============================================================================
 */

/**
 * Recalculate progress for a course when it transitions between graded/ungraded
 * This ensures data consistency when course settings change
 * 
 * Use cases:
 * - Course switches from certification to non-certification
 * - Content items change from graded to ungraded or vice versa
 * - Admin needs to fix inconsistent progress data
 */
async function recalcCourseProgressCore(
  ctx: MutationCtx,
  args: {
    courseId: Id<"courses">;
    userId?: Id<"users">;
  }
) {
    const course = await ctx.db.get(args.courseId);
    if (!course) {
      throw new Error("Course not found");
    }

    // Get all chapters
    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
      .collect();

    // Get all content items
    const allContentItems = await Promise.all(
      chapters.map((chapter) =>
        ctx.db
          .query("contentItems")
          .withIndex("by_chapterId", (q) => q.eq("chapterId", chapter._id))
          .collect()
      )
    );
    const contentItems = allContentItems.flat();

    // Get users to recalculate for
    let progressRecords;
    if (args.userId) {
      progressRecords = await ctx.db
        .query("progress")
        .withIndex("by_userId_courseId", (q) =>
          q.eq("userId", args.userId as Id<"users">).eq("courseId", args.courseId)
        )
        .collect();
    } else {
      progressRecords = await ctx.db
        .query("progress")
        .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
        .collect();
    }

    let updatedCount = 0;
    let dedupedCount = 0;

    const progressByUser = new Map<Id<"users">, typeof progressRecords>();
    for (const record of progressRecords) {
      const list = progressByUser.get(record.userId);
      if (list) {
        list.push(record);
      } else {
        progressByUser.set(record.userId, [record]);
      }
    }

    const isCertificationCourse = course.isCertification ?? false;
    const coursePassingGrade = course.passingGrade ?? 70;

    for (const records of progressByUser.values()) {
      const summaries = summarizeProgressByContentItem(records);

      for (const summary of summaries.values()) {
        const contentItem = contentItems.find((item) => item._id === summary.contentItemId);
        if (!contentItem) {
          continue;
        }

        const isGraded = contentItem.isGraded ?? false;
        const passingScore = contentItem.passingScore ?? coursePassingGrade;
        const bestPercentage = summary.bestPercentage ?? 0;
        const everPassed = isGraded ? bestPercentage >= passingScore : true;

        const shouldBeCompleted = isGraded && isCertificationCourse
          ? (summary.canonical.completed || everPassed)
          : summary.completed || summary.attempts > 0;

        const desiredCompletedAt = shouldBeCompleted
          ? summary.canonical.completedAt ?? summary.completedAt ?? summary.lastActivityAt ?? Date.now()
          : undefined;

        const duplicates = summary.entries.filter((entry) => entry._id !== summary.canonical._id);
        for (const duplicate of duplicates) {
          await ctx.db.delete(duplicate._id);
          dedupedCount++;
        }

        const updates: Partial<Doc<"progress">> = {
          completed: shouldBeCompleted,
          completedAt: shouldBeCompleted ? desiredCompletedAt : undefined,
          isGradedItem: isGraded,
          passed: isGraded ? everPassed : (summary.canonical.passed ?? true),
          latestPassed: isGraded ? summary.latestPassed ?? (everPassed ? true : false) : summary.canonical.latestPassed,
          bestScore: bestPercentage,
          attempts: summary.attempts,
          progressPercentage: summary.progressPercentage,
          lastAttemptAt: summary.lastActivityAt,
        };

        if (summary.latestScore !== undefined) {
          updates.score = summary.latestScore;
        }

        if (summary.latestPercentage !== undefined) {
          updates.percentage = summary.latestPercentage;
        }

        const needsUpdate =
          updates.completed !== summary.canonical.completed ||
          (updates.completedAt ?? null) !== (summary.canonical.completedAt ?? null) ||
          (updates.isGradedItem ?? null) !== (summary.canonical.isGradedItem ?? null) ||
          (updates.passed ?? null) !== (summary.canonical.passed ?? null) ||
          (updates.latestPassed ?? null) !== (summary.canonical.latestPassed ?? null) ||
          (updates.bestScore ?? null) !== (summary.canonical.bestScore ?? null) ||
          (updates.attempts ?? null) !== (summary.canonical.attempts ?? null) ||
          (updates.progressPercentage ?? null) !== (summary.canonical.progressPercentage ?? null) ||
          (updates.lastAttemptAt ?? null) !== (summary.canonical.lastAttemptAt ?? null) ||
          (summary.latestScore !== undefined && (updates.score ?? null) !== (summary.canonical.score ?? null)) ||
          (summary.latestPercentage !== undefined && (updates.percentage ?? null) !== (summary.canonical.percentage ?? null));

        if (needsUpdate) {
          await ctx.db.patch(summary.canonical._id, updates);
          updatedCount++;
        }
      }
    }

    return {
      success: true,
      updatedRecords: updatedCount,
      removedDuplicates: dedupedCount,
      totalRecords: progressRecords.length,
      message: `Recalculated progress for ${updatedCount} records (removed ${dedupedCount} duplicates)`,
    };
  }

export const recalculateCourseProgress = internalMutation({
  args: {
    courseId: v.id("courses"),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    return await recalcCourseProgressCore(ctx, args);
  },
});

export async function recalculateCourseProgressSync(
  ctx: MutationCtx,
  args: {
    courseId: Id<"courses">;
    userId?: Id<"users">;
  }
) {
  return await recalcCourseProgressCore(ctx, args);
}


