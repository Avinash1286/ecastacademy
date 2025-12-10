import type { Doc, Id } from '../../convex/_generated/dataModel';

export type LessonProgressMap = Map<Id<'capsuleLessons'>, Doc<'capsuleProgress'>>;

const getProgressPriority = (record: Doc<'capsuleProgress'>): number => {
  let score = 0;
  const lastAnswer = record.lastAnswer;

  if (lastAnswer) {
    if (typeof lastAnswer.selectedIndex === 'number') {
      score += 4;
    } else if (lastAnswer.selectedAnswer) {
      score += 2;
    } else {
      score += 1;
    }
  }

  if (record.quizAnswers?.length) {
    score += 1;
  }

  return score;
};

export const buildProgressByLesson = (
  progressList?: Doc<'capsuleProgress'>[]
): LessonProgressMap => {
  const map: LessonProgressMap = new Map();

  if (!progressList) {
    return map;
  }

  for (const record of progressList) {
    if (!record.lessonId) {
      continue;
    }

    const existing = map.get(record.lessonId);
    if (!existing) {
      map.set(record.lessonId, record);
      continue;
    }

    const recordScore = getProgressPriority(record);
    const existingScore = getProgressPriority(existing);
    const recordUpdated = record.updatedAt ?? 0;
    const existingUpdated = existing.updatedAt ?? 0;

    if (
      recordScore > existingScore ||
      (recordScore === existingScore && recordUpdated > existingUpdated)
    ) {
      map.set(record.lessonId, record);
    }
  }

  return map;
};

export const countCompletedLessons = (progressMap: Map<Id<'capsuleLessons'>, { completed?: boolean }>): number => {
  let completed = 0;
  for (const record of progressMap.values()) {
    if (record.completed) {
      completed += 1;
    }
  }
  return completed;
};

// Type for merged progress that can include both full DB records and optimistic partial updates
export type MergedProgressRecord = { 
  completed?: boolean; 
  score?: number; 
  maxScore?: number; 
  lastAnswer?: Doc<'capsuleProgress'>['lastAnswer'];
};
export type MergedProgressMap = Map<Id<'capsuleLessons'>, MergedProgressRecord>;

export const getLessonProgress = (
  progressMap: MergedProgressMap,
  lessonId?: Id<'capsuleLessons'>
): MergedProgressRecord | undefined => {
  if (!lessonId) {
    return undefined;
  }
  return progressMap.get(lessonId);
};
