import { ZodError, ZodType, ZodTypeDef } from "zod";
import { StructuredRepairRequest, repairStructuredJson } from "@shared/ai/generation";
import type { AIModelConfig } from "@shared/ai/core";

const DEFAULT_ATTEMPTS = 5;
const PROMPT_TRUNCATION_LIMIT = 12000;

/**
 * Fix common LaTeX escape issues in JSON strings
 * AI models often output single backslashes for LaTeX which breaks JSON parsing
 */
function fixLatexEscapes(jsonString: string): string {
  // Common LaTeX commands that need double backslashes in JSON
  // We need to be careful not to double-escape already escaped ones
  const latexCommands = [
    'pi', 'sigma', 'omega', 'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'theta', 'lambda', 'mu', 'nu', 'rho', 'tau', 'phi', 'psi', 'chi',
    'Pi', 'Sigma', 'Omega', 'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Theta', 'Lambda', 'Mu', 'Nu', 'Rho', 'Tau', 'Phi', 'Psi', 'Chi',
    'frac', 'sqrt', 'sum', 'prod', 'int', 'oint', 'partial', 'nabla', 'infty', 'cdot', 'times', 'div', 'pm', 'mp', 'leq', 'geq', 'neq', 'approx',
    'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'log', 'ln', 'exp', 'lim', 'max', 'min',
    'left', 'right', 'begin', 'end', 'text', 'mathrm', 'mathbf', 'mathit', 'vec', 'hat', 'bar', 'dot', 'ddot',
    'quad', 'qquad', 'hspace', 'vspace', 'newline', 'displaystyle',
    'prime', 'circ', 'degree', 'angle', 'triangle', 'square', 'star',
  ];
  
  let result = jsonString;
  
  for (const cmd of latexCommands) {
    // Match single backslash NOT preceded by another backslash, followed by the command
    // This regex looks for \cmd that is not \\cmd
    const singleBackslashPattern = new RegExp(`(?<!\\\\)\\\\${cmd}(?![a-zA-Z])`, 'g');
    result = result.replace(singleBackslashPattern, `\\\\${cmd}`);
  }
  
  // Also fix common patterns like \n that should be \\n in LaTeX contexts (within math expressions)
  // But be careful: \n is a valid newline in JSON, so we only fix it when it looks like LaTeX
  // e.g., "e^{\n}" should become "e^{\\n}" but actual newlines in content should stay
  
  return result;
}

/**
 * Remove empty arrays from a parsed JSON object recursively.
 * This fixes common AI mistakes where optional array fields are set to [] instead of being omitted.
 */
function removeEmptyArrays(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    // Recursively clean array items, but don't remove this array itself
    return obj.map(removeEmptyArrays);
  }
  if (obj !== null && typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip empty arrays entirely (they'll be treated as omitted optional fields)
      if (Array.isArray(value) && value.length === 0) {
        continue;
      }
      cleaned[key] = removeEmptyArrays(value);
    }
    return cleaned;
  }
  return obj;
}

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

  // Log initial AI response
  console.log(`[JSON Validation - ${schemaName}] Initial response (first 1000 chars):`, currentJson.slice(0, 1000));
  console.log(`[JSON Validation - ${schemaName}] Initial response length:`, currentJson.length);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Always strip markdown fences before parsing (AI may add them in repairs too)
      let cleanJson = stripMarkdownFences(currentJson);
      
      // Fix common LaTeX escape issues before parsing
      cleanJson = fixLatexEscapes(cleanJson);
      let parsed = JSON.parse(cleanJson);
      
      // Remove empty arrays that should be omitted optional fields
      parsed = removeEmptyArrays(parsed);
      
      if (schema) {
        const validated = schema.parse(parsed);
        console.log(`[JSON Validation - ${schemaName}] ✅ Validation succeeded on attempt ${attempt + 1}`);
        return JSON.stringify(validated, null, 2);
      }
      console.log(`[JSON Validation - ${schemaName}] ✅ JSON parsing succeeded on attempt ${attempt + 1}`);
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
        `[JSON Validation - ${schemaName}] ❌ Attempt ${attempt + 1} failed:`,
        repairPayload.errorMessage
      );
      console.log(`[JSON Validation - ${schemaName}] Current JSON (first 500 chars):`, currentJson.slice(0, 500));

      currentJson = await repairStructuredJson(repairPayload, modelConfig);
      
      // Log repair response
      console.log(`[JSON Validation - ${schemaName}] Repair response (first 500 chars):`, currentJson.slice(0, 500));
    }
  }

  try {
    // Also strip markdown fences and fix LaTeX escapes in final attempt
    let cleanJson = stripMarkdownFences(currentJson);
    cleanJson = fixLatexEscapes(cleanJson);
    let parsed = JSON.parse(cleanJson);
    
    // Remove empty arrays that should be omitted optional fields
    parsed = removeEmptyArrays(parsed);
    
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
