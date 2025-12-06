/**
 * Shared Types for Capsule Generation
 * 
 * This file contains type definitions that are shared across
 * multiple Convex modules for capsule generation.
 * 
 * Module-wise Pipeline (efficient):
 * - Stage 1: Generate outline (1 AI call)
 * - Stage 2: Generate module content (1 AI call per module)
 * - Stage 3: Finalize and persist
 */

// =============================================================================
// Generation Stage Types (TD-2: Type Safety)
// =============================================================================

/**
 * All possible generation states for a capsule generation job.
 * Used consistently across schema.ts and capsuleGeneration.ts
 * 
 * Module-wise pipeline stages:
 * - idle → generating_outline → outline_complete
 * - → generating_module_content → module_X_complete (repeats per module)
 * - → completed / failed
 */
export const GENERATION_STAGES = {
  IDLE: "idle",
  GENERATING_OUTLINE: "generating_outline",
  OUTLINE_COMPLETE: "outline_complete",
  GENERATING_MODULE_CONTENT: "generating_module_content",
  MODULE_COMPLETE: "module_complete", // Generic stage - actual stage will be "module_1_complete", etc.
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled", // Job was cancelled (e.g., capsule deleted during generation)
} as const;

/**
 * Type for generation stage values
 */
export type GenerationStage = typeof GENERATION_STAGES[keyof typeof GENERATION_STAGES] | string;

/**
 * Array of all generation stages for iteration
 */
export const ALL_GENERATION_STAGES: string[] = Object.values(GENERATION_STAGES);

/**
 * Check if a value is a valid generation stage
 */
export function isValidGenerationStage(value: unknown): value is GenerationStage {
  if (typeof value !== "string") return false;
  // Allow exact matches or dynamic module stages like "module_1_complete"
  return ALL_GENERATION_STAGES.includes(value) || 
         value.startsWith("module_") || 
         value === "generating_module_content";
}

/**
 * Progress stages in order (for calculating completion percentage)
 */
export const GENERATION_STAGE_ORDER: string[] = [
  GENERATION_STAGES.IDLE,
  GENERATION_STAGES.GENERATING_OUTLINE,
  GENERATION_STAGES.OUTLINE_COMPLETE,
  GENERATION_STAGES.GENERATING_MODULE_CONTENT,
  GENERATION_STAGES.COMPLETED,
];

/**
 * Get progress percentage for a given stage
 * For module-wise generation, we use currentModuleIndex to calculate progress
 */
export function getStageProgressPercentage(stage: string, currentModuleIndex?: number, totalModules?: number): number {
  switch (stage) {
    case GENERATION_STAGES.IDLE:
      return 0;
    case GENERATION_STAGES.GENERATING_OUTLINE:
      return 5;
    case GENERATION_STAGES.OUTLINE_COMPLETE:
      return 10;
    case GENERATION_STAGES.GENERATING_MODULE_CONTENT:
      // Calculate progress based on current module
      if (currentModuleIndex !== undefined && totalModules !== undefined && totalModules > 0) {
        // Progress from 10% to 95% based on module completion
        const moduleProgress = (currentModuleIndex / totalModules) * 85;
        return Math.min(10 + moduleProgress, 95);
      }
      return 20;
    case GENERATION_STAGES.COMPLETED:
      return 100;
    case GENERATION_STAGES.FAILED:
      return 0;
    case GENERATION_STAGES.CANCELLED:
      return 0;
    default:
      // Handle dynamic module stages like "module_1_complete", "module_2_complete"
      if (stage.startsWith("module_") && stage.endsWith("_complete")) {
        const match = stage.match(/module_(\d+)_complete/);
        if (match && totalModules !== undefined && totalModules > 0) {
          const completedModule = parseInt(match[1], 10);
          const moduleProgress = (completedModule / totalModules) * 85;
          return Math.min(10 + moduleProgress, 95);
        }
      }
      return 0;
  }
}

// =============================================================================
// Lesson Type Definitions
// =============================================================================

/**
 * Valid lesson types for capsule content
 */
export const LESSON_TYPES = {
  CONCEPT: "concept",
  MCQ: "mcq",
  FILL_BLANKS: "fillBlanks",
  DRAG_DROP: "dragDrop",
  SIMULATION: "simulation",
} as const;

export type LessonType = typeof LESSON_TYPES[keyof typeof LESSON_TYPES];

/**
 * Extended lesson type that includes runtime variants
 */
export type ExtendedLessonType = LessonType | "mixed";

/**
 * Array of all lesson types
 */
export const ALL_LESSON_TYPES: LessonType[] = Object.values(LESSON_TYPES);

/**
 * Check if a value is a valid lesson type
 */
export function isValidLessonType(value: unknown): value is LessonType {
  return typeof value === "string" && ALL_LESSON_TYPES.includes(value as LessonType);
}

// =============================================================================
// Capsule Status Types
// =============================================================================

/**
 * Capsule status values
 */
export const CAPSULE_STATUS = {
  DRAFT: "draft",
  GENERATING: "generating",
  READY: "ready",
  FAILED: "failed",
} as const;

export type CapsuleStatus = typeof CAPSULE_STATUS[keyof typeof CAPSULE_STATUS];

// =============================================================================
// Regeneration Queue Types
// =============================================================================

/**
 * Regeneration queue item status
 */
export const REGEN_QUEUE_STATUS = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type RegenQueueStatus = typeof REGEN_QUEUE_STATUS[keyof typeof REGEN_QUEUE_STATUS];

// =============================================================================
// Error Code Types
// =============================================================================

/**
 * Standard error codes for generation failures
 */
export const GENERATION_ERROR_CODES = {
  // AI/Model errors
  AI_TIMEOUT: "AI_TIMEOUT",
  AI_RATE_LIMIT: "AI_RATE_LIMIT",
  AI_INVALID_RESPONSE: "AI_INVALID_RESPONSE",
  AI_CONTENT_FILTERED: "AI_CONTENT_FILTERED",
  
  // Input errors
  INVALID_INPUT: "INVALID_INPUT",
  PDF_TOO_LARGE: "PDF_TOO_LARGE",
  PDF_PARSE_FAILED: "PDF_PARSE_FAILED",
  
  // Auth errors
  UNAUTHORIZED: "UNAUTHORIZED",
  RATE_LIMITED: "RATE_LIMITED",
  
  // System errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
  TIMEOUT: "TIMEOUT",
  UNKNOWN: "UNKNOWN",
} as const;

export type GenerationErrorCode = typeof GENERATION_ERROR_CODES[keyof typeof GENERATION_ERROR_CODES];
