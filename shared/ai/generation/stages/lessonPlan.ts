/**
 * Stage 2: Lesson Plan Generation
 * 
 * Generates the lesson plan for a single module.
 * Called once per module in the outline.
 */

import type { AIClient, StructuredOutputRequest } from "../../client";
import { LESSON_PLAN_JSON_SCHEMA } from "../../schemas/jsonSchema";
import { moduleLessonPlanSchema } from "../../schemas/zod";
import { validateStrict } from "../../validation";
import { CapsuleError, ErrorCode, fromUnknown } from "../../errors";
import type { 
  LessonPlanInput, 
  LessonPlanOutput, 
  StageResult, 
  StageContext 
} from "./types";

// =============================================================================
// System Prompt
// =============================================================================

const LESSON_PLAN_SYSTEM_PROMPT = `You are an expert instructional designer creating lesson plans.

Your task is to generate a LESSON PLAN for a single module - NOT the full lesson content.

STRICT RULES:
1. Output ONLY valid JSON matching the exact schema provided
2. NO markdown formatting, NO code fences, NO extra text
3. Create the exact number of lessons specified
4. Use a variety of lesson types for engagement:
   - "concept": For explanations and theory
   - "mcq": For multiple choice quiz questions
   - "fillBlanks": For fill-in-the-blank exercises
   - "dragDrop": For matching/ordering activities
   - "simulation": For interactive code demonstrations
5. Each lesson should have a clear, specific objective
6. Lesson titles must be unique and descriptive

The lesson plan will be used to generate detailed content in subsequent steps.`;

// =============================================================================
// User Prompt Builder
// =============================================================================

function buildUserPrompt(input: LessonPlanInput): string {
  const parts: string[] = [];
  
  parts.push(`Capsule: "${input.capsuleTitle}"`);
  parts.push(`Module ${input.moduleIndex + 1}: "${input.moduleTitle}"`);
  parts.push(`Module Description: ${input.moduleDescription}`);
  parts.push(`Required Lesson Count: ${input.lessonCount}`);
  
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
  
  parts.push(`\nGenerate exactly ${input.lessonCount} lessons for this module.`);
  parts.push("Use a mix of lesson types (concept, mcq, fillBlanks, dragDrop, simulation).");
  parts.push("Ensure logical flow from one lesson to the next.");
  
  return parts.join("\n");
}

// =============================================================================
// Stage Executor
// =============================================================================

export async function generateLessonPlan(
  client: AIClient,
  input: LessonPlanInput,
  context: StageContext
): Promise<StageResult<LessonPlanOutput>> {
  const startTime = Date.now();
  let tokensUsed = 0;
  
  try {
    // Validate lesson count
    if (input.lessonCount < 1 || input.lessonCount > 10) {
      return {
        success: false,
        error: `Invalid lesson count: ${input.lessonCount}. Must be 1-10.`,
        errorCode: ErrorCode.INVALID_INPUT,
        tokensUsed: 0,
        durationMs: Date.now() - startTime,
        retriable: false,
      };
    }
    
    // Build request
    const request: StructuredOutputRequest = {
      systemPrompt: LESSON_PLAN_SYSTEM_PROMPT,
      userMessage: buildUserPrompt(input),
      responseSchema: LESSON_PLAN_JSON_SCHEMA,
    };
    
    // Add PDF if present
    if (input.sourceType === "pdf" && input.pdfBase64) {
      request.pdfAttachment = {
        base64: input.pdfBase64,
        mimeType: input.pdfMimeType || "application/pdf",
      };
    }
    
    // Make request
    const response = await client.generateStructured<LessonPlanOutput>(request, {
      timeoutMs: 60_000, // 60 seconds for lesson plan
    });
    
    tokensUsed = response.usage.totalTokens;
    
    // Validate response
    const validation = validateStrict(response.data, moduleLessonPlanSchema);
    
    if (!validation.success) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.map(e => e.message).join("; ")}`,
        errorCode: ErrorCode.VALIDATION_ERROR,
        tokensUsed,
        durationMs: Date.now() - startTime,
        retriable: true,
      };
    }
    
    // Verify lesson count
    if (validation.data.lessons.length !== input.lessonCount) {
      // Try to work with what we got
      console.warn(
        `Expected ${input.lessonCount} lessons, got ${validation.data.lessons.length}`
      );
    }
    
    return {
      success: true,
      data: validation.data,
      tokensUsed,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    const capsuleError = error instanceof CapsuleError 
      ? error 
      : fromUnknown(error, { 
          stage: "lessonPlan", 
          attempt: context.attempt,
          moduleIndex: input.moduleIndex,
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
