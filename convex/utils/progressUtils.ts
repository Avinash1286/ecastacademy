import { Doc, Id } from "../_generated/dataModel";

export type ProgressSummary = {
  contentItemId: Id<"contentItems">;
  canonical: Doc<"progress">;
  entries: Doc<"progress">[];
  bestPercentage: number;
  latestPercentage?: number;
  latestScore?: number;
  latestPassed?: boolean;
  attempts: number;
  completed: boolean;
  completedAt?: number;
  progressPercentage: number;
  lastActivityAt: number;
};

/**
 * Produce aggregated ProgressSummary objects keyed by content item ID.
 *
 * Groups progress records by their `contentItemId` and consolidates metrics
 * such as best and latest percentages, latest score/passed status, attempts,
 * completion state and timestamp, progress percentage, last activity timestamp,
 * entries, and the canonical (earliest) record. Records without a `contentItemId`
 * are skipped.
 *
 * @param progressRecords - The array of progress documents to aggregate.
 * @returns A Map from content item ID to the aggregated ProgressSummary for that content item.
 */
export function summarizeProgressByContentItem(
  progressRecords: Doc<"progress">[]
): Map<Id<"contentItems">, ProgressSummary> {
  const summaries = new Map<Id<"contentItems">, ProgressSummary>();

  for (const record of progressRecords) {
    const contentItemId = record.contentItemId;
    if (!contentItemId) {
      continue;
    }

    const recordBestPercentage = getBestPercentage(record);
    const recordLastActivity = getLastActivityTimestamp(record);

    let summary = summaries.get(contentItemId);
    if (!summary) {
      summary = {
        contentItemId,
        canonical: record,
        entries: [record],
        bestPercentage: recordBestPercentage,
        latestPercentage: record.percentage,
        latestScore: record.score,
        latestPassed: record.latestPassed ?? record.passed,
        attempts: record.attempts ?? 0,
        completed: record.completed,
        completedAt: record.completedAt,
        progressPercentage: record.progressPercentage ?? 0,
        lastActivityAt: recordLastActivity,
      };
      summaries.set(contentItemId, summary);
      continue;
    }

    summary.entries.push(record);

    if (recordBestPercentage > summary.bestPercentage) {
      summary.bestPercentage = recordBestPercentage;
    }

    if ((record.attempts ?? 0) > summary.attempts) {
      summary.attempts = record.attempts ?? 0;
    }

    if (record.completed && !summary.completed) {
      summary.completed = true;
      summary.completedAt = record.completedAt ?? summary.completedAt;
    }

    if ((record.progressPercentage ?? 0) > summary.progressPercentage) {
      summary.progressPercentage = record.progressPercentage ?? 0;
    }

    if (recordLastActivity >= summary.lastActivityAt) {
      summary.lastActivityAt = recordLastActivity;
      summary.latestPercentage = record.percentage ?? summary.latestPercentage;
      summary.latestScore = record.score ?? summary.latestScore;
      summary.latestPassed = record.latestPassed ?? record.passed ?? summary.latestPassed;
    }

    if (record._creationTime < summary.canonical._creationTime) {
      summary.canonical = record;
    }
  }

  return summaries;
}

/**
 * Compute the best percentage value available from a progress record.
 *
 * @param record - Progress document which may include `bestScore`, `percentage`, `score`, and `maxScore`
 * @returns The best percentage: `bestScore` if present, otherwise `percentage`, otherwise `(score / maxScore) * 100` when `maxScore > 0`, or `0` if none are available
 */
export function getBestPercentage(record: Doc<"progress">): number {
  if (typeof record.bestScore === "number") {
    return record.bestScore;
  }
  if (typeof record.percentage === "number") {
    return record.percentage;
  }
  if (typeof record.score === "number" && typeof record.maxScore === "number" && record.maxScore > 0) {
    return (record.score / record.maxScore) * 100;
  }
  return 0;
}

/**
 * Determine the most recent activity timestamp for a progress record.
 *
 * Chooses `lastAttemptAt` if present, otherwise `completedAt`, otherwise `_creationTime`.
 *
 * @param record - The progress record to inspect
 * @returns The timestamp of the latest activity as a number
 */
export function getLastActivityTimestamp(record: Doc<"progress">): number {
  return (
    record.lastAttemptAt ??
    record.completedAt ??
    record._creationTime
  );
}