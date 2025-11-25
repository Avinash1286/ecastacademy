/**
 * Generation Stage Types
 */

import type { LessonType, GenerationStage } from "../../schemas/types";

// =============================================================================
// Stage Input/Output Types
// =============================================================================

export interface StageContext {
  generationId: string;
  capsuleId: string;
  attempt: number;
  maxAttempts: number;
}

export type StageResult<T> = 
  | {
      success: true;
      data: T;
      tokensUsed: number;
      durationMs: number;
    }
  | {
      success: false;
      error: string;
      errorCode: string;
      tokensUsed: number;
      durationMs: number;
      retriable: boolean;
    };

// =============================================================================
// Stage 1: Outline
// =============================================================================

export interface OutlineInput {
  sourceType: "pdf" | "topic";
  topic?: string;
  pdfBase64?: string;
  pdfMimeType?: string;
  guidance?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  targetModuleCount?: number;
}

export interface OutlineOutput {
  title: string;
  description: string;
  estimatedDuration: number;
  modules: Array<{
    title: string;
    description: string;
    lessonCount: number;
  }>;
}

// =============================================================================
// Stage 2: Lesson Plan (per module)
// =============================================================================

export interface LessonPlanInput {
  capsuleTitle: string;
  capsuleDescription: string;
  moduleTitle: string;
  moduleDescription: string;
  moduleIndex: number;
  lessonCount: number;
  sourceType: "pdf" | "topic";
  topic?: string;
  pdfBase64?: string;
  pdfMimeType?: string;
  guidance?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
}

export interface LessonPlanOutput {
  moduleTitle: string;
  lessons: Array<{
    title: string;
    lessonType: LessonType;
    objective: string;
  }>;
}

// =============================================================================
// Stage 3: Lesson Content (per lesson)
// =============================================================================

export interface LessonContentInput {
  capsuleTitle: string;
  moduleTitle: string;
  lessonTitle: string;
  lessonType: LessonType;
  lessonObjective: string;
  moduleIndex: number;
  lessonIndex: number;
  sourceType: "pdf" | "topic";
  topic?: string;
  pdfBase64?: string;
  pdfMimeType?: string;
  guidance?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  // Context from previous lessons for coherence
  previousLessons?: Array<{
    title: string;
    type: LessonType;
  }>;
}

export interface LessonContentOutput {
  lessonTitle: string;
  lessonType: LessonType;
  content: unknown; // Type depends on lessonType
}

// =============================================================================
// Generation Job State
// =============================================================================

export interface GenerationJobState {
  generationId: string;
  capsuleId: string;
  stage: GenerationStage;
  
  // Input
  input: OutlineInput;
  
  // Progress
  currentModule: number;
  totalModules: number;
  currentLesson: number;
  totalLessons: number;
  
  // Accumulated results
  outline?: OutlineOutput;
  lessonPlans: LessonPlanOutput[];
  lessonContents: Array<{
    moduleIndex: number;
    lessonIndex: number;
    content: LessonContentOutput;
  }>;
  
  // Retry tracking
  attemptCount: number;
  lastError?: string;
  lastErrorCode?: string;
  
  // Timing
  startedAt: number;
  lastUpdatedAt: number;
  completedAt?: number;
}

// =============================================================================
// Stage Callbacks
// =============================================================================

export interface StageCallbacks {
  onStageStart?: (stage: GenerationStage, context: StageContext) => Promise<void>;
  onStageComplete?: (stage: GenerationStage, context: StageContext) => Promise<void>;
  onStageError?: (stage: GenerationStage, error: string, context: StageContext) => Promise<void>;
  onProgress?: (message: string, context: StageContext) => Promise<void>;
}
