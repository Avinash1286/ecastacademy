import { ZodError, ZodType, ZodTypeDef } from "zod";
import { StructuredRepairRequest, repairStructuredJson } from "@shared/ai/generation";
import type { AIModelConfig } from "@shared/ai/core";

const DEFAULT_ATTEMPTS = 5;
const PROMPT_TRUNCATION_LIMIT = 12000;

/**
 * Strip markdown code fences from AI responses
 * Handles ```json ... ```, ``` ... ```, and inline ` ... `
 */
function stripMarkdownFences(raw: string): string {
  let result = raw.trim();
  
  // Pattern for ```json ... ``` or ``` ... ```
  const fenceMatch = result.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/m);
  if (fenceMatch && fenceMatch[1]) {
    return fenceMatch[1].trim();
  }
  
  // Try to find JSON object/array within text (handles leading/trailing text)
  const jsonMatch = result.match(/([\[{][\s\S]*[\]}])/m);
  if (jsonMatch && jsonMatch[1]) {
    return jsonMatch[1].trim();
  }
  
  return result;
}

const truncateForPrompt = (value: string): string => {
  if (!value) return value;
  if (value.length <= PROMPT_TRUNCATION_LIMIT) {
    return value;
  }
  return `${value.slice(0, PROMPT_TRUNCATION_LIMIT)}...`;
};

const buildErrorMessage = (error: unknown): string => {
  if (error instanceof ZodError) {
    return error.issues
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown validation error";
};

// Using ZodType with any to accept schemas with transforms
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonValidationOptions<T = any> = {
  schema?: ZodType<T, ZodTypeDef, unknown>;
  schemaName?: string;
  schemaDescription?: string;
  originalInput?: string;
  format?: string;
  maxAttempts?: number;
  /** AI model configuration for repair attempts - REQUIRED, must be configured in admin panel */
  modelConfig: AIModelConfig;
};

export const validateAndCorrectJson = async <T>(
  jsonString: string,
  options: JsonValidationOptions<T>
): Promise<string> => {
  const {
    schema,
    schemaName = "JSON payload",
    schemaDescription = "Generic JSON structure",
    originalInput,
    format = "generic-json",
    maxAttempts = DEFAULT_ATTEMPTS,
    modelConfig,
  } = options;

  if (!modelConfig) {
    throw new Error(
      "AI model configuration is required for JSON validation/repair. " +
      "Please configure the model in the admin panel."
    );
  }

  // Pre-process: strip markdown fences from initial input
  let currentJson = stripMarkdownFences(jsonString);
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Always strip markdown fences before parsing (AI may add them in repairs too)
      const cleanJson = stripMarkdownFences(currentJson);
      const parsed = JSON.parse(cleanJson);
      if (schema) {
        const validated = schema.parse(parsed);
        return JSON.stringify(validated, null, 2);
      }
      return JSON.stringify(parsed, null, 2);
    } catch (error) {
      lastError = error;
      const repairPayload: StructuredRepairRequest = {
        format,
        schemaName,
        schemaDescription,
        previousOutput: truncateForPrompt(currentJson),
        errorMessage: buildErrorMessage(error),
        originalInput: originalInput ? truncateForPrompt(originalInput) : undefined,
        attempt: attempt + 1,
      };

      console.warn(
        `Attempt ${attempt + 1}: Structured JSON validation failed. Forwarding details to repair model.`,
        repairPayload.errorMessage
      );

      currentJson = await repairStructuredJson(repairPayload, modelConfig);
    }
  }

  try {
    // Also strip markdown fences in final attempt
    const cleanJson = stripMarkdownFences(currentJson);
    const parsed = JSON.parse(cleanJson);
    if (schema) {
      const validated = schema.parse(parsed);
      return JSON.stringify(validated, null, 2);
    }
    return JSON.stringify(parsed, null, 2);
  } catch (finalError) {
    const errorMessage = buildErrorMessage(finalError ?? lastError);
    console.error("Failed to generate valid structured JSON after multiple attempts.", errorMessage);
    throw new Error(
      `Failed to process content due to invalid data format after multiple retries. Details: ${errorMessage}`
    );
  }
};
