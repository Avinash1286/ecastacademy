import { ZodError, ZodSchema } from "zod";
import { StructuredRepairRequest, repairStructuredJson } from "@shared/ai/generation";
import { AIModelConfig } from "@shared/ai/centralized";

const DEFAULT_ATTEMPTS = 5;
const PROMPT_TRUNCATION_LIMIT = 12000;

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

type JsonValidationOptions<T> = {
  schema?: ZodSchema<T>;
  schemaName?: string;
  schemaDescription?: string;
  originalInput?: string;
  format?: string;
  maxAttempts?: number;
  /** AI model configuration for repair attempts */
  modelConfig?: AIModelConfig;
};

export const validateAndCorrectJson = async <T>(
  jsonString: string,
  options: JsonValidationOptions<T> = {}
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

  let currentJson = jsonString;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const parsed = JSON.parse(currentJson);
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
    const parsed = JSON.parse(currentJson);
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
