/**
 * Stage 3: Lesson Content Generation
 * 
 * Generates the full content for a single lesson.
 * Called once per lesson in the plan.
 */

import type { AIClient, StructuredOutputRequest } from "../../client";
import { getContentSchemaForType } from "../../schemas/jsonSchema";
import { 
  mcqContentSchema,
  conceptContentSchema,
  fillBlanksContentSchema,
  dragDropContentSchema,
  simulationContentSchema,
} from "../../schemas/zod";
import { validateAndRepair } from "../../validation";
import { CapsuleError, ErrorCode, fromUnknown } from "../../errors";
import type { LessonType } from "../../schemas/types";
import type { z } from "zod";
import type { 
  LessonContentInput, 
  LessonContentOutput, 
  StageResult, 
  StageContext 
} from "./types";

// =============================================================================
// System Prompts by Lesson Type
// =============================================================================

const BASE_SYSTEM_PROMPT = `You are an expert instructional designer creating educational content.

Your task is to generate the FULL CONTENT for a single lesson.

STRICT RULES:
1. Output ONLY valid JSON matching the exact schema provided
2. NO markdown formatting, NO code fences, NO extra text
3. Content must be educational, accurate, and engaging
4. All text should be substantial - no placeholders or generic text
`;

const TYPE_SPECIFIC_PROMPTS: Record<LessonType, string> = {
  concept: `
CONCEPT LESSON RULES:
- conceptTitle: Clear, specific title for this concept
- explanation: Detailed explanation (100+ characters, thorough)
- keyPoints: 2-5 specific, memorable takeaways
- realWorldExample: Optional but recommended real-world application
- visualAid: Optional interactive visualization with working JavaScript
`,
  
  mcq: `
MCQ LESSON RULES:
- question: Clear, specific question text
- options: 3-5 unique answer options (NOT generic like "Option A")
- correctAnswer: Zero-based index of the correct option
- explanation: Detailed explanation of WHY the answer is correct
- hint: Optional hint to help learners
`,
  
  fillBlanks: `
FILL-IN-THE-BLANKS LESSON RULES:
- instruction: Clear instructions for the activity
- text: The sentence/paragraph with {{id}} placeholders (e.g., "The {{blank-1}} is important")
- blanks: Array with id, correctAnswer for each blank
  - Each blank id MUST match a {{id}} placeholder in the text
  - correctAnswer must be the actual word/phrase, NOT "answer"
`,
  
  dragDrop: `
DRAG-DROP LESSON RULES:
- instruction: Clear instructions for the activity
- activityType: "matching", "ordering", or "categorization"
- items: Array of draggable items with unique ids and meaningful content
- targets: Array of drop targets with labels and acceptsItems arrays
- Each target's acceptsItems must reference valid item ids
- Content should NOT be generic (no "Item 1", "Target 1")
`,
  
  simulation: `
SIMULATION LESSON RULES:
- title: Clear title for the simulation
- description: What the simulation demonstrates
- simulationType: "html-css-js"
- code: Object with html (optional), css (optional), javascript (required)
  - JavaScript must be functional, self-contained code
  - Should create an interactive experience
- instructions: How to interact with the simulation
- observationPrompts: Questions to guide learning
`,
};

// =============================================================================
// User Prompt Builder
// =============================================================================

function buildUserPrompt(input: LessonContentInput): string {
  const parts: string[] = [];
  
  parts.push(`Capsule: "${input.capsuleTitle}"`);
  parts.push(`Module: "${input.moduleTitle}"`);
  parts.push(`Lesson ${input.lessonIndex + 1}: "${input.lessonTitle}"`);
  parts.push(`Lesson Type: ${input.lessonType}`);
  parts.push(`Learning Objective: ${input.lessonObjective}`);
  
  if (input.sourceType === "topic") {
    parts.push(`\nOverall Topic: "${input.topic}"`);
  } else {
    parts.push("\nContent is based on the attached PDF document.");
  }
  
  if (input.guidance) {
    parts.push(`\nAdditional guidance: ${input.guidance}`);
  }
  
  if (input.difficulty) {
    parts.push(`\nDifficulty level: ${input.difficulty}`);
  }
  
  // Add context from previous lessons
  if (input.previousLessons && input.previousLessons.length > 0) {
    parts.push("\nPrevious lessons in this module:");
    input.previousLessons.forEach((lesson, i) => {
      parts.push(`  ${i + 1}. ${lesson.title} (${lesson.type})`);
    });
    parts.push("Ensure this lesson builds on previous content appropriately.");
  }
  
  parts.push(`\nGenerate the complete ${input.lessonType} content now.`);
  
  return parts.join("\n");
}

// =============================================================================
// Schema Selection
// =============================================================================

function getValidationSchema(lessonType: LessonType): z.ZodSchema {
  switch (lessonType) {
    case "mcq":
      return mcqContentSchema;
    case "concept":
      return conceptContentSchema;
    case "fillBlanks":
      return fillBlanksContentSchema;
    case "dragDrop":
      return dragDropContentSchema;
    case "simulation":
      return simulationContentSchema;
    default:
      throw new CapsuleError(
        ErrorCode.INVALID_INPUT,
        `Unknown lesson type: ${lessonType}`
      );
  }
}

// =============================================================================
// Stage Executor
// =============================================================================

export async function generateLessonContent(
  client: AIClient,
  input: LessonContentInput,
  context: StageContext
): Promise<StageResult<LessonContentOutput>> {
  const startTime = Date.now();
  let tokensUsed = 0;
  
  try {
    // Build system prompt
    const systemPrompt = BASE_SYSTEM_PROMPT + TYPE_SPECIFIC_PROMPTS[input.lessonType];
    
    // Build request
    const request: StructuredOutputRequest = {
      systemPrompt,
      userMessage: buildUserPrompt(input),
      responseSchema: getContentSchemaForType(input.lessonType),
    };
    
    // Add PDF if present
    if (input.sourceType === "pdf" && input.pdfBase64) {
      request.pdfAttachment = {
        base64: input.pdfBase64,
        mimeType: input.pdfMimeType || "application/pdf",
      };
    }
    
    // Make request
    const response = await client.generateStructured<unknown>(request, {
      timeoutMs: 60_000, // 60 seconds per lesson
    });
    
    tokensUsed = response.usage.totalTokens;
    
    // Get validation schema
    const schema = getValidationSchema(input.lessonType);
    
    // Validate with repair
    const validation = validateAndRepair(response.data, schema);
    
    if (!validation.success) {
      const errorMessages = validation.remainingErrors
        .map(e => `${e.path}: ${e.message}`)
        .join("; ");
      
      return {
        success: false,
        error: `Validation failed: ${errorMessages}`,
        errorCode: ErrorCode.VALIDATION_ERROR,
        tokensUsed,
        durationMs: Date.now() - startTime,
        retriable: true,
      };
    }
    
    // Log repairs if any
    if (validation.repairs.length > 0) {
      console.log(
        `Applied ${validation.repairs.length} repairs to lesson ${input.lessonIndex + 1}:`,
        validation.repairs.map(r => r.action).join(", ")
      );
    }
    
    return {
      success: true,
      data: {
        lessonTitle: input.lessonTitle,
        lessonType: input.lessonType,
        content: validation.data,
      },
      tokensUsed,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    const capsuleError = error instanceof CapsuleError 
      ? error 
      : fromUnknown(error, { 
          stage: "lessonContent", 
          attempt: context.attempt,
          moduleIndex: input.moduleIndex,
          lessonIndex: input.lessonIndex,
        });
    
    return {
      success: false,
      error: capsuleError.message,
      errorCode: capsuleError.code,
      tokensUsed,
      durationMs: Date.now() - startTime,
      retriable: capsuleError.retriable,
    };
  }
}
