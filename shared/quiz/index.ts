/**
 * Quiz State Management Module
 * 
 * Exports all types, utilities, and functions for the quiz state management system.
 * 
 * @module shared/quiz
 */

// Type exports
export type {
  // Main answer types
  QuizAnswer,
  ExtendedQuizAnswer,
  MCQAnswer,
  FillBlanksAnswer,
  DragDropAnswer,
  MixedLessonAnswer,
  
  // Sub-types
  BlankAnswer,
  PlacementResult,
  AttemptRecord,
  QuestionState,
  
  // State types
  LessonProgressState,
  MixedLessonProgressState,
  SyncState,
  
  // Utility types
  LessonType,
  SyncStatus,
  AnswerType,
  AnswerForLessonType,
  QuizRestorationProps,
  OnAnswerSubmit,
  OnHintViewed,
} from './types';

// Type guards
export {
  isMCQAnswer,
  isFillBlanksAnswer,
  isDragDropAnswer,
  isMixedLessonAnswer,
} from './types';
