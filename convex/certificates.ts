import { v } from "convex/values";
import { internalMutation, mutation, query, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { summarizeProgressByContentItem } from "./utils/progressUtils";

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
    return await processCertificateRequest(ctx, args);
  },
});

/**
 * Client-facing mutation to request certificate issuance on demand.
 * Validates eligibility and issues the certificate if requirements are met.
 */
export const requestCertificate = mutation({
  args: {
    userId: v.id("users"),
    courseId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    return await processCertificateRequest(ctx, args);
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

type CertificateRequestResult = {
  eligible: boolean;
  issued: boolean;
  certificateId?: string;
  overallGrade?: number;
  alreadyIssued?: boolean;
  reason?: string;
};

async function processCertificateRequest(
  ctx: MutationCtx,
  args: { userId: Id<"users">; courseId: Id<"courses"> }
): Promise<CertificateRequestResult> {
  const { userId, courseId } = args;

  const existingCertificate = await ctx.db
    .query("certificates")
    .withIndex("by_userId_courseId", (q) =>
      q.eq("userId", userId).eq("courseId", courseId)
    )
    .first();

  if (existingCertificate) {
    return {
      eligible: true,
      issued: false,
      alreadyIssued: true,
      certificateId: existingCertificate.certificateId,
      overallGrade: existingCertificate.overallGrade,
    };
  }

  const course = await ctx.db.get(courseId);
  if (!course || !course.isCertification) {
    return {
      eligible: false,
      issued: false,
      reason: "Not a certification course",
    };
  }

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

  const gradedItems = allContentItems.flat().filter((item) => item.isGraded);
  if (gradedItems.length === 0) {
    return {
      eligible: false,
      issued: false,
      reason: "No graded items in course",
    };
  }

  const progressRecords = await ctx.db
    .query("progress")
    .withIndex("by_userId_courseId", (q) =>
      q.eq("userId", userId).eq("courseId", courseId)
    )
    .collect();

  const progressSummaryMap = summarizeProgressByContentItem(progressRecords);
  const passingGrade = course.passingGrade ?? 70;

  let missingCount = 0;
  let failedCount = 0;
  let totalPossiblePoints = 0;
  let totalEarnedPoints = 0;

  for (const item of gradedItems) {
    const summary = progressSummaryMap.get(item._id);
    if (!summary) {
      missingCount += 1;
      continue;
    }

    const maxPoints = item.maxPoints ?? 100;
    const bestPercentage = summary.bestPercentage ?? 0;
    const itemPassingScore = item.passingScore ?? passingGrade;

    totalPossiblePoints += maxPoints;
    totalEarnedPoints += (bestPercentage / 100) * maxPoints;

    if (bestPercentage < itemPassingScore) {
      failedCount += 1;
    }
  }

  if (missingCount > 0) {
    const attemptedCount = gradedItems.length - missingCount;
    return {
      eligible: false,
      issued: false,
      reason: `Not all graded items attempted (${attemptedCount}/${gradedItems.length})`,
    };
  }

  if (failedCount > 0) {
    return {
      eligible: false,
      issued: false,
      reason: `${failedCount} graded item(s) not passed`,
    };
  }

  const overallGrade = totalPossiblePoints > 0
    ? (totalEarnedPoints / totalPossiblePoints) * 100
    : 0;

  if (overallGrade < passingGrade) {
    return {
      eligible: false,
      issued: false,
      reason: `Overall grade ${overallGrade.toFixed(2)}% below passing grade ${passingGrade}%`,
    };
  }

  const user = await ctx.db.get(userId);
  if (!user) {
    return {
      eligible: false,
      issued: false,
      reason: "User not found",
    };
  }

  const certificateId = `${courseId}-${userId}-${Date.now()}`;
  const timestamp = Date.now();

  await ctx.db.insert("certificates", {
    userId,
    courseId,
    certificateId,
    courseName: course.name,
    userName: user.name ?? user.email,
    completionDate: timestamp,
    overallGrade,
    issuedAt: timestamp,
    totalGradedItems: gradedItems.length,
    passedItems: gradedItems.length,
    averageScore: overallGrade,
  });

  return {
    eligible: true,
    issued: true,
    certificateId,
    overallGrade,
  };
}

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

    const progressSummaryMap = summarizeProgressByContentItem(progressRecords);
    const passingGrade = course.passingGrade ?? 70;

    const gradedSummaries = gradedContentItems.map((item) => ({
      item,
      summary: progressSummaryMap.get(item._id),
    }));

    const attemptedGradedCount = gradedSummaries.filter(({ summary }) => !!summary).length;
    const passedGradedItems = gradedSummaries.reduce((count, { item, summary }) => {
      if (!summary) {
        return count;
      }
      const bestPercentage = summary.bestPercentage ?? 0;
      const itemPassingScore = item.passingScore ?? passingGrade;
      return bestPercentage >= itemPassingScore ? count + 1 : count;
    }, 0);

    let overallGrade: number | null = null;
    if (attemptedGradedCount > 0) {
      let totalPossiblePoints = 0;
      let totalEarnedPoints = 0;

      for (const { item, summary } of gradedSummaries) {
        if (!summary) {
          continue;
        }
        const maxPoints = item.maxPoints ?? 100;
        const bestPercentage = summary.bestPercentage ?? 0;
        totalPossiblePoints += maxPoints;
        totalEarnedPoints += (bestPercentage / 100) * maxPoints;
      }

      if (totalPossiblePoints > 0) {
        overallGrade = (totalEarnedPoints / totalPossiblePoints) * 100;
      }
    }

    const hasGradedItems = gradedContentItems.length > 0;
    const allGradedItemsAttempted = hasGradedItems && attemptedGradedCount === gradedContentItems.length;
    const allGradedItemsPassed = hasGradedItems && passedGradedItems === gradedContentItems.length;
    const gradeAboveThreshold = (overallGrade ?? 0) >= passingGrade;

    const eligibleForCertificate =
      hasGradedItems &&
      allGradedItemsAttempted &&
      allGradedItemsPassed &&
      gradeAboveThreshold;

    const itemsWithoutProgress = gradedSummaries
      .filter(({ summary }) => !summary)
      .map(({ item }) => item);

    return {
      courseName: course.name,
      isCertification: course.isCertification,
      passingGrade,

      totalContentItems: contentItems.length,
  gradedContentItems: gradedContentItems.length,

  progressRecords: progressRecords.length,
  gradedProgressRecords: attemptedGradedCount,
      passedGradedItems,

      overallGrade,

      eligibilityChecks: {
        hasGradedItems,
        allGradedItemsAttempted,
        allGradedItemsPassed,
        gradeAboveThreshold,
      },

      eligibleForCertificate,

      gradedItemsList: gradedSummaries.map(({ item, summary }) => ({
        id: item._id,
        title: item.title,
        type: item.type,
        isGraded: item.isGraded,
        maxPoints: item.maxPoints,
        hasProgress: !!summary,
        bestPercentage: summary?.bestPercentage ?? null,
        latestPercentage: summary?.latestPercentage ?? null,
        attempts: summary?.attempts ?? 0,
      })),

      itemsWithoutProgress: itemsWithoutProgress.map((item) => ({
        id: item._id,
        title: item.title,
        type: item.type,
      })),

      gradedProgressList: gradedSummaries
        .filter(({ summary }) => !!summary)
        .map(({ item, summary }) => ({
          contentItemId: item._id,
          title: item.title,
          bestPercentage: summary?.bestPercentage ?? 0,
          latestPercentage: summary?.latestPercentage ?? null,
          latestPassed: summary?.latestPassed ?? null,
          attempts: summary?.attempts ?? 0,
          completed: summary?.completed ?? false,
          progressPercentage: summary?.progressPercentage ?? 0,
        })),
    };
  },
});
