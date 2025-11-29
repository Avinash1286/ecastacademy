/**
 * Quiz State Management Type Definitions
 * 
 * This file contains all the discriminated union types for quiz answers
 * and lesson progress state. These types ensure type-safety across the
 * entire quiz system and enable exhaustive pattern matching.
 * 
 * @module shared/quiz/types
 */

import type { Id } from '../../convex/_generated/dataModel';

// =============================================================================
// DISCRIMINATED UNION ANSWER TYPES
// =============================================================================

/**
 * Union type for all answer types.
 * Use the `type` field as a discriminator for type narrowing.
 * 
 * @example
 * ```ts
 * function processAnswer(answer: QuizAnswer) {
 *   switch (answer.type) {
 *     case 'mcq':
 *       return answer.selectedIndex; // TypeScript knows this is MCQAnswer
 *     case 'fillBlanks':
 *       return answer.blanks; // TypeScript knows this is FillBlanksAnswer
 *     case 'dragDrop':
 *       return answer.placements; // TypeScript knows this is DragDropAnswer
 *   }
 * }
 * ```
 */
export type QuizAnswer =
  | MCQAnswer
  | FillBlanksAnswer
  | DragDropAnswer;

/**
 * Extended quiz answer that includes mixed lesson answers
 */
export type ExtendedQuizAnswer =
  | QuizAnswer
  | MixedLessonAnswer;

// =============================================================================
// MCQ (MULTIPLE CHOICE QUESTION) ANSWER
// =============================================================================

/**
 * Answer data for a multiple choice question.
 * Stores both index and text for resilience against option order changes.
 */
export interface MCQAnswer {
  /** Discriminator field */
  readonly type: 'mcq';
  
  /** Unique identifier for the question within the lesson */
  questionId: string;
  
  /** Zero-based index of the selected option */
  selectedIndex: number;
  
  /** Text content of the selected option */
  selectedText: string;
  
  /** Zero-based index of the correct option */
  correctIndex: number;
  
  /** Text content of the correct option */
  correctText: string;
  
  /** Whether the answer was correct */
  isCorrect: boolean;
  
  /** All available options at the time of answering */
  options: string[];
  
  /** Unix timestamp when the answer was submitted */
  timestamp: number;
  
  /** Time spent on this question in milliseconds */
  timeSpentMs?: number;
  
  /** Whether a hint was used before answering */
  hintUsed?: boolean;
}

// =============================================================================
// FILL IN THE BLANKS ANSWER
// =============================================================================

/**
 * Individual blank answer within a fill-in-the-blanks question
 */
export interface BlankAnswer {
  /** Unique identifier for this blank */
  blankId: string;
  
  /** User's answer text */
  userAnswer: string;
  
  /** The correct answer */
  correctAnswer: string;
  
  /** Alternative acceptable answers */
  alternatives: string[];
  
  /** Whether this specific blank was correct */
  isCorrect: boolean;
  
  /** Whether a hint was used for this blank */
  hintUsed?: boolean;
}

/**
 * Answer data for a fill-in-the-blanks question.
 * Tracks each blank separately for detailed feedback.
 */
export interface FillBlanksAnswer {
  /** Discriminator field */
  readonly type: 'fillBlanks';
  
  /** Unique identifier for the question within the lesson */
  questionId: string;
  
  /** Array of individual blank answers */
  blanks: BlankAnswer[];
  
  /** Whether all blanks were answered correctly */
  overallCorrect: boolean;
  
  /** Score as percentage (0-100) */
  score: number;
  
  /** Unix timestamp when the answer was submitted */
  timestamp: number;
  
  /** Time spent on this question in milliseconds */
  timeSpentMs?: number;
}

// =============================================================================
// DRAG AND DROP ANSWER
// =============================================================================

/**
 * Individual placement within a drag-and-drop question
 */
export interface PlacementResult {
  /** ID of the item that was placed */
  itemId: string;
  
  /** Content/text of the placed item */
  itemContent: string;
  
  /** ID of the target zone where item was placed */
  targetId: string;
  
  /** Label of the target zone */
  targetLabel: string;
  
  /** Whether this placement was correct */
  isCorrect: boolean;
}

/**
 * Answer data for a drag-and-drop question.
 * Tracks each placement for detailed feedback.
 */
export interface DragDropAnswer {
  /** Discriminator field */
  readonly type: 'dragDrop';
  
  /** Unique identifier for the question within the lesson */
  questionId: string;
  
  /** Array of placement results */
  placements: PlacementResult[];
  
  /** Whether all placements were correct */
  overallCorrect: boolean;
  
  /** Score as percentage (0-100) */
  score: number;
  
  /** Unix timestamp when the answer was submitted */
  timestamp: number;
  
  /** Time spent on this question in milliseconds */
  timeSpentMs?: number;
  
  /** 
   * Seed used for shuffling items.
   * Store this to recreate the same order on restoration.
   */
  shuffleSeed?: number;
}

// =============================================================================
// MIXED LESSON ANSWER
// =============================================================================

/**
 * Answer data for a mixed lesson containing multiple questions.
 * Aggregates answers from all individual questions.
 */
export interface MixedLessonAnswer {
  /** Discriminator field */
  readonly type: 'mixed';
  
  /** Lesson ID this answer belongs to */
  lessonId: string;
  
  /** 
   * Array of answers for each question in order.
   * Index corresponds to question index in the lesson.
   */
  questionAnswers: QuizAnswer[];
  
  /** Overall score as percentage (0-100) */
  overallScore: number;
  
  /** Number of questions answered correctly */
  questionsCorrect: number;
  
  /** Total number of questions in the lesson */
  totalQuestions: number;
  
  /** Unix timestamp when all questions were completed */
  completedAt: number;
  
  /** Total time spent on all questions in milliseconds */
  totalTimeSpentMs?: number;
}

// =============================================================================
// ATTEMPT RECORD
// =============================================================================

/**
 * Record of a single attempt at answering a question/lesson
 */
export interface AttemptRecord {
  /** Sequential attempt number (1-based) */
  attemptNumber: number;
  
  /** The answer submitted in this attempt */
  answer: QuizAnswer;
  
  /** Unix timestamp of the attempt */
  timestamp: number;
  
  /** Time spent on this attempt in milliseconds */
  timeSpentMs: number;
}

// =============================================================================
// LESSON PROGRESS STATE
// =============================================================================

/**
 * Complete progress state for a lesson.
 * This is the primary state object managed by QuizStateContext.
 */
export interface LessonProgressState {
  /** Convex lesson ID */
  lessonId: Id<'capsuleLessons'>;
  
  /** Convex capsule ID */
  capsuleId: Id<'capsules'>;
  
  /** Convex module ID */
  moduleId: Id<'capsuleModules'>;
  
  /** Convex user ID */
  userId: Id<'users'>;
  
  /** Lesson type (mcq, fillBlanks, dragDrop, mixed, etc.) */
  lessonType: LessonType;
  
  /** Whether the lesson is completed */
  completed: boolean;
  
  /** Unix timestamp of completion */
  completedAt?: number;
  
  /** Current attempt number (increments on retry) */
  currentAttempt: number;
  
  /** History of all attempts */
  attempts: AttemptRecord[];
  
  /** The most recent answer (for quick restoration) */
  lastAnswer?: ExtendedQuizAnswer;
  
  /** Most recent score (0-100) */
  aggregateScore: number;
  
  /** Best score achieved across all attempts (0-100) */
  bestScore: number;
  
  /** Total time spent on this lesson in milliseconds */
  timeSpentTotal: number;
  
  /** Total hints used across all attempts */
  hintsUsed: number;
}

// =============================================================================
// MIXED LESSON PROGRESS STATE
// =============================================================================

/**
 * Progress state for individual questions within a mixed lesson
 */
export interface QuestionState {
  /** Zero-based question index */
  questionIndex: number;
  
  /** Question type for this specific question */
  questionType: 'mcq' | 'fillBlanks' | 'dragDrop';
  
  /** Whether this question has been answered */
  answered: boolean;
  
  /** The answer for this question (if answered) */
  answer?: QuizAnswer;
}

/**
 * Extended progress state for mixed lessons.
 * Tracks per-question progress in addition to overall lesson progress.
 */
export interface MixedLessonProgressState {
  /** Current question index being viewed */
  currentQuestionIndex: number;
  
  /** State of each question */
  questionStates: QuestionState[];
  
  /** Whether all questions have been answered */
  allQuestionsAnswered: boolean;
}

// =============================================================================
// LESSON TYPES
// =============================================================================

/**
 * All supported lesson types
 */
export type LessonType = 
  | 'concept'
  | 'mcq'
  | 'fillBlanks'
  | 'dragDrop'
  | 'simulation'
  | 'mixed';

// =============================================================================
// SYNC STATUS
// =============================================================================

/**
 * Status of synchronization with the server
 */
export type SyncStatus = 
  | 'idle'
  | 'pending'
  | 'syncing'
  | 'success'
  | 'error';

/**
 * Sync state including error information
 */
export interface SyncState {
  status: SyncStatus;
  lastSyncAt?: number;
  error?: Error;
  pendingChanges: number;
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard to check if an answer is an MCQ answer
 */
export function isMCQAnswer(answer: QuizAnswer | ExtendedQuizAnswer): answer is MCQAnswer {
  return answer.type === 'mcq';
}

/**
 * Type guard to check if an answer is a fill-in-the-blanks answer
 */
export function isFillBlanksAnswer(answer: QuizAnswer | ExtendedQuizAnswer): answer is FillBlanksAnswer {
  return answer.type === 'fillBlanks';
}

/**
 * Type guard to check if an answer is a drag-and-drop answer
 */
export function isDragDropAnswer(answer: QuizAnswer | ExtendedQuizAnswer): answer is DragDropAnswer {
  return answer.type === 'dragDrop';
}

/**
 * Type guard to check if an answer is a mixed lesson answer
 */
export function isMixedLessonAnswer(answer: ExtendedQuizAnswer): answer is MixedLessonAnswer {
  return answer.type === 'mixed';
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Extract the answer type from a quiz answer
 */
export type AnswerType = QuizAnswer['type'];

/**
 * Get the correct answer type for a given lesson type
 */
export type AnswerForLessonType<T extends LessonType> = 
  T extends 'mcq' ? MCQAnswer :
  T extends 'fillBlanks' ? FillBlanksAnswer :
  T extends 'dragDrop' ? DragDropAnswer :
  T extends 'mixed' ? MixedLessonAnswer :
  never;

/**
 * Props that all quiz components should accept for restoration
 */
export interface QuizRestorationProps<T extends QuizAnswer = QuizAnswer> {
  /** Whether the lesson is already completed */
  isCompleted: boolean;
  
  /** The restored answer (if lesson was previously completed) */
  restoredAnswer?: T;
}

/**
 * Callback for when a quiz answer is submitted
 */
export type OnAnswerSubmit<T extends QuizAnswer = QuizAnswer> = (answer: T) => void;

/**
 * Callback for when a hint is viewed
 */
export type OnHintViewed = (questionId: string) => void;
