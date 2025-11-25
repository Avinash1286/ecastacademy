/**
 * Core TypeScript types for capsule generation.
 * These types are the canonical definitions - schemas derive from them.
 */

// =============================================================================
// Lesson Types
// =============================================================================

export type LessonType = 
  | "mcq" 
  | "concept" 
  | "fillBlanks" 
  | "dragDrop" 
  | "simulation";

export const LESSON_TYPES: readonly LessonType[] = [
  "mcq",
  "concept", 
  "fillBlanks",
  "dragDrop",
  "simulation",
] as const;

// =============================================================================
// Visual Aid Types (for concept lessons)
// =============================================================================

export type VisualAidType = "diagram" | "flowchart" | "animation" | "visualization";

export interface VisualAidCode {
  html?: string;
  css?: string;
  javascript: string;
}

export interface VisualAid {
  type: VisualAidType;
  description: string;
  code?: VisualAidCode;
}

// =============================================================================
// MCQ Content
// =============================================================================

export interface MCQContent {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  hint?: string;
}

// =============================================================================
// Concept Content
// =============================================================================

export interface ConceptContent {
  conceptTitle: string;
  explanation: string;
  visualAid?: VisualAid;
  keyPoints: string[];
  realWorldExample?: string;
}

// =============================================================================
// Fill Blanks Content
// =============================================================================

export interface FillBlank {
  id: string;
  correctAnswer: string;
  alternatives?: string[];
  hint?: string;
}

export interface FillBlanksContent {
  instruction: string;
  text: string;
  blanks: FillBlank[];
}

// =============================================================================
// Drag Drop Content
// =============================================================================

export type DragDropActivityType = "matching" | "ordering" | "categorization";

export interface DragDropItem {
  id: string;
  content: string;
  category?: string;
}

export interface DragDropTarget {
  id: string;
  label: string;
  acceptsItems: string[];
}

export interface DragDropFeedback {
  correct: string;
  incorrect: string;
}

export interface DragDropContent {
  instruction: string;
  activityType?: DragDropActivityType;
  items: DragDropItem[];
  targets: DragDropTarget[];
  feedback?: DragDropFeedback;
}

// =============================================================================
// Simulation Content
// =============================================================================

export type SimulationType = "html-css-js";

export interface SimulationCode {
  html?: string;
  css?: string;
  javascript: string;
}

export interface SimulationContent {
  title: string;
  description: string;
  simulationType: SimulationType;
  code: SimulationCode;
  instructions: string;
  observationPrompts?: string[];
  learningGoals?: string[];
}

// =============================================================================
// Union Content Type
// =============================================================================

export type LessonContent = 
  | MCQContent 
  | ConceptContent 
  | FillBlanksContent 
  | DragDropContent 
  | SimulationContent;

// =============================================================================
// Lesson Structure
// =============================================================================

export interface CapsuleLesson {
  title: string;
  lessonType: LessonType;
  content: LessonContent;
}

// =============================================================================
// Module Structure
// =============================================================================

export interface CapsuleModule {
  title: string;
  description: string;
  lessons: CapsuleLesson[];
}

// =============================================================================
// Full Capsule Structure
// =============================================================================

export interface GeneratedCapsule {
  title: string;
  description: string;
  estimatedDuration: number;
  modules: CapsuleModule[];
}

// =============================================================================
// Generation Stages - Used for multi-stage generation
// =============================================================================

/**
 * Stage 1: Outline - Just module structure, no lessons
 */
export interface CapsuleOutline {
  title: string;
  description: string;
  estimatedDuration: number;
  modules: {
    title: string;
    description: string;
    lessonCount: number;
  }[];
}

/**
 * Stage 2: Lesson Plan - Lesson titles and types for a module
 */
export interface ModuleLessonPlan {
  moduleTitle: string;
  lessons: {
    title: string;
    lessonType: LessonType;
    objective: string;
  }[];
}

/**
 * Stage 3: Individual lesson content - one lesson at a time
 */
export interface LessonContentResult {
  lessonTitle: string;
  lessonType: LessonType;
  content: LessonContent;
}

// =============================================================================
// Input Types
// =============================================================================

export type SourceType = "pdf" | "topic";

export interface GenerationInput {
  sourceType: SourceType;
  topic?: string;
  pdfBase64?: string;
  pdfMimeType?: string;
  guidance?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  targetLessonCount?: number;
}

// =============================================================================
// Generation State
// =============================================================================

export type GenerationStage = 
  | "pending"
  | "parsing_input"
  | "generating_outline"
  | "generating_lessons"
  | "generating_content"
  | "validating"
  | "persisting"
  | "completed"
  | "failed";

export interface GenerationProgress {
  stage: GenerationStage;
  currentModule?: number;
  totalModules?: number;
  currentLesson?: number;
  totalLessons?: number;
  message?: string;
}
