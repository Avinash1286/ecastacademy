/**
 * Quiz Library
 * 
 * Exports all quiz-related utilities, adapters, and helpers.
 * 
 * @module src/lib/quiz
 */

// Adapters
export {
  // Factory functions
  createMCQAnswer,
  createFillBlanksAnswer,
  createDragDropAnswer,
  createMixedLessonAnswer,
  
  // Validation & restoration
  restoreAnswer,
  safeJsonParse,
  isAnswerCorrect,
  getAnswerScore,
  
  // Legacy conversion
  convertLegacyMCQAnswer,
  convertLegacySerializedAnswer,
  
  // Types
  type CreateMCQAnswerParams,
  type CreateFillBlanksAnswerParams,
  type CreateDragDropAnswerParams,
  type CreateMixedLessonAnswerParams,
  type BlankData,
  type ItemData,
  type TargetData,
  type LegacyLastAnswer,
} from './adapters';
