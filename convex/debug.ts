import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Debug query to check certificate eligibility for a user in a course
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

    // Calculate overall grade
    let overallGrade = null;
    if (gradedProgress.length > 0) {
      const totalPossiblePoints = gradedProgress.reduce(
        (sum, p) => sum + (p.maxScore ?? 100),
        0
      );
      const totalEarnedPoints = gradedProgress.reduce(
        (sum, p) => sum + (p.bestScore ?? p.score ?? 0),
        0
      );
      overallGrade = (totalEarnedPoints / totalPossiblePoints) * 100;
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
      gradedProgress.map((p) => p.contentItemId).filter((id) => id !== undefined)
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
        passed: p.passed,
        isGradedItem: p.isGradedItem,
      })),
    };
  },
});
