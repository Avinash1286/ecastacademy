/**
 * Quiz Answer Adapters
 * 
 * Type-safe factory functions for creating quiz answers.
 * These adapters ensure consistent answer structure across all components.
 * 
 * @module src/lib/quiz/adapters
 */

import type {
  QuizAnswer,
  MCQAnswer,
  FillBlanksAnswer,
  DragDropAnswer,
  MixedLessonAnswer,
  BlankAnswer,
  PlacementResult,
} from '../../../shared/quiz/types';

// =============================================================================
// MCQ ANSWER ADAPTER
// =============================================================================

export interface CreateMCQAnswerParams {
  questionId: string;
  selectedIndex: number;
  options: string[];
  correctIndex: number;
  timeSpentMs?: number;
  hintUsed?: boolean;
}

/**
 * Create a type-safe MCQ answer object.
 * 
 * @example
 * ```ts
 * const answer = createMCQAnswer({
 *   questionId: 'q1',
 *   selectedIndex: 2,
 *   options: ['A', 'B', 'C', 'D'],
 *   correctIndex: 2,
 *   timeSpentMs: 15000,
 * });
 * // answer.isCorrect === true
 * ```
 */
export function createMCQAnswer(params: CreateMCQAnswerParams): MCQAnswer {
  const {
    questionId,
    selectedIndex,
    options,
    correctIndex,
    timeSpentMs,
    hintUsed,
  } = params;

  // Validate indices are within bounds
  const safeSelectedIndex = Math.max(0, Math.min(selectedIndex, options.length - 1));
  const safeCorrectIndex = Math.max(0, Math.min(correctIndex, options.length - 1));

  return {
    type: 'mcq',
    questionId,
    selectedIndex: safeSelectedIndex,
    selectedText: options[safeSelectedIndex] || '',
    correctIndex: safeCorrectIndex,
    correctText: options[safeCorrectIndex] || '',
    isCorrect: safeSelectedIndex === safeCorrectIndex,
    options: [...options], // Clone to prevent mutation
    timestamp: Date.now(),
    timeSpentMs,
    hintUsed,
  };
}

// =============================================================================
// FILL IN THE BLANKS ANSWER ADAPTER
// =============================================================================

export interface BlankData {
  blankId: string;
  userAnswer: string;
  correctAnswer: string;
  alternatives?: string[];
  hintUsed?: boolean;
}

export interface CreateFillBlanksAnswerParams {
  questionId: string;
  blanks: BlankData[];
  timeSpentMs?: number;
}

/**
 * Normalize a string for comparison (lowercase, trimmed)
 */
function normalizeString(str: string): string {
  return str.toLowerCase().trim();
}

/**
 * Check if a user answer matches the correct answer or any alternative
 */
function isBlankCorrect(
  userAnswer: string,
  correctAnswer: string,
  alternatives: string[] = []
): boolean {
  const normalizedUser = normalizeString(userAnswer);
  const normalizedCorrect = normalizeString(correctAnswer);
  const normalizedAlts = alternatives.map(normalizeString);

  return (
    normalizedUser === normalizedCorrect ||
    normalizedAlts.includes(normalizedUser)
  );
}

/**
 * Create a type-safe Fill-in-the-Blanks answer object.
 * Automatically calculates correctness for each blank and overall score.
 * 
 * @example
 * ```ts
 * const answer = createFillBlanksAnswer({
 *   questionId: 'q1',
 *   blanks: [
 *     { blankId: 'b1', userAnswer: 'function', correctAnswer: 'function' },
 *     { blankId: 'b2', userAnswer: 'returns', correctAnswer: 'return', alternatives: ['returns'] },
 *   ],
 * });
 * // answer.score === 100 (both correct)
 * ```
 */
export function createFillBlanksAnswer(params: CreateFillBlanksAnswerParams): FillBlanksAnswer {
  const { questionId, blanks, timeSpentMs } = params;

  // Process each blank and determine correctness
  const processedBlanks: BlankAnswer[] = blanks.map((blank) => ({
    blankId: blank.blankId,
    userAnswer: blank.userAnswer,
    correctAnswer: blank.correctAnswer,
    alternatives: blank.alternatives || [],
    isCorrect: isBlankCorrect(
      blank.userAnswer,
      blank.correctAnswer,
      blank.alternatives
    ),
    hintUsed: blank.hintUsed,
  }));

  // Calculate overall correctness and score
  const correctCount = processedBlanks.filter((b) => b.isCorrect).length;
  const totalBlanks = processedBlanks.length;
  const score = totalBlanks > 0 ? Math.round((correctCount / totalBlanks) * 100) : 0;

  return {
    type: 'fillBlanks',
    questionId,
    blanks: processedBlanks,
    overallCorrect: correctCount === totalBlanks,
    score,
    timestamp: Date.now(),
    timeSpentMs,
  };
}

// =============================================================================
// DRAG AND DROP ANSWER ADAPTER
// =============================================================================

export interface ItemData {
  id: string;
  content: string;
}

export interface TargetData {
  id: string;
  label: string;
  acceptsItems: string[];
}

export interface CreateDragDropAnswerParams {
  questionId: string;
  /** Map of targetId -> itemId */
  placements: Record<string, string>;
  items: ItemData[];
  targets: TargetData[];
  timeSpentMs?: number;
  shuffleSeed?: number;
}

/**
 * Create a type-safe Drag-and-Drop answer object.
 * Automatically determines correctness for each placement.
 * 
 * @example
 * ```ts
 * const answer = createDragDropAnswer({
 *   questionId: 'q1',
 *   placements: { 'target1': 'item1', 'target2': 'item2' },
 *   items: [{ id: 'item1', content: 'Function' }, { id: 'item2', content: 'Variable' }],
 *   targets: [
 *     { id: 'target1', label: 'Callable', acceptsItems: ['item1'] },
 *     { id: 'target2', label: 'Storage', acceptsItems: ['item2'] },
 *   ],
 * });
 * // answer.overallCorrect === true
 * ```
 */
export function createDragDropAnswer(params: CreateDragDropAnswerParams): DragDropAnswer {
  const { questionId, placements, items, targets, timeSpentMs, shuffleSeed } = params;

  // Create a map for quick item lookup
  const itemMap = new Map(items.map((item) => [item.id, item]));

  // Process each target and determine correctness
  const placementResults: PlacementResult[] = targets.map((target) => {
    const placedItemId = placements[target.id] || '';
    const placedItem = itemMap.get(placedItemId);
    const isCorrect = !!placedItemId && target.acceptsItems.includes(placedItemId);

    return {
      itemId: placedItemId,
      itemContent: placedItem?.content || '',
      targetId: target.id,
      targetLabel: target.label,
      isCorrect,
    };
  });

  // Calculate overall correctness and score
  const correctCount = placementResults.filter((p) => p.isCorrect).length;
  const totalTargets = placementResults.length;
  const score = totalTargets > 0 ? Math.round((correctCount / totalTargets) * 100) : 0;

  return {
    type: 'dragDrop',
    questionId,
    placements: placementResults,
    overallCorrect: correctCount === totalTargets,
    score,
    timestamp: Date.now(),
    timeSpentMs,
    shuffleSeed,
  };
}

// =============================================================================
// MIXED LESSON ANSWER ADAPTER
// =============================================================================

export interface CreateMixedLessonAnswerParams {
  lessonId: string;
  questionAnswers: QuizAnswer[];
  totalTimeSpentMs?: number;
}

/**
 * Create a type-safe Mixed Lesson answer object.
 * Aggregates scores from all individual question answers.
 * 
 * @example
 * ```ts
 * const answer = createMixedLessonAnswer({
 *   lessonId: 'lesson1',
 *   questionAnswers: [mcqAnswer, fillBlanksAnswer, dragDropAnswer],
 * });
 * // answer.overallScore is weighted average of all questions
 * ```
 */
export function createMixedLessonAnswer(params: CreateMixedLessonAnswerParams): MixedLessonAnswer {
  const { lessonId, questionAnswers, totalTimeSpentMs } = params;

  // Calculate aggregate statistics
  let questionsCorrect = 0;
  let totalScore = 0;

  for (const answer of questionAnswers) {
    switch (answer.type) {
      case 'mcq':
        if (answer.isCorrect) questionsCorrect++;
        totalScore += answer.isCorrect ? 100 : 0;
        break;
      case 'fillBlanks':
        if (answer.overallCorrect) questionsCorrect++;
        totalScore += answer.score;
        break;
      case 'dragDrop':
        if (answer.overallCorrect) questionsCorrect++;
        totalScore += answer.score;
        break;
    }
  }

  const totalQuestions = questionAnswers.length;
  const overallScore = totalQuestions > 0
    ? Math.round(totalScore / totalQuestions)
    : 0;

  return {
    type: 'mixed',
    lessonId,
    questionAnswers,
    overallScore,
    questionsCorrect,
    totalQuestions,
    completedAt: Date.now(),
    totalTimeSpentMs,
  };
}

// =============================================================================
// ANSWER VALIDATION & RESTORATION
// =============================================================================

/**
 * Safely parse JSON data with fallback
 */
export function safeJsonParse<T>(data: string | undefined | null, fallback: T): T {
  if (!data) return fallback;
  
  try {
    return JSON.parse(data) as T;
  } catch {
    console.warn('[Quiz] Failed to parse JSON data:', data);
    return fallback;
  }
}

/**
 * Validate that an object has the required MCQ answer fields
 */
function validateMCQAnswer(obj: Record<string, unknown>): boolean {
  return (
    typeof obj.type === 'string' &&
    obj.type === 'mcq' &&
    typeof obj.selectedIndex === 'number' &&
    typeof obj.correctIndex === 'number' &&
    typeof obj.isCorrect === 'boolean' &&
    Array.isArray(obj.options)
  );
}

/**
 * Validate that an object has the required FillBlanks answer fields
 */
function validateFillBlanksAnswer(obj: Record<string, unknown>): boolean {
  return (
    typeof obj.type === 'string' &&
    obj.type === 'fillBlanks' &&
    Array.isArray(obj.blanks) &&
    typeof obj.score === 'number' &&
    typeof obj.overallCorrect === 'boolean'
  );
}

/**
 * Validate that an object has the required DragDrop answer fields
 */
function validateDragDropAnswer(obj: Record<string, unknown>): boolean {
  return (
    typeof obj.type === 'string' &&
    obj.type === 'dragDrop' &&
    Array.isArray(obj.placements) &&
    typeof obj.score === 'number' &&
    typeof obj.overallCorrect === 'boolean'
  );
}

/**
 * Safely restore a quiz answer from unknown data.
 * Returns null if the data is invalid or unrecognized.
 * 
 * @example
 * ```ts
 * const answer = restoreAnswer(dbData);
 * if (answer) {
 *   switch (answer.type) {
 *     case 'mcq': // TypeScript knows this is MCQAnswer
 *     // ...
 *   }
 * }
 * ```
 */
export function restoreAnswer(data: unknown): QuizAnswer | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const obj = data as Record<string, unknown>;

  // Validate discriminator field exists
  if (!('type' in obj) || typeof obj.type !== 'string') {
    return null;
  }

  // Validate based on type - cast through unknown for type safety
  switch (obj.type) {
    case 'mcq':
      return validateMCQAnswer(obj) ? (obj as unknown as MCQAnswer) : null;
    case 'fillBlanks':
      return validateFillBlanksAnswer(obj) ? (obj as unknown as FillBlanksAnswer) : null;
    case 'dragDrop':
      return validateDragDropAnswer(obj) ? (obj as unknown as DragDropAnswer) : null;
    default:
      console.warn('[Quiz] Unknown answer type:', obj.type);
      return null;
  }
}

/**
 * Check if a quiz answer indicates correct response
 */
export function isAnswerCorrect(answer: QuizAnswer): boolean {
  switch (answer.type) {
    case 'mcq':
      return answer.isCorrect;
    case 'fillBlanks':
      return answer.overallCorrect;
    case 'dragDrop':
      return answer.overallCorrect;
    default:
      return false;
  }
}

/**
 * Get the score from a quiz answer (0-100)
 */
export function getAnswerScore(answer: QuizAnswer): number {
  switch (answer.type) {
    case 'mcq':
      return answer.isCorrect ? 100 : 0;
    case 'fillBlanks':
      return answer.score;
    case 'dragDrop':
      return answer.score;
    default:
      return 0;
  }
}

// =============================================================================
// LEGACY ANSWER CONVERSION
// =============================================================================

/**
 * Legacy answer format from the old system
 */
export interface LegacyLastAnswer {
  selectedAnswer: string;
  selectedIndex?: number;
  correctAnswer?: string;
  correctIndex?: number;
  isCorrect: boolean;
  options?: string[];
}

/**
 * Convert a legacy MCQ answer to the new typed format.
 * Used for migration of existing data.
 */
export function convertLegacyMCQAnswer(
  legacy: LegacyLastAnswer,
  questionId: string = 'legacy'
): MCQAnswer | null {
  // Need at minimum: selectedIndex, options
  if (
    typeof legacy.selectedIndex !== 'number' ||
    !Array.isArray(legacy.options) ||
    legacy.options.length === 0
  ) {
    return null;
  }

  const selectedIndex = legacy.selectedIndex;
  const correctIndex = typeof legacy.correctIndex === 'number' 
    ? legacy.correctIndex 
    : (legacy.options.findIndex(o => o === legacy.correctAnswer) ?? 0);

  return {
    type: 'mcq',
    questionId,
    selectedIndex,
    selectedText: legacy.selectedAnswer || legacy.options[selectedIndex] || '',
    correctIndex,
    correctText: legacy.correctAnswer || legacy.options[correctIndex] || '',
    isCorrect: legacy.isCorrect,
    options: legacy.options,
    timestamp: Date.now(),
  };
}

/**
 * Try to convert legacy serialized answers (JSON strings) to typed format.
 * This handles the case where selectedAnswer contains JSON-encoded data.
 */
export function convertLegacySerializedAnswer(
  selectedAnswer: string,
  answerType: 'fillBlanks' | 'dragDrop',
  questionId: string = 'legacy'
): QuizAnswer | null {
  try {
    const parsed = JSON.parse(selectedAnswer);

    if (answerType === 'fillBlanks' && typeof parsed === 'object') {
      // Legacy format: { blankId: userAnswer, ... }
      // Note: We can't calculate correctness without knowing correct answers
      // Mark all as incorrect and let the component re-evaluate
      return {
        type: 'fillBlanks' as const,
        questionId,
        blanks: Object.entries(parsed).map(([blankId, userAnswer]) => ({
          blankId,
          userAnswer: String(userAnswer),
          correctAnswer: '', // Unknown from legacy data
          alternatives: [] as string[], // Ensure non-optional array
          isCorrect: false,
        })),
        overallCorrect: false,
        score: 0,
        timestamp: Date.now(),
      };
    }

    if (answerType === 'dragDrop' && typeof parsed === 'object') {
      // Legacy format: { itemId: targetId, ... } or { targetId: itemId, ... }
      // We store as placements array but need to reconstruct
      const placements: PlacementResult[] = Object.entries(parsed).map(
        ([targetId, itemId]) => ({
          itemId: String(itemId),
          itemContent: '',
          targetId,
          targetLabel: '',
          isCorrect: false, // Unknown without target data
        })
      );

      return {
        type: 'dragDrop',
        questionId,
        placements,
        overallCorrect: false,
        score: 0,
        timestamp: Date.now(),
      };
    }
  } catch {
    // Not valid JSON, return null
  }

  return null;
}
