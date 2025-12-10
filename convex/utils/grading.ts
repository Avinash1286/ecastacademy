import { Doc, Id } from "../_generated/dataModel";
import { ProgressSummary } from "./progressUtils";

export type GradeResult = {
  totalPossiblePoints: number;
  totalEarnedPoints: number;
  overallGrade: number;
  missingCount: number;
  failedCount: number;
  passedCount: number;
  attemptedCount: number;
  totalItems: number;
};

/**
 * Centralized logic for calculating student grades.
 * Used by both certificate issuance and progress display.
 */
export function calculateStudentGrade(
  gradedItems: Doc<"contentItems">[],
  progressSummaryMap: Map<Id<"contentItems">, ProgressSummary>,
  coursePassingGrade: number
): GradeResult {
  let missingCount = 0;
  let failedCount = 0;
  let passedCount = 0;
  let attemptedCount = 0;
  let totalPossiblePoints = 0;
  let totalEarnedPoints = 0;

  for (const item of gradedItems) {
    const summary = progressSummaryMap.get(item._id);
    
    if (!summary) {
      missingCount += 1;
      continue;
    }

    attemptedCount += 1;

    const maxPoints = item.maxPoints ?? 100;
    const bestPercentage = summary.bestPercentage ?? 0;
    // Prefer course's passing grade over item's stored value
    // This ensures updating the course's passing grade immediately reflects in all calculations
    const itemPassingScore = coursePassingGrade ?? item.passingScore ?? 70;

    totalPossiblePoints += maxPoints;
    totalEarnedPoints += (bestPercentage / 100) * maxPoints;

    if (bestPercentage < itemPassingScore) {
      failedCount += 1;
    } else {
      passedCount += 1;
    }
  }

  const overallGrade = totalPossiblePoints > 0
    ? (totalEarnedPoints / totalPossiblePoints) * 100
    : 0;

  return {
    totalPossiblePoints,
    totalEarnedPoints,
    overallGrade,
    missingCount,
    failedCount,
    passedCount,
    attemptedCount,
    totalItems: gradedItems.length
  };
}
