/**
 * Stage 1: Outline Generation
 * 
 * Generates the capsule outline (title, description, modules).
 * Simple structure = more reliable JSON generation.
 */

import type { AIClient, StructuredOutputRequest } from "../../client";
import { OUTLINE_JSON_SCHEMA } from "../../schemas/jsonSchema";
import { capsuleOutlineSchema } from "../../schemas/zod";
import { validateStrict } from "../../validation";
import { CapsuleError, ErrorCode, fromUnknown } from "../../errors";
import type { 
  OutlineInput, 
  OutlineOutput, 
  StageResult, 
  StageContext 
} from "./types";

// =============================================================================
// System Prompt
// =============================================================================

const OUTLINE_SYSTEM_PROMPT = `You are an expert instructional designer creating educational capsule courses.

Your task is to generate a course OUTLINE ONLY - not the full content.

STRICT RULES:
1. Output ONLY valid JSON matching the exact schema provided
2. NO markdown formatting, NO code fences, NO extra text
3. Create 2-5 modules depending on topic complexity
4. Each module should have 3-6 planned lessons
5. Titles and descriptions must be specific and meaningful
6. estimatedDuration is total time in minutes (typically 20-60 minutes)

The outline will be used to generate detailed lesson content in subsequent steps.`;

// =============================================================================
// User Prompt Builder
// =============================================================================

function buildUserPrompt(input: OutlineInput): string {
  const parts: string[] = [];
  
  if (input.sourceType === "topic") {
    parts.push(`Create a course outline for the topic: "${input.topic}"`);
  } else {
    parts.push("Create a course outline based on the attached PDF document.");
  }
  
  if (input.guidance) {
    parts.push(`\nAdditional guidance: ${input.guidance}`);
  }
  
  if (input.difficulty) {
    parts.push(`\nTarget difficulty level: ${input.difficulty}`);
  }
  
  if (input.targetModuleCount) {
    parts.push(`\nTarget number of modules: ${input.targetModuleCount}`);
  }
  
  parts.push("\nGenerate the course outline now.");
  
  return parts.join("\n");
}

// =============================================================================
// Stage Executor
// =============================================================================

export async function generateOutline(
  client: AIClient,
  input: OutlineInput,
  context: StageContext
): Promise<StageResult<OutlineOutput>> {
  const startTime = Date.now();
  let tokensUsed = 0;
  
  try {
    // Validate input
    if (input.sourceType === "topic" && !input.topic) {
      return {
        success: false,
        error: "Topic is required for topic-based generation",
        errorCode: ErrorCode.INVALID_INPUT,
        tokensUsed: 0,
        durationMs: Date.now() - startTime,
        retriable: false,
      };
    }
    
    if (input.sourceType === "pdf" && !input.pdfBase64) {
      return {
        success: false,
        error: "PDF is required for PDF-based generation",
        errorCode: ErrorCode.INVALID_INPUT,
        tokensUsed: 0,
        durationMs: Date.now() - startTime,
        retriable: false,
      };
    }
    
    // Build request
    const request: StructuredOutputRequest = {
      systemPrompt: OUTLINE_SYSTEM_PROMPT,
      userMessage: buildUserPrompt(input),
      responseSchema: OUTLINE_JSON_SCHEMA,
    };
    
    // Add PDF if present
    if (input.sourceType === "pdf" && input.pdfBase64) {
      request.pdfAttachment = {
        base64: input.pdfBase64,
        mimeType: input.pdfMimeType || "application/pdf",
      };
    }
    
    // Make request
    const response = await client.generateStructured<OutlineOutput>(request, {
      timeoutMs: 90_000, // 90 seconds for outline
    });
    
    tokensUsed = response.usage.totalTokens;
    
    // Validate response
    const validation = validateStrict(response.data, capsuleOutlineSchema);
    
    if (!validation.success) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.map(e => e.message).join("; ")}`,
        errorCode: ErrorCode.VALIDATION_ERROR,
        tokensUsed,
        durationMs: Date.now() - startTime,
        retriable: true, // Can retry with different response
      };
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
      : fromUnknown(error, { stage: "outline", attempt: context.attempt });
    
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
