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
 * Group progress records by content item and capture consolidated stats.
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

export function getLastActivityTimestamp(record: Doc<"progress">): number {
  return (
    record.lastAttemptAt ??
    record.completedAt ??
    record._creationTime
  );
}

function quizHasQuestions(quiz: unknown): boolean {
  if (!quiz || typeof quiz !== "object") {
    return false;
  }

  const maybeQuiz = quiz as { questions?: unknown };
  if (!Array.isArray(maybeQuiz.questions)) {
    return false;
  }

  return maybeQuiz.questions.length > 0;
}

export function isTrackableContentItem(
  item: Doc<"contentItems">,
  videoLookup: Map<Id<"videos">, Doc<"videos"> | null | undefined>
): boolean {
  switch (item.type) {
    case "video": {
      if (!item.videoId) {
        return false;
      }

      const video = videoLookup.get(item.videoId);
      return quizHasQuestions(video?.quiz);
    }
    case "text": {
      return quizHasQuestions(item.textQuiz);
    }
    case "quiz":
    case "assignment":
      return true;
    default:
      return false;
  }
}

export function mapVideosById(
  videoIds: Id<"videos">[],
  videos: Array<Doc<"videos"> | null>
) {
  const lookup = new Map<Id<"videos">, Doc<"videos"> | null>();
  videoIds.forEach((id, index) => {
    lookup.set(id, videos[index] ?? null);
  });
  return lookup;
}
