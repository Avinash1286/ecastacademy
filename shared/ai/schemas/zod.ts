/**
 * Zod schemas for capsule generation - Single Source of Truth.
 * All validation and JSON schema generation derives from these.
 * 
 * IMPORTANT: These schemas use STRICT validation (no silent fallbacks).
 * Validation errors are returned explicitly, not masked.
 */

import { z } from "zod";
import type {
  LessonType,
  VisualAidType,
  DragDropActivityType,
  SimulationType,
  GenerationStage,
} from "./types";

// =============================================================================
// Helpers - NO silent fallbacks
// =============================================================================

/**
 * Create a string schema with minimum length and generic content detection
 */
const strictString = (minLength: number = 1) => 
  z.string().min(minLength);

/**
 * Detects generic/placeholder content that AI sometimes generates
 */
const nonGenericString = (minLength: number, genericPatterns: RegExp[]) =>
  z.string()
    .min(minLength)
    .refine(
      (val) => !genericPatterns.some(pattern => pattern.test(val)),
      { message: "Generic or placeholder content detected" }
    );

// Common generic patterns
const GENERIC_OPTION_PATTERNS = [
  /^Option\s*[A-D1-4]?$/i,
  /^Answer\s*\d*$/i,
  /^Choice\s*\d*$/i,
];

const GENERIC_EXPLANATION_PATTERNS = [
  /^Explanation\s*(unavailable|here|goes here)?\.?$/i,
  /^This is the explanation\.?$/i,
  /^Add explanation here\.?$/i,
];

const GENERIC_ITEM_PATTERNS = [
  /^Item\s*\d*$/i,
  /^Concept\s*\d*$/i,
  /^Element\s*\d*$/i,
];

const GENERIC_TARGET_PATTERNS = [
  /^Target\s*\d*$/i,
  /^Category\s*\d*$/i,
  /^Zone\s*\d*$/i,
];

// =============================================================================
// Enums and Literals
// =============================================================================

export const lessonTypeSchema = z.enum([
  "mcq",
  "concept",
  "fillBlanks",
  "dragDrop",
  "simulation",
]) satisfies z.ZodType<LessonType>;

export const visualAidTypeSchema = z.enum([
  "diagram",
  "flowchart", 
  "animation",
  "visualization",
]) satisfies z.ZodType<VisualAidType>;

export const dragDropActivityTypeSchema = z.enum([
  "matching",
  "ordering",
  "categorization",
]) satisfies z.ZodType<DragDropActivityType>;

export const simulationTypeSchema = z.literal("html-css-js") satisfies z.ZodType<SimulationType>;

export const generationStageSchema = z.enum([
  "pending",
  "parsing_input",
  "generating_outline",
  "generating_lessons",
  "generating_content",
  "validating",
  "persisting",
  "completed",
  "failed",
]) satisfies z.ZodType<GenerationStage>;

// =============================================================================
// Visual Aid Schema
// =============================================================================

export const visualAidCodeSchema = z.object({
  html: z.string().optional(),
  css: z.string().optional(),
  javascript: strictString(10).describe("JavaScript code for the visualization"),
});

export const visualAidSchema = z.object({
  type: visualAidTypeSchema,
  description: strictString(10).describe("Description of what the visual shows"),
  code: visualAidCodeSchema.optional(),
});

// =============================================================================
// MCQ Content Schema
// =============================================================================

export const mcqContentSchema = z.object({
  question: strictString(10).describe("The question text"),
  options: z.array(
    nonGenericString(1, GENERIC_OPTION_PATTERNS)
      .describe("A unique, specific answer option")
  )
    .min(2)
    .max(6)
    .describe("Answer options (2-6 choices)"),
  correctAnswer: z.number()
    .int()
    .min(0)
    .describe("Zero-based index of the correct option"),
  explanation: nonGenericString(20, GENERIC_EXPLANATION_PATTERNS)
    .describe("Detailed explanation of why the answer is correct"),
  hint: z.string().optional().describe("Optional hint for the learner"),
});

// =============================================================================
// Concept Content Schema
// =============================================================================

export const conceptContentSchema = z.object({
  conceptTitle: strictString(3).describe("Title of the concept being explained"),
  explanation: strictString(100)
    .describe("Detailed explanation of the concept (100+ characters)"),
  visualAid: visualAidSchema.optional()
    .describe("Optional interactive visualization"),
  keyPoints: z.array(strictString(10))
    .min(2)
    .max(10)
    .describe("Key takeaways (2-10 points)"),
  realWorldExample: z.string().optional()
    .describe("Optional real-world application example"),
});

// =============================================================================
// Fill Blanks Content Schema
// =============================================================================

export const fillBlankSchema = z.object({
  id: strictString(1).describe("Unique identifier for this blank (e.g., 'blank-1')"),
  correctAnswer: strictString(1)
    .refine(
      (val) => !/^answer$/i.test(val.trim()),
      { message: "Generic answer detected" }
    )
    .describe("The correct word/phrase for this blank"),
  alternatives: z.array(z.string().min(1)).optional()
    .describe("Alternative correct answers"),
  hint: z.string().optional().describe("Hint for this blank"),
});

export const fillBlanksContentSchema = z.object({
  instruction: strictString(5)
    .describe("Instructions for the fill-in-the-blanks activity"),
  text: strictString(20)
    .refine(
      (val) => val.includes("{{") && val.includes("}}"),
      { message: "Text must contain {{id}} placeholders for blanks" }
    )
    .describe("The text with {{id}} placeholders where blanks should appear"),
  blanks: z.array(fillBlankSchema)
    .min(1)
    .max(10)
    .describe("Array of blank definitions"),
}).refine(
  (data) => {
    // Verify all blank IDs are referenced in text
    const textPlaceholders = data.text.match(/\{\{([^}]+)\}\}/g) || [];
    const placeholderIds = textPlaceholders.map(p => p.slice(2, -2));
    return data.blanks.every(blank => placeholderIds.includes(blank.id));
  },
  { message: "All blank IDs must have corresponding {{id}} placeholders in text" }
);

// =============================================================================
// Drag Drop Content Schema
// =============================================================================

export const dragDropItemSchema = z.object({
  id: strictString(1).describe("Unique identifier for this item"),
  content: nonGenericString(1, GENERIC_ITEM_PATTERNS)
    .describe("The content/label of the draggable item"),
  category: z.string().optional().describe("Optional category for categorization activities"),
});

export const dragDropTargetSchema = z.object({
  id: strictString(1).describe("Unique identifier for this target"),
  label: nonGenericString(1, GENERIC_TARGET_PATTERNS)
    .describe("Label shown on the drop target"),
  acceptsItems: z.array(z.string().min(1))
    .min(1)
    .describe("Array of item IDs that can be dropped here"),
});

export const dragDropFeedbackSchema = z.object({
  correct: strictString(5).describe("Message shown on correct placement"),
  incorrect: strictString(5).describe("Message shown on incorrect placement"),
});

export const dragDropContentSchema = z.object({
  instruction: strictString(10).describe("Instructions for the drag-drop activity"),
  activityType: dragDropActivityTypeSchema.optional()
    .describe("Type of drag-drop activity"),
  items: z.array(dragDropItemSchema)
    .min(2)
    .max(12)
    .describe("Draggable items (2-12)"),
  targets: z.array(dragDropTargetSchema)
    .min(1)
    .max(8)
    .describe("Drop targets (1-8)"),
  feedback: dragDropFeedbackSchema.optional()
    .describe("Optional feedback messages"),
}).refine(
  (data) => {
    // Verify all acceptsItems reference valid item IDs
    const itemIds = new Set(data.items.map(i => i.id));
    return data.targets.every(t => 
      t.acceptsItems.every(itemId => itemIds.has(itemId))
    );
  },
  { message: "All acceptsItems must reference valid item IDs" }
);

// =============================================================================
// Simulation Content Schema
// =============================================================================

export const simulationCodeSchema = z.object({
  html: z.string().optional().describe("HTML structure"),
  css: z.string().optional().describe("CSS styles"),
  javascript: strictString(20).describe("JavaScript code for the simulation"),
});

export const simulationContentSchema = z.object({
  title: strictString(3).describe("Title of the simulation"),
  description: strictString(20).describe("Description of what the simulation demonstrates"),
  simulationType: simulationTypeSchema.describe("Type of simulation runtime"),
  code: simulationCodeSchema.describe("Code for the simulation"),
  instructions: strictString(20).describe("Instructions for interacting with the simulation"),
  observationPrompts: z.array(z.string().min(5)).optional()
    .describe("Questions to guide observation"),
  learningGoals: z.array(z.string().min(5)).optional()
    .describe("Learning objectives for the simulation"),
});

// =============================================================================
// Lesson Schemas (discriminated union)
// =============================================================================

export const mcqLessonSchema = z.object({
  title: strictString(3).describe("Lesson title"),
  lessonType: z.literal("mcq"),
  content: mcqContentSchema,
});

export const conceptLessonSchema = z.object({
  title: strictString(3).describe("Lesson title"),
  lessonType: z.literal("concept"),
  content: conceptContentSchema,
});

export const fillBlanksLessonSchema = z.object({
  title: strictString(3).describe("Lesson title"),
  lessonType: z.literal("fillBlanks"),
  content: fillBlanksContentSchema,
});

export const dragDropLessonSchema = z.object({
  title: strictString(3).describe("Lesson title"),
  lessonType: z.literal("dragDrop"),
  content: dragDropContentSchema,
});

export const simulationLessonSchema = z.object({
  title: strictString(3).describe("Lesson title"),
  lessonType: z.literal("simulation"),
  content: simulationContentSchema,
});

export const lessonSchema = z.discriminatedUnion("lessonType", [
  mcqLessonSchema,
  conceptLessonSchema,
  fillBlanksLessonSchema,
  dragDropLessonSchema,
  simulationLessonSchema,
]);

// =============================================================================
// Module Schema
// =============================================================================

export const moduleSchema = z.object({
  title: strictString(3).describe("Module title"),
  description: strictString(10).describe("Module description"),
  lessons: z.array(lessonSchema).min(1).max(20).describe("Lessons in this module"),
});

// =============================================================================
// Full Capsule Schema
// =============================================================================

export const capsuleSchema = z.object({
  title: strictString(3).describe("Capsule title"),
  description: strictString(20).describe("Capsule description"),
  estimatedDuration: z.number()
    .int()
    .min(5)
    .max(300)
    .describe("Estimated duration in minutes"),
  modules: z.array(moduleSchema).min(1).max(10).describe("Modules in the capsule"),
});

// =============================================================================
// Stage Schemas (for multi-stage generation)
// =============================================================================

/**
 * Stage 1: Just the outline - simple, reliable
 */
export const outlineModuleSchema = z.object({
  title: strictString(3).describe("Module title"),
  description: strictString(10).describe("Brief module description"),
  lessonCount: z.number().int().min(1).max(10).describe("Number of lessons planned"),
});

export const capsuleOutlineSchema = z.object({
  title: strictString(3).describe("Capsule title"),
  description: strictString(20).describe("Capsule description"),
  estimatedDuration: z.number().int().min(5).max(300).describe("Duration in minutes"),
  modules: z.array(outlineModuleSchema).min(1).max(10).describe("Module outlines"),
});

/**
 * Stage 2: Lesson plan for a module
 */
export const lessonPlanItemSchema = z.object({
  title: strictString(3).describe("Lesson title"),
  lessonType: lessonTypeSchema.describe("Type of lesson"),
  objective: strictString(10).describe("Learning objective for this lesson"),
});

export const moduleLessonPlanSchema = z.object({
  moduleTitle: strictString(3).describe("Title of the module"),
  lessons: z.array(lessonPlanItemSchema).min(1).max(10).describe("Planned lessons"),
});

/**
 * Stage 3: Individual lesson content
 */
export const lessonContentResultSchema = z.object({
  lessonTitle: strictString(3).describe("Title of the lesson"),
  lessonType: lessonTypeSchema.describe("Type of lesson"),
  content: z.union([
    mcqContentSchema,
    conceptContentSchema,
    fillBlanksContentSchema,
    dragDropContentSchema,
    simulationContentSchema,
  ]).describe("The lesson content"),
});

// =============================================================================
// Input Validation Schemas
// =============================================================================

export const generationInputSchema = z.object({
  sourceType: z.enum(["pdf", "topic"]).describe("Source type"),
  topic: z.string().min(3).optional().describe("Topic for generation"),
  pdfBase64: z.string().optional().describe("Base64 encoded PDF"),
  pdfMimeType: z.string().optional().describe("MIME type of PDF"),
  guidance: z.string().optional().describe("Additional guidance"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  targetLessonCount: z.number().int().min(3).max(50).optional(),
}).refine(
  (data) => {
    if (data.sourceType === "topic") return !!data.topic;
    if (data.sourceType === "pdf") return !!data.pdfBase64;
    return true;
  },
  { message: "Topic required for topic source, PDF required for PDF source" }
);

// =============================================================================
// Type Exports (inferred from schemas)
// =============================================================================

export type MCQContentSchema = z.infer<typeof mcqContentSchema>;
export type ConceptContentSchema = z.infer<typeof conceptContentSchema>;
export type FillBlanksContentSchema = z.infer<typeof fillBlanksContentSchema>;
export type DragDropContentSchema = z.infer<typeof dragDropContentSchema>;
export type SimulationContentSchema = z.infer<typeof simulationContentSchema>;
export type LessonSchema = z.infer<typeof lessonSchema>;
export type ModuleSchema = z.infer<typeof moduleSchema>;
export type CapsuleSchema = z.infer<typeof capsuleSchema>;
export type CapsuleOutlineSchema = z.infer<typeof capsuleOutlineSchema>;
export type ModuleLessonPlanSchema = z.infer<typeof moduleLessonPlanSchema>;
export type LessonContentResultSchema = z.infer<typeof lessonContentResultSchema>;
export type GenerationInputSchema = z.infer<typeof generationInputSchema>;
