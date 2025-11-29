import { v } from "convex/values";
import { internalMutation, mutation, query, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { summarizeProgressByContentItem } from "./utils/progressUtils";
import { calculateStudentGrade } from "./utils/grading";
import { generateSecureCertificateId, verifyCertificateSignature } from "./utils/certificateSignature";

/**
 * =============================================================================
 * CERTIFICATE MANAGEMENT SYSTEM
 * =============================================================================
 * Handles certificate eligibility checking and issuance.
 * Uses HMAC-based signatures for certificate verification.
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

  const {
    missingCount,
    failedCount,
    overallGrade,
    attemptedCount
  } = calculateStudentGrade(gradedItems, progressSummaryMap, passingGrade);

  if (missingCount > 0) {
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

  const timestamp = Date.now();
  
  // Generate secure certificate ID with HMAC signature
  const certificateId = generateSecureCertificateId({
    courseId: courseId as string,
    userId: userId as string,
    completionDate: timestamp,
    overallGrade,
  });

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

    const {
      overallGrade,
      attemptedCount: attemptedGradedCount,
      passedCount: passedGradedItems,
    } = calculateStudentGrade(gradedContentItems, progressSummaryMap, passingGrade);

    const gradedSummaries = gradedContentItems.map((item) => ({
      item,
      summary: progressSummaryMap.get(item._id),
    }));

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

/**
 * Verify a certificate's authenticity using its signature
 * This can be called by anyone to verify a certificate is legitimate
 */
export const verifyCertificate = query({
  args: {
    certificateId: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the certificate by ID
    const certificate = await ctx.db
      .query("certificates")
      .withIndex("by_certificateId", (q) => q.eq("certificateId", args.certificateId))
      .first();

    if (!certificate) {
      return {
        valid: false,
        reason: "Certificate not found",
      };
    }

    // Verify the signature
    const isSignatureValid = verifyCertificateSignature(args.certificateId, {
      courseId: certificate.courseId as string,
      userId: certificate.userId as string,
      completionDate: certificate.completionDate,
      overallGrade: certificate.overallGrade,
    });

    if (!isSignatureValid) {
      return {
        valid: false,
        reason: "Invalid certificate signature",
      };
    }

    // Return verified certificate details
    return {
      valid: true,
      certificate: {
        courseName: certificate.courseName,
        userName: certificate.userName,
        completionDate: certificate.completionDate,
        overallGrade: certificate.overallGrade,
        issuedAt: certificate.issuedAt,
        totalGradedItems: certificate.totalGradedItems,
        passedItems: certificate.passedItems,
      },
    };
  },
});

