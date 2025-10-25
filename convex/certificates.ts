import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

/**
 * =============================================================================
 * CERTIFICATE MANAGEMENT SYSTEM
 * =============================================================================
 * Handles certificate eligibility checking and issuance.
 * Runs asynchronously to avoid blocking quiz submissions.
 * =============================================================================
 */

/**
 * Internal mutation: Check eligibility and issue certificate if qualified
 * Called by scheduler after completions in certification courses
 */
export const checkEligibility = internalMutation({
  args: {
    userId: v.id("users"),
    courseId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    // 1. Check if certificate already exists
    const existingCertificate = await ctx.db
      .query("certificates")
      .withIndex("by_userId_courseId", (q) =>
        q.eq("userId", args.userId).eq("courseId", args.courseId)
      )
      .first();

    if (existingCertificate) {
      return { alreadyIssued: true, certificateId: existingCertificate.certificateId };
    }

    // 2. Get course
    const course = await ctx.db.get(args.courseId);
    if (!course || !course.isCertification) {
      return { eligible: false, reason: "Not a certification course" };
    }

    // 3. Get all chapters
    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
      .collect();

    // 4. Get all graded content items
    const allContentItems = await Promise.all(
      chapters.map((chapter) =>
        ctx.db
          .query("contentItems")
          .withIndex("by_chapterId", (q) => q.eq("chapterId", chapter._id))
          .collect()
      )
    );

    const gradedItems = allContentItems.flat().filter((item) => item.isGraded);

    if (gradedItems.length === 0) {
      return { eligible: false, reason: "No graded items in course" };
    }

    // 5. Get user's progress on graded items
    const gradedItemIds = new Set(gradedItems.map((item) => item._id));
    const progressRecords = await ctx.db
      .query("progress")
      .withIndex("by_userId_courseId", (q) =>
        q.eq("userId", args.userId).eq("courseId", args.courseId)
      )
      .collect();

    const gradedProgress = progressRecords.filter(
      (p) => p.contentItemId && gradedItemIds.has(p.contentItemId)
    );

    // 6. Check if all graded items are attempted
    if (gradedProgress.length !== gradedItems.length) {
      return {
        eligible: false,
        reason: `Not all graded items attempted (${gradedProgress.length}/${gradedItems.length})`,
      };
    }

    // 7. Check if all items are passed
    const allPassed = gradedProgress.every((p) => p.passed);
    if (!allPassed) {
      const failedCount = gradedProgress.filter((p) => !p.passed).length;
      return {
        eligible: false,
        reason: `${failedCount} graded item(s) not passed`,
      };
    }

    // 8. Calculate overall grade with proper weighting
    let totalPossiblePoints = 0;
    let totalEarnedPoints = 0;

    for (const progress of gradedProgress) {
      const contentItem = gradedItems.find((item) => item._id === progress.contentItemId);
      const maxPoints = contentItem?.maxPoints ?? 100;
      
      totalPossiblePoints += maxPoints;
      
      // Use bestScore for final grade calculation
      const bestPercentage = progress.bestScore ?? 0;
      totalEarnedPoints += (bestPercentage / 100) * maxPoints;
    }

    const overallGrade = totalPossiblePoints > 0 
      ? (totalEarnedPoints / totalPossiblePoints) * 100 
      : 0;

    // 9. Check if overall grade meets threshold
    const passingGrade = course.passingGrade ?? 70;
    if (overallGrade < passingGrade) {
      return {
        eligible: false,
        reason: `Overall grade ${overallGrade.toFixed(2)}% below passing grade ${passingGrade}%`,
      };
    }

    // 10. Get user details
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return { eligible: false, reason: "User not found" };
    }

    // 11. Issue certificate
    const certificateId = `${args.courseId}-${args.userId}-${Date.now()}`;

    await ctx.db.insert("certificates", {
      userId: args.userId,
      courseId: args.courseId,
      certificateId: certificateId,
      courseName: course.name,
      userName: user.name ?? user.email,
      completionDate: Date.now(),
      overallGrade: overallGrade,
      issuedAt: Date.now(),
      totalGradedItems: gradedItems.length,
      passedItems: gradedProgress.length,
      averageScore: overallGrade,
    });

    return {
      eligible: true,
      issued: true,
      certificateId: certificateId,
      overallGrade: overallGrade,
    };
  },
});

/**
 * Get all certificates earned by a user
 */
export const getUserCertificates = query({
  args: {
    userId: v.id("users"),
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
      throw new Error("Certificate not found");
    }

    return certificate;
  },
});

/**
 * Manual trigger to check certificate eligibility (for testing/admin)
 */
export const manualCheckEligibility = mutation({
  args: {
    userId: v.id("users"),
    courseId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    // Schedule the internal check
    await ctx.scheduler.runAfter(0, internal.certificates.checkEligibility, {
      userId: args.userId,
      courseId: args.courseId,
    });

    return { scheduled: true };
  },
});

/**
 * Debug query to see detailed certificate eligibility status
 */
export const debugCertificateEligibility = query({
  args: {
    courseId: v.id("courses"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.courseId);
    if (!course) {
      return { error: "Course not found" };
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
    const gradedContentItems = contentItems.filter((item) => item.isGraded);

    // Get user's progress
    const progressRecords = await ctx.db
      .query("progress")
      .withIndex("by_userId_courseId", (q) =>
        q.eq("userId", args.userId).eq("courseId", args.courseId)
      )
      .collect();

    const gradedItemIds = new Set(gradedContentItems.map((item) => item._id));
    const gradedProgress = progressRecords.filter(
      (p) => p.contentItemId && gradedItemIds.has(p.contentItemId)
    );

    const passedGradedItems = gradedProgress.filter((p) => p.passed).length;

    // Calculate overall grade with proper weighting
    let overallGrade = null;
    if (gradedProgress.length > 0) {
      let totalPossiblePoints = 0;
      let totalEarnedPoints = 0;

      for (const progress of gradedProgress) {
        const contentItem = contentItems.find((item) => item._id === progress.contentItemId);
        const maxPoints = contentItem?.maxPoints ?? 100;
        
        totalPossiblePoints += maxPoints;
        
        const bestPercentage = progress.bestScore ?? 0;
        totalEarnedPoints += (bestPercentage / 100) * maxPoints;
      }

      if (totalPossiblePoints > 0) {
        overallGrade = (totalEarnedPoints / totalPossiblePoints) * 100;
      }
    }

    const passingGrade = course.passingGrade ?? 70;

    // Check each condition
    const hasGradedItems = gradedContentItems.length > 0;
    const allGradedItemsAttempted = gradedContentItems.length === gradedProgress.length;
    const allGradedItemsPassed = passedGradedItems === gradedContentItems.length;
    const gradeAboveThreshold = (overallGrade ?? 0) >= passingGrade;

    const eligibleForCertificate =
      hasGradedItems &&
      allGradedItemsAttempted &&
      allGradedItemsPassed &&
      gradeAboveThreshold;

    // Find missing progress records
    const progressedItemIds = new Set(
      gradedProgress.map((p) => p.contentItemId).filter((id): id is Id<"contentItems"> => id !== undefined)
    );
    const itemsWithoutProgress = gradedContentItems.filter(
      (item) => !progressedItemIds.has(item._id)
    );

    return {
      courseName: course.name,
      isCertification: course.isCertification,
      passingGrade,

      totalContentItems: contentItems.length,
      gradedContentItems: gradedContentItems.length,

      progressRecords: progressRecords.length,
      gradedProgressRecords: gradedProgress.length,
      passedGradedItems,

      overallGrade,

      eligibilityChecks: {
        hasGradedItems,
        allGradedItemsAttempted,
        allGradedItemsPassed,
        gradeAboveThreshold,
      },

      eligibleForCertificate,

      gradedItemsList: gradedContentItems.map((item) => ({
        id: item._id,
        title: item.title,
        type: item.type,
        isGraded: item.isGraded,
        maxPoints: item.maxPoints,
        hasProgress: progressedItemIds.has(item._id),
      })),

      itemsWithoutProgress: itemsWithoutProgress.map((item) => ({
        id: item._id,
        title: item.title,
        type: item.type,
      })),

      gradedProgressList: gradedProgress.map((p) => ({
        contentItemId: p.contentItemId,
        score: p.score,
        maxScore: p.maxScore,
        percentage: p.percentage,
        bestScore: p.bestScore,
        passed: p.passed,
        attempts: p.attempts,
      })),
    };
  },
});
