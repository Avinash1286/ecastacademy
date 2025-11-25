/**
 * Unified Schema Exports
 * 
 * This is the single source of truth for all capsule-related schemas.
 * Import from this file, not from individual schema files.
 */

// Types
export * from "./types";

// Zod Schemas (for validation)
export * from "./zod";

// JSON Schemas (for AI structured output)
export * from "./jsonSchema";

// Re-export commonly used Zod schemas at top level for convenience
export { 
  // Zod schemas
  capsuleSchema,
  moduleSchema,
  lessonSchema,
  mcqContentSchema,
  conceptContentSchema,
  fillBlanksContentSchema,
  dragDropContentSchema,
  simulationContentSchema,
  capsuleOutlineSchema,
  moduleLessonPlanSchema,
  lessonContentResultSchema,
  generationInputSchema,
} from "./zod";

// Re-export CapsuleSchema type
export type { CapsuleSchema } from "./zod";

// Re-export JSON schemas for AI structured output
export {
  CAPSULE_JSON_SCHEMA,
  OUTLINE_JSON_SCHEMA,
  LESSON_PLAN_JSON_SCHEMA,
  LESSON_CONTENT_JSON_SCHEMA,
  MCQ_CONTENT_JSON_SCHEMA,
  CONCEPT_CONTENT_JSON_SCHEMA,
  FILL_BLANKS_CONTENT_JSON_SCHEMA,
  DRAG_DROP_CONTENT_JSON_SCHEMA,
  SIMULATION_CONTENT_JSON_SCHEMA,
  getContentSchemaForType,
} from "./jsonSchema";
