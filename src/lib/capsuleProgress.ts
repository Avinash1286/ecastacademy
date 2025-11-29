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

export const countCompletedLessons = (progressMap: LessonProgressMap): number => {
  let completed = 0;
  for (const record of progressMap.values()) {
    if (record.completed) {
      completed += 1;
    }
  }
  return completed;
};

export const getLessonProgress = (
  progressMap: LessonProgressMap,
  lessonId?: Id<'capsuleLessons'>
): Doc<'capsuleProgress'> | undefined => {
  if (!lessonId) {
    return undefined;
  }
  return progressMap.get(lessonId);
};
