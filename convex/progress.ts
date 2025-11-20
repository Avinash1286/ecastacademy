import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * @deprecated Prefer mutations in completions.ts.
 * Keeping the legacy surface for backwards compatibility but it will
 * continue to use its original behaviour.
 */
export const submitQuizAttempt = mutation({
  args: {
    userId: v.id("users"),
    contentItemId: v.id("contentItems"),
    answers: v.any(), // Quiz answers array
    score: v.number(), // Score achieved (0-100)
    maxScore: v.optional(v.number()), // Maximum possible score (default 100)
  },
  handler: async (ctx, args) => {
    // Get user
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Get content item
    const contentItem = await ctx.db.get(args.contentItemId);
    if (!contentItem) {
      throw new Error("Content item not found");
    }

    // Get chapter to get courseId
    const chapter = await ctx.db.get(contentItem.chapterId);
    if (!chapter) {
      throw new Error("Chapter not found");
    }

    // Get course to check if it's a certification course
    const course = await ctx.db.get(chapter.courseId);
    if (!course) {
      throw new Error("Course not found");
    }

    const maxScore = args.maxScore ?? contentItem.maxPoints ?? 100;
    const percentage = (args.score / maxScore) * 100;
    const passingScore = contentItem.passingScore ?? 70;
    const passed = percentage >= passingScore;

    // Get existing attempts count for this content item
    const existingAttempts = await ctx.db
      .query("quizAttempts")
      .withIndex("by_userId_contentItemId", (q) =>
        q.eq("userId", user._id).eq("contentItemId", args.contentItemId)
      )
      .collect();

    const attemptNumber = existingAttempts.length + 1;

    // Record quiz attempt
    const attemptId = await ctx.db.insert("quizAttempts", {
      userId: user._id,
      courseId: chapter.courseId,
      contentItemId: args.contentItemId,
      attemptNumber: attemptNumber,
      answers: args.answers,
      score: args.score,
      maxScore: maxScore,
      percentage: percentage,
      passed: passed,
      startedAt: Date.now(), // TODO: Track actual start time from frontend
      completedAt: Date.now(),
      timeSpent: 0, // TODO: Calculate actual time spent from frontend
    });

    // Get or create progress record
    const existingProgress = await ctx.db
      .query("progress")
      .withIndex("by_userId_courseId_contentItemId", (q) =>
        q
          .eq("userId", user._id)
          .eq("courseId", chapter.courseId)
          .eq("contentItemId", args.contentItemId)
      )
      .first();

    if (existingProgress) {
      const newAttempts = (existingProgress.attempts ?? 0) + 1;
      const newBestScore = Math.max(existingProgress.bestScore ?? 0, percentage);
      const everPassed = (existingProgress.passed ?? false) || passed;
      const shouldComplete = contentItem.isGraded && course.isCertification
        ? (existingProgress.completed || passed)
        : true;
      const now = Date.now();

      await ctx.db.patch(existingProgress._id, {
        score: args.score,
        maxScore: maxScore,
        percentage: percentage,
        passed: everPassed,
        attempts: newAttempts,
        bestScore: newBestScore,
        lastAttemptAt: now,
        completed: shouldComplete,
        completedAt: shouldComplete ? (existingProgress.completedAt ?? now) : existingProgress.completedAt,
        progressPercentage: shouldComplete ? 100 : existingProgress.progressPercentage,
      });
    } else {
      const shouldComplete = contentItem.isGraded && course.isCertification ? passed : true;
      const now = Date.now();

      await ctx.db.insert("progress", {
        userId: user._id,
        courseId: chapter.courseId,
        chapterId: chapter._id,
        contentItemId: args.contentItemId,
        isGradedItem: contentItem.isGraded ?? false,
        score: args.score,
        maxScore: maxScore,
        percentage: percentage,
        passed: contentItem.isGraded ? passed : true,
        attempts: 1,
        bestScore: percentage,
        lastAttemptAt: now,
        completed: shouldComplete,
        completedAt: shouldComplete ? now : undefined,
        progressPercentage: shouldComplete ? 100 : 0,
      });
    }
    return {
      attemptId,
      score: args.score,
      maxScore: maxScore,
      percentage: percentage,
      passed: passed,
    };
  },
});

/**
 * Mark a non-quiz graded item as complete (e.g., assignment, video)
 * Used for items that don't have auto-grading
 */
export const markItemComplete = mutation({
  args: {
    userId: v.id("users"),
    contentItemId: v.id("contentItems"),
    score: v.optional(v.number()), // Optional score for manual grading
    maxScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

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

    // Calculate scoring if provided
    let percentage: number | undefined;
    let passed: boolean | undefined;
    
    if (args.score !== undefined) {
      const maxScore = args.maxScore ?? contentItem.maxPoints ?? 100;
      percentage = (args.score / maxScore) * 100;
      const passingScore = contentItem.passingScore ?? 70;
      passed = percentage >= passingScore;
    }

    // Get existing progress
    const existingProgress = await ctx.db
      .query("progress")
      .withIndex("by_userId_courseId_contentItemId", (q) =>
        q
          .eq("userId", user._id)
          .eq("courseId", chapter.courseId)
          .eq("contentItemId", args.contentItemId)
      )
      .first();

    if (existingProgress) {
      const now = Date.now();
      const updatedAttempts = (existingProgress.attempts ?? 0) + 1;
      const newBestScore = Math.max(existingProgress.bestScore ?? 0, percentage ?? 0);
      const everPassed = (existingProgress.passed ?? false) || (passed ?? false);

      await ctx.db.patch(existingProgress._id, {
        completed: true,
        completedAt: existingProgress.completedAt ?? now,
        progressPercentage: 100,
        ...(args.score !== undefined && {
          score: args.score,
          maxScore: args.maxScore ?? contentItem.maxPoints ?? 100,
          percentage: percentage,
          passed: everPassed,
          attempts: updatedAttempts,
          bestScore: newBestScore,
          lastAttemptAt: now,
        }),
        ...(args.score === undefined && {
          attempts: updatedAttempts,
          lastAttemptAt: now,
        }),
      });
    } else {
      // Create new progress record
      await ctx.db.insert("progress", {
        userId: user._id,
        courseId: chapter.courseId,
        chapterId: chapter._id,
        contentItemId: args.contentItemId,
        isGradedItem: contentItem.isGraded ?? false,
        completed: true,
        completedAt: Date.now(),
        progressPercentage: 100,
        ...(args.score !== undefined && {
          score: args.score,
          maxScore: args.maxScore ?? contentItem.maxPoints ?? 100,
          percentage: percentage,
          passed: passed,
          attempts: 1,
          bestScore: percentage,
          lastAttemptAt: Date.now(),
        }),
      });
    }
    return { success: true };
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
      const gradedContentItems = contentItems.filter((item) => item.isGraded);
      const gradedItemIds = new Set(gradedContentItems.map((item) => item._id));

      const gradedProgress = progressRecords.filter(
        (p) => p.contentItemId && gradedItemIds.has(p.contentItemId)
      );

      gradingInfo.gradedItems = gradedContentItems.length;
      gradingInfo.passedGradedItems = gradedProgress.filter((p) => p.passed).length;

      // Calculate overall grade using best scores
      if (gradedProgress.length > 0) {
        const totalPossiblePoints = gradedProgress.reduce(
          (sum, p) => sum + (p.maxScore ?? 100),
          0
        );
        const totalEarnedPoints = gradedProgress.reduce(
          (sum, p) => sum + (p.bestScore ?? p.score ?? 0),
          0
        );
        gradingInfo.overallGrade = (totalEarnedPoints / totalPossiblePoints) * 100;
      }

      // Check certificate eligibility
      const passingGrade = course.passingGrade ?? 70;
      gradingInfo.eligibleForCertificate =
        gradingInfo.gradedItems > 0 &&
        gradingInfo.gradedItems === gradedProgress.length &&
        gradingInfo.passedGradedItems === gradingInfo.gradedItems &&
        (gradingInfo.overallGrade ?? 0) >= passingGrade;
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
 * Includes per-item progress and grading details
 */
export const getCourseProgress = query({
  args: {
    courseId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Get all progress records for this course
    const progressRecords = await ctx.db
      .query("progress")
      .withIndex("by_userId_courseId", (q) =>
        q.eq("userId", user._id).eq("courseId", args.courseId)
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
        q.eq("userId", user._id).eq("courseId", args.courseId)
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
      const identity = await ctx.auth.getUserIdentity();
      if (!identity?.email) {
        throw new Error("Not authenticated");
      }
      const identityEmail = identity.email;

      const user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", identityEmail))
        .first();

      if (!user) {
        throw new Error("User not found");
      }

      targetUserId = user._id;
    }

    const attempts = await ctx.db
      .query("quizAttempts")
      .withIndex("by_userId_contentItemId", (q) =>
        q.eq("userId", targetUserId).eq("contentItemId", args.contentItemId)
      )
      .collect();

    // Sort by date descending (most recent first)
    return attempts.sort((a, b) => b.completedAt - a.completedAt);
  },
});

/**
 * Get all certificates earned by a user
 */
export const getUserCertificates = query({
  args: {
    userId: v.id("users"), // Required: user ID to fetch certificates for
  },
  handler: async (ctx, args) => {
    const certificates = await ctx.db
      .query("certificates")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    // Sort by completion date descending (most recent first)
    return certificates.sort((a, b) => b.completionDate - a.completionDate);
  },
});

/**
 * Get a specific certificate by certificate ID
 */
export const getCertificate = query({
  args: {
    certificateId: v.string(),
  },
  handler: async (ctx, args) => {
    const certificate = await ctx.db
      .query("certificates")
      .withIndex("by_certificateId", (q) => q.eq("certificateId", args.certificateId))
      .first();

    if (!certificate) {
      return null;
    }

    return certificate;
  },
});
