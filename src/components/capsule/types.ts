/**
 * Quiz Component Type Definitions
 * 
 * Props interfaces for quiz components with proper typing.
 * 
 * @module src/components/capsule/types
 */

import type {
  QuizAnswer,
  MCQAnswer,
  FillBlanksAnswer,
  DragDropAnswer,
  OnAnswerSubmit,
  OnHintViewed,
} from '../../../shared/quiz/types';

// =============================================================================
// BASE QUIZ PROPS
// =============================================================================

/**
 * Base props that all quiz components should accept
 */
export interface BaseQuizProps<T extends QuizAnswer = QuizAnswer> {
  /** Unique identifier for this question */
  questionId?: string;
  
  /** Whether the lesson/question is already completed */
  isCompleted: boolean;
  
  /** Callback when an answer is submitted */
  onComplete: OnAnswerSubmit<T>;
  
  /** Callback when a hint is viewed */
  onHintViewed?: OnHintViewed;
  
  /** Previously saved answer to restore (if lesson was completed) */
  restoredAnswer?: T;
}

// =============================================================================
// MCQ LESSON PROPS
// =============================================================================

/**
 * Props for MCQ (Multiple Choice Question) component
 */
export interface MCQLessonProps extends BaseQuizProps<MCQAnswer> {
  /** The question text */
  question: string;
  
  /** Available answer options */
  options: string[];
  
  /** Index of the correct answer */
  correctIndex: number;
  
  /** Explanation shown after answering */
  explanation?: string;
  
  /** Hint text (shown before answering if requested) */
  hint?: string;
  
  // Legacy props for backward compatibility
  /** @deprecated Use correctIndex instead */
  correctAnswer?: number;
  
  /** 
   * Legacy callback for quiz answer.
   * @deprecated Use onComplete with typed answer instead 
   */
  onQuizAnswer?: (data: {
    questionText: string;
    selectedAnswer: string;
    selectedIndex: number;
    correctAnswer: string;
    correctIndex: number;
    isCorrect: boolean;
    options: string[];
  }) => void;
  
  /** 
   * Legacy lastAnswer format
   * @deprecated Use restoredAnswer instead 
   */
  lastAnswer?: {
    selectedIndex?: number;
    selectedAnswer?: string;
    isCorrect?: boolean;
  };
}

// =============================================================================
// FILL IN THE BLANKS PROPS
// =============================================================================

/**
 * Individual blank definition
 */
export interface BlankDefinition {
  /** Unique identifier for the blank */
  id: string;
  
  /** Position in the text (optional, inferred from {{id}} markers) */
  position?: number;
  
  /** The correct answer for this blank */
  correctAnswer: string;
  
  /** Alternative acceptable answers */
  alternatives?: string[];
  
  /** Hint for this specific blank */
  hint?: string;
}

/**
 * Feedback messages for fill-in-the-blanks
 */
export interface FillBlanksFeedback {
  /** Message when all blanks are correct */
  allCorrect?: string;
  
  /** Message when some blanks are correct */
  partial?: string;
  
  /** General hint message */
  hint?: string;
}

/**
 * Props for Fill-in-the-Blanks component
 */
export interface FillBlanksLessonProps extends BaseQuizProps<FillBlanksAnswer> {
  /** Instructions for the user */
  instruction?: string;
  
  /** Text with {{blankId}} placeholders */
  text?: string;
  
  /** @deprecated Use text instead */
  sentence?: string;
  
  /** Blank definitions */
  blanks?: BlankDefinition[];
  
  /** Feedback messages */
  feedback?: FillBlanksFeedback;
  
  /** 
   * Legacy callback for quiz answer.
   * @deprecated Use onComplete with typed answer instead 
   */
  onQuizAnswer?: (data: {
    questionText: string;
    answers: Record<string, string>;
    correctAnswers: Record<string, string>;
    isCorrect: boolean;
    score: number;
  }) => void;
  
  /** 
   * Legacy lastAnswer format
   * @deprecated Use restoredAnswer instead 
   */
  lastAnswer?: {
    answers?: Record<string, string>;
  };
}

// =============================================================================
// DRAG AND DROP PROPS
// =============================================================================

/**
 * Draggable item definition
 */
export interface DragItem {
  /** Unique identifier */
  id: string;
  
  /** Display content */
  content: string;
  
  /** Category for categorization activities */
  category?: string;
}

/**
 * Drop target definition
 */
export interface DropTarget {
  /** Unique identifier */
  id: string;
  
  /** Display label */
  label: string;
  
  /** IDs of items that can be dropped here */
  acceptsItems?: string[];
  
  /** @deprecated Use acceptsItems instead */
  correctItemIds?: string[];
}

/**
 * Feedback messages for drag-and-drop
 */
export interface DragDropFeedback {
  /** Message when all placements are correct */
  correct?: string;
  
  /** Message when some placements are incorrect */
  incorrect?: string;
}

/**
 * Props for Drag-and-Drop component
 */
export interface DragDropLessonProps extends BaseQuizProps<DragDropAnswer> {
  /** Instructions for the user */
  instruction?: string;
  
  /** Activity type (affects validation logic) */
  activityType?: 'matching' | 'ordering' | 'categorization';
  
  /** Items to drag */
  items?: DragItem[];
  
  /** Drop targets */
  targets?: DropTarget[];
  
  /** Feedback messages */
  feedback?: DragDropFeedback;
  
  /** 
   * Legacy callback for quiz answer.
   * @deprecated Use onComplete with typed answer instead 
   */
  onQuizAnswer?: (data: {
    questionText: string;
    placements: Record<string, string>;
    isCorrect: boolean;
    items: Array<{ id: string; content: string }>;
    targets: Array<{ id: string; label: string }>;
  }) => void;
  
  /** 
   * Legacy lastAnswer format
   * @deprecated Use restoredAnswer instead 
   */
  lastAnswer?: {
    placements?: Record<string, string>;
  };
}

// =============================================================================
// MIXED LESSON PROPS
// =============================================================================

/**
 * Content section in a mixed lesson
 */
export interface ContentSection {
  type?: string;
  title?: string;
  content?: string;
  text?: string;
  keyPoints?: string[];
}

/**
 * Code example in a mixed lesson
 */
export interface CodeExample {
  title?: string;
  code?: string;
  language?: string;
  explanation?: string;
}

/**
 * Interactive visualization in a mixed lesson
 */
export interface InteractiveVisualization {
  title?: string;
  description?: string;
  type?: string;
  html?: string;
  css?: string;
  javascript?: string;
}

/**
 * MCQ practice question
 */
export interface MCQPracticeQuestion {
  type: 'mcq';
  question: string;
  options: string[];
  correctIndex: number;
  correct?: number; // Legacy field
  explanation?: string;
}

/**
 * Fill-in-blanks practice question
 */
export interface FillBlanksPracticeQuestion {
  type: 'fillBlanks';
  instruction?: string;
  text: string;
  blanks: BlankDefinition[];
}

/**
 * Drag-and-drop practice question
 */
export interface DragDropPracticeQuestion {
  type: 'dragDrop';
  instruction?: string;
  items: DragItem[];
  targets: DropTarget[];
  feedback?: DragDropFeedback;
}

/**
 * Union type for all practice question types
 */
export type PracticeQuestion =
  | MCQPracticeQuestion
  | FillBlanksPracticeQuestion
  | DragDropPracticeQuestion;

/**
 * Props for Mixed Lesson component
 */
export interface MixedLessonProps {
  /** Nested content structure (alternative to direct props) */
  content?: {
    sections?: ContentSection[];
    codeExamples?: CodeExample[];
    interactiveVisualizations?: InteractiveVisualization[];
    practiceQuestions?: PracticeQuestion[];
  };
  
  /** Direct props alternatives */
  sections?: ContentSection[];
  codeExamples?: CodeExample[];
  interactiveVisualizations?: InteractiveVisualization[];
  practiceQuestions?: PracticeQuestion[];
  
  /** Completion callback */
  onComplete?: (score?: number) => void;
  
  /** Quiz answer callback for individual questions */
  onQuizAnswer?: (data: {
    selectedAnswer: string;
    selectedIndex?: number;
    correctAnswer: string;
    correctIndex?: number;
    isCorrect: boolean;
    options?: string[];
  }) => void;
  
  /** Whether the lesson is completed */
  isCompleted?: boolean;
  
  /** Last answer for restoration */
  lastAnswer?: {
    selectedIndex?: number;
    isCorrect?: boolean;
  };
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Extract the answer type from lesson props
 */
export type AnswerFromProps<T> = T extends BaseQuizProps<infer A> ? A : never;

/**
 * Props with legacy support stripped
 */
export type ModernQuizProps<T extends BaseQuizProps> = Omit<
  T,
  'onQuizAnswer' | 'lastAnswer'
>;
