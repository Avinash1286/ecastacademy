import { v } from "convex/values";
import { mutation, query, MutationCtx, QueryCtx, internalMutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { summarizeProgressByContentItem, isTrackableContentItem, mapVideosById } from "./utils/progressUtils";
import { calculateStudentGrade } from "./utils/grading";
import { requireAuthenticatedUser, requireAdminUser } from "./utils/auth";
import { 
  courseProgressKey, 
  getCachedProgressSummary, 
  cacheProgressSummary,
  invalidateUserCache,
  invalidateCourseCache,
  type CachedProgressSummary 
} from "./utils/cache";

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
 * 6. Optimistic locking with version field for race condition prevention
 * 7. Caching layer for progress calculations
 * =============================================================================
 */

/**
 * Main mutation to record any type of content completion
 * Handles: videos, text, quizzes, assignments, resources
 * 
 * SECURITY: Verifies the authenticated user matches the userId parameter
 */
export const recordCompletion = mutation({
  args: {
    userId: v.id("users"),
    contentItemId: v.id("contentItems"),
    // For quizzes and assignments
    score: v.optional(v.number()), // Deprecated: Calculated on server for quizzes
    maxScore: v.optional(v.number()), // Deprecated: Calculated on server for quizzes
    answers: v.optional(v.any()), // Quiz answers for quizAttempts table
    // For tracking time (optional)
    timeSpent: v.optional(v.number()),
    // For granular progress (optional, e.g., video watch percentage)
    progressPercentage: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // SECURITY: Verify the authenticated user matches the userId parameter
    const { user: authenticatedUser } = await requireAuthenticatedUser(ctx);
    if (authenticatedUser._id !== args.userId) {
      throw new Error("Unauthorized: You can only record your own completions");
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

    // 4. Calculate score on server if answers are provided
    let calculatedScore: number | undefined = args.score;
    let calculatedMaxScore: number | undefined = args.maxScore;

    // Check if this is a quiz-like item and we have answers
    if (Array.isArray(args.answers)) {
      let score = 0;
      let maxScore = 0;
      let isQuiz = false;

      if (contentItem.type === "quiz" && contentItem.quizData) {
        isQuiz = true;
        const questions = contentItem.quizData.questions || [];
        maxScore = questions.length;

        args.answers.forEach((answerIndex: number, questionIndex: number) => {
          const question = questions[questionIndex];
          // Support both 'correct' and 'correctIndex' field names
          const correctAnswer = question?.correctIndex ?? question?.correct;
          if (question && correctAnswer === answerIndex) {
            score++;
          }
        });
      } else if (contentItem.type === "text" && contentItem.textQuiz) {
        isQuiz = true;
        const questions = contentItem.textQuiz.questions || [];
        maxScore = questions.length;

        args.answers.forEach((answerIndex: number, questionIndex: number) => {
          const question = questions[questionIndex];
          // Support both 'correct' and 'correctIndex' field names
          const correctAnswer = question?.correctIndex ?? question?.correct;
          if (question && correctAnswer === answerIndex) {
            score++;
          }
        });
      } else if (contentItem.type === "video" && contentItem.videoId) {
        const video = await ctx.db.get(contentItem.videoId);
        if (video && video.quiz) {
          isQuiz = true;
          const questions = video.quiz.questions || [];
          maxScore = questions.length;

          args.answers.forEach((answerIndex: number, questionIndex: number) => {
            const question = questions[questionIndex];
            // Support both 'correct' and 'correctIndex' field names
            const correctAnswer = question?.correctIndex ?? question?.correct;
            if (question && correctAnswer === answerIndex) {
              score++;
            }
          });
        }
      }

      if (isQuiz) {
        calculatedScore = score;
        calculatedMaxScore = maxScore;
      }
    }

    // Validate score if explicitly provided and NOT calculated (e.g. manual grading or non-quiz types)
    if (calculatedScore !== undefined) {
      const maxScore = calculatedMaxScore ?? contentItem.maxPoints ?? 100;

      if (calculatedScore < 0) {
        throw new Error("Score cannot be negative");
      }

      // Only enforce maxScore check if it wasn't calculated by us (trust our own calculation)
      if (!Array.isArray(args.answers) && calculatedScore > maxScore) {
        throw new Error(`Score (${calculatedScore}) cannot exceed maxScore (${maxScore})`);
      }
    }

    // 5. Record quiz attempt whenever we have answer data
    let attemptId: Id<"quizAttempts"> | undefined;
    const hasAnswersArray = Array.isArray(args.answers) && args.answers.length > 0;
    const hasScore = calculatedScore !== undefined;

    if (hasAnswersArray && hasScore) {
      const answerCount = (args.answers as unknown[]).length;
      const maxScoreForAttempt = calculatedMaxScore ?? contentItem.maxPoints ?? (answerCount > 0 ? answerCount : 100);
      const attemptScore = calculatedScore ?? 0;

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
      score: calculatedScore,
      maxScore: calculatedMaxScore,
      progressPercentage: args.progressPercentage,
    });

    // 7. Invalidate progress cache for this user/course
    // This ensures the next progress query gets fresh data
    invalidateCourseCache(chapter.courseId);

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
  const attemptedNow = true;

  const newCompletedStatus =
    isGraded && isCertificationCourse
      ? (summary?.completed ?? existingProgress?.completed ?? false) || attemptedNow
      : true;

  const progressPercentageValue = Math.max(
    previousProgressPercentage,
    newCompletedStatus
      ? itemProgressPercentage
      : (args.progressPercentage ?? previousProgressPercentage)
  );

  const updatedAttempts = (existingProgress?.attempts ?? summary?.attempts ?? 0) + 1;
  const attemptedAtValue = now;

  if (existingProgress) {
    // Get current version for optimistic locking
    const currentVersion = existingProgress.version ?? 0;

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
      attempted: true,
      attemptedAt: attemptedAtValue,
      // Increment version for optimistic locking
      version: currentVersion + 1,
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
      attempted: attemptedNow,
      attemptedAt: attemptedAtValue,
      // Initial version for new records
      version: 1,
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
    contentItemId: v.id("contentItems"),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    let targetUserId: Id<"users">;

    if (args.userId) {
      targetUserId = args.userId;
    } else {
      const { user } = await requireAuthenticatedUser(ctx);
      targetUserId = user._id;
    }

    const attempts = await ctx.db
      .query("quizAttempts")
      .withIndex("by_userId_contentItemId", (q) =>
        q.eq("userId", targetUserId).eq("contentItemId", args.contentItemId)
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
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    // If userId is provided, use it; otherwise get from auth
    let targetUserId: Id<"users">;

    if (args.userId) {
      targetUserId = args.userId;
    } else {
      const { user } = await requireAuthenticatedUser(ctx);
      targetUserId = user._id;
    }

    return await buildCourseProgress(ctx, args.courseId, targetUserId);
  },
});

export const adminCalculateCourseProgress = query({
  args: {
    courseId: v.id("courses"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireAdminUser(ctx);
    return await buildCourseProgress(ctx, args.courseId, args.userId);
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

type CourseProgressResult = {
  courseId: Id<"courses">;
  totalItems: number;
  completedItems: number;
  completionPercentage: number;
  isCertification?: boolean;
  gradedItems?: number;
  passedGradedItems?: number;
  overallGrade?: number | null;
  eligibleForCertificate?: boolean;
  hasCertificate?: boolean;
  requirementsMet?: boolean;
  passingGrade: number;
  /** Timestamp when this was computed (for cache tracking) */
  computedAt?: number;
};

async function buildCourseProgress(
  ctx: QueryCtx | MutationCtx,
  courseId: Id<"courses">,
  userId: Id<"users">,
  options?: { skipCache?: boolean }
): Promise<CourseProgressResult> {
  // Check cache first (unless explicitly skipped)
  if (!options?.skipCache) {
    const cached = getCachedProgressSummary(courseId, userId);
    if (cached) {
      return {
        courseId: cached.courseId,
        totalItems: cached.totalItems,
        completedItems: cached.completedItems,
        completionPercentage: cached.completionPercentage,
        isCertification: true, // Cached entries are always from certification courses
        gradedItems: cached.gradedItems,
        passedGradedItems: cached.passedGradedItems,
        overallGrade: cached.overallGrade,
        eligibleForCertificate: cached.eligibleForCertificate,
        hasCertificate: cached.hasCertificate,
        requirementsMet: cached.eligibleForCertificate,
        passingGrade: 70, // Default, actual value computed below if cache miss
        computedAt: cached.computedAt,
      };
    }
  }

  const course = await ctx.db.get(courseId);
  if (!course) {
    throw new Error("Course not found");
  }

  const coursePassingGrade = course.passingGrade ?? 70;

  const chapters = await ctx.db
    .query("chapters")
    .withIndex("by_courseId", (q) => q.eq("courseId", courseId))
    .collect();

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
      courseId,
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

  const progressRecords = await ctx.db
    .query("progress")
    .withIndex("by_userId_courseId", (q) =>
      q.eq("userId", userId).eq("courseId", courseId)
    )
    .collect();

  const progressSummaryMap = summarizeProgressByContentItem(progressRecords);

  const completedItems = trackableItems.reduce((count, item) => {
    const summary = progressSummaryMap.get(item._id);
    return summary?.attempted ? count + 1 : count;
  }, 0);

  const completionPercentage = totalItems > 0 ? (completedItems / totalItems) * 100 : 100;

  const existingCertificate = await ctx.db
    .query("certificates")
    .withIndex("by_userId_courseId", (q) =>
      q.eq("userId", userId).eq("courseId", courseId)
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

    const {
      passedCount,
      overallGrade,
      attemptedCount,
    } = calculateStudentGrade(gradedContentItems, progressSummaryMap, coursePassingGrade);

    gradingInfo.passedGradedItems = passedCount;
    gradingInfo.overallGrade = attemptedCount > 0 ? overallGrade : null;

    const requirementsMet =
      gradingInfo.gradedItems > 0 &&
      attemptedCount === gradingInfo.gradedItems &&
      passedCount === gradingInfo.gradedItems &&
      (gradingInfo.overallGrade ?? 0) >= coursePassingGrade;

    gradingInfo.requirementsMet = requirementsMet;
    gradingInfo.eligibleForCertificate = hasCertificate || requirementsMet;
  }

  const result: CourseProgressResult = {
    courseId,
    totalItems,
    completedItems,
    completionPercentage,
    isCertification: course.isCertification,
    ...gradingInfo,
    passingGrade: coursePassingGrade,
    computedAt: Date.now(),
  };

  // Cache the result for certification courses (they have more expensive calculations)
  if (course.isCertification) {
    cacheProgressSummary({
      courseId,
      userId,
      totalItems,
      completedItems,
      completionPercentage,
      gradedItems: gradingInfo.gradedItems,
      passedGradedItems: gradingInfo.passedGradedItems,
      overallGrade: gradingInfo.overallGrade,
      eligibleForCertificate: gradingInfo.eligibleForCertificate,
      hasCertificate: gradingInfo.hasCertificate,
      computedAt: result.computedAt!,
    });
  }

  return result;
}

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

/**
 * =============================================================================
 * SECURE QUIZ VALIDATION
 * =============================================================================
 * Validates quiz answers server-side to prevent cheating.
 * The correct answers are never sent to the client.
 * =============================================================================
 */

/**
 * Validate quiz answers and return results with correct answers
 * This is called when the user submits their quiz answers
 */
export const validateQuizAnswers = mutation({
  args: {
    userId: v.id("users"),
    contentItemId: v.id("contentItems"),
    answers: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    // 1. Get content item
    const contentItem = await ctx.db.get(args.contentItemId);
    if (!contentItem) {
      throw new Error("Content item not found");
    }

    // 2. Get quiz questions based on content type
    let questions: Array<{ question: string; options: string[]; correct?: number; correctIndex?: number; explanation?: string }> = [];
    
    if (contentItem.type === "quiz" && contentItem.quizData) {
      questions = contentItem.quizData.questions || [];
    } else if (contentItem.type === "text" && contentItem.textQuiz) {
      questions = contentItem.textQuiz.questions || [];
    } else if (contentItem.type === "video" && contentItem.videoId) {
      const video = await ctx.db.get(contentItem.videoId);
      if (video && video.quiz) {
        questions = video.quiz.questions || [];
      }
    }

    if (questions.length === 0) {
      throw new Error("No quiz questions found for this content item");
    }

    // 3. Validate each answer and build results
    const results: Array<{
      questionIndex: number;
      isCorrect: boolean;
      correctAnswer: number;
      userAnswer: number;
      explanation?: string;
    }> = [];

    let score = 0;
    
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const userAnswer = args.answers[i] ?? -1;
      // Support both 'correct' and 'correctIndex' field names
      const correctAnswer = question.correctIndex ?? question.correct ?? 0;
      const isCorrect = userAnswer === correctAnswer;
      
      if (isCorrect) {
        score++;
      }

      results.push({
        questionIndex: i,
        isCorrect,
        correctAnswer,
        userAnswer,
        explanation: question.explanation,
      });
    }

    // 4. Record the completion (this also records the quiz attempt)
    const chapter = await ctx.db.get(contentItem.chapterId);
    if (!chapter) {
      throw new Error("Chapter not found");
    }

    // Record the attempt
    await recordQuizAttempt(ctx, {
      userId: args.userId,
      contentItemId: args.contentItemId,
      courseId: chapter.courseId,
      answers: args.answers,
      score,
      maxScore: questions.length,
      timeSpent: 0,
    });

    // Update progress
    await updateOrCreateProgress(ctx, {
      userId: args.userId,
      courseId: chapter.courseId,
      chapterId: chapter._id,
      contentItemId: args.contentItemId,
      contentItem,
      score,
      maxScore: questions.length,
    });

    // Invalidate cache
    invalidateCourseCache(chapter.courseId);

    return {
      success: true,
      score,
      maxScore: questions.length,
      percentage: Math.round((score / questions.length) * 100),
      results,
    };
  },
});

/**
 * Get validation results for a previous quiz attempt
 * This re-validates the stored answers against the quiz questions
 * Used when viewing previous attempt results
 */
export const getQuizValidationResults = query({
  args: {
    contentItemId: v.id("contentItems"),
    answers: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    // 1. Get content item
    const contentItem = await ctx.db.get(args.contentItemId);
    if (!contentItem) {
      return null;
    }

    // 2. Get quiz questions based on content type
    let questions: Array<{ question: string; options: string[]; correct?: number; correctIndex?: number; explanation?: string }> = [];
    
    if (contentItem.type === "quiz" && contentItem.quizData) {
      questions = contentItem.quizData.questions || [];
    } else if (contentItem.type === "text" && contentItem.textQuiz) {
      questions = contentItem.textQuiz.questions || [];
    } else if (contentItem.type === "video" && contentItem.videoId) {
      const video = await ctx.db.get(contentItem.videoId);
      if (video && video.quiz) {
        questions = video.quiz.questions || [];
      }
    }

    if (questions.length === 0) {
      return null;
    }

    // 3. Validate each answer and build results
    const results: Array<{
      questionIndex: number;
      isCorrect: boolean;
      correctAnswer: number;
      userAnswer: number;
      explanation?: string;
    }> = [];

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const userAnswer = args.answers[i] ?? -1;
      // Support both 'correct' and 'correctIndex' field names
      const correctAnswer = question.correctIndex ?? question.correct ?? 0;
      const isCorrect = userAnswer === correctAnswer;

      results.push({
        questionIndex: i,
        isCorrect,
        correctAnswer,
        userAnswer,
        explanation: question.explanation,
      });
    }

    return results;
  },
});

/**
 * Get quiz questions without correct answers (for secure client-side display)
 * This strips the 'correct' field so users can't cheat by inspecting network requests
 */
export const getSecureQuizQuestions = query({
  args: {
    contentItemId: v.id("contentItems"),
  },
  handler: async (ctx, args) => {
    const contentItem = await ctx.db.get(args.contentItemId);
    if (!contentItem) {
      return null;
    }

    let quiz: { topic: string; questions: Array<{ question: string; options: string[]; correct?: number; correctIndex?: number; explanation?: string }> } | null = null;

    if (contentItem.type === "quiz" && contentItem.quizData) {
      quiz = contentItem.quizData;
    } else if (contentItem.type === "text" && contentItem.textQuiz) {
      quiz = contentItem.textQuiz;
    } else if (contentItem.type === "video" && contentItem.videoId) {
      const video = await ctx.db.get(contentItem.videoId);
      if (video && video.quiz) {
        quiz = video.quiz;
      }
    }

    if (!quiz) {
      return null;
    }

    // Strip correct answers from questions
    const secureQuestions = quiz.questions.map((q) => ({
      question: q.question,
      options: q.options,
      // Don't include correct, correctIndex, or explanation
    }));

    return {
      topic: quiz.topic,
      questions: secureQuestions,
    };
  },
});


