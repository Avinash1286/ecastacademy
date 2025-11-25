/**
 * Strict Validator
 * 
 * Validates AI responses against Zod schemas WITHOUT silent fallbacks.
 * Returns detailed errors instead of masking failures.
 */

import { z, ZodIssue } from "zod";
import { validationError } from "../errors";

// =============================================================================
// Types
// =============================================================================

export interface ValidationError {
  path: string;
  message: string;
  code: string;
  received?: unknown;
  expected?: string;
}

export type ValidationResult<T> = 
  | { success: true; data: T; warnings?: string[] }
  | { success: false; errors: ValidationError[]; rawData: unknown };

// =============================================================================
// Main Validation Function
// =============================================================================

/**
 * Validate data against a Zod schema without any fallbacks.
 * Returns detailed errors on failure.
 */
export function validateStrict<T>(
  data: unknown,
  schema: z.ZodSchema<T>
): ValidationResult<T> {
  try {
    const result = schema.safeParse(data);
    
    if (result.success) {
      return { success: true, data: result.data };
    }
    
    // Convert Zod errors to our format
    const errors = result.error.issues.map(issue => formatZodIssue(issue, data));
    
    return {
      success: false,
      errors,
      rawData: data,
    };
  } catch (error) {
    // Unexpected error during validation
    return {
      success: false,
      errors: [{
        path: "",
        message: error instanceof Error ? error.message : "Unknown validation error",
        code: "unexpected_error",
      }],
      rawData: data,
    };
  }
}

/**
 * Validate and throw CapsuleError on failure
 */
export function validateStrictOrThrow<T>(
  data: unknown,
  schema: z.ZodSchema<T>,
  context?: { stage?: string; attempt?: number }
): T {
  const result = validateStrict(data, schema);
  
  if (result.success) {
    return result.data;
  }
  
  throw validationError(result.errors, context);
}

// =============================================================================
// Error Formatting
// =============================================================================

function formatZodIssue(issue: ZodIssue, data: unknown): ValidationError {
  const path = issue.path.join(".");
  const received = getValueAtPath(data, issue.path);
  
  // Build a descriptive message
  let message = issue.message;
  let expected: string | undefined;
  
  switch (issue.code) {
    case "invalid_type":
      expected = issue.expected;
      message = `Expected ${issue.expected}, received ${issue.received}`;
      break;
      
    case "too_small":
      if (issue.type === "string") {
        expected = `string with min length ${issue.minimum}`;
        message = `String too short (min ${issue.minimum} characters)`;
      } else if (issue.type === "array") {
        expected = `array with min ${issue.minimum} items`;
        message = `Array too short (min ${issue.minimum} items)`;
      } else if (issue.type === "number") {
        expected = `number >= ${issue.minimum}`;
        message = `Number too small (min ${issue.minimum})`;
      }
      break;
      
    case "too_big":
      if (issue.type === "string") {
        expected = `string with max length ${issue.maximum}`;
      } else if (issue.type === "array") {
        expected = `array with max ${issue.maximum} items`;
      } else if (issue.type === "number") {
        expected = `number <= ${issue.maximum}`;
      }
      break;
      
    case "invalid_enum_value":
      expected = `one of: ${issue.options.join(", ")}`;
      message = `Invalid enum value. Expected ${expected}`;
      break;
      
    case "custom":
      // Custom refinement errors (like generic content detection)
      message = issue.message;
      break;
  }
  
  return {
    path,
    message,
    code: issue.code,
    received: typeof received === "string" && received.length > 100 
      ? received.substring(0, 100) + "..." 
      : received,
    expected,
  };
}

function getValueAtPath(obj: unknown, path: (string | number)[]): unknown {
  let current: unknown = obj;
  
  for (const key of path) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === "object") {
      current = (current as Record<string | number, unknown>)[key];
    } else {
      return undefined;
    }
  }
  
  return current;
}

// =============================================================================
// Specialized Validators
// =============================================================================

/**
 * Validate and check for generic/placeholder content
 */
export function validateWithGenericCheck<T>(
  data: unknown,
  schema: z.ZodSchema<T>
): ValidationResult<T> {
  // First, do basic validation
  const basicResult = validateStrict(data, schema);
  
  if (!basicResult.success) {
    return basicResult;
  }
  
  // Check for generic content
  const genericWarnings = checkForGenericContent(basicResult.data);
  
  if (genericWarnings.length > 0) {
    return {
      success: true,
      data: basicResult.data,
      warnings: genericWarnings,
    };
  }
  
  return basicResult;
}

// =============================================================================
// Generic Content Detection
// =============================================================================

const GENERIC_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
  // Options
  { pattern: /^Option\s*[A-D1-4]?$/i, type: "mcq_option" },
  { pattern: /^Answer\s*\d*$/i, type: "mcq_option" },
  { pattern: /^Choice\s*\d*$/i, type: "mcq_option" },
  
  // Explanations
  { pattern: /^Explanation\s*(unavailable|here|goes here)?\.?$/i, type: "explanation" },
  { pattern: /^This is the explanation\.?$/i, type: "explanation" },
  
  // Items
  { pattern: /^Item\s*\d*$/i, type: "drag_drop_item" },
  { pattern: /^Concept\s*\d*$/i, type: "concept" },
  { pattern: /^Target\s*\d*$/i, type: "drag_drop_target" },
  
  // Titles
  { pattern: /^Untitled\s*(Lesson|Module|Capsule)?$/i, type: "title" },
  { pattern: /^Lesson\s*\d+$/i, type: "title" },
  
  // Blanks
  { pattern: /^answer$/i, type: "fill_blank" },
  { pattern: /^blank$/i, type: "fill_blank" },
];

function checkForGenericContent(data: unknown, path: string = ""): string[] {
  const warnings: string[] = [];
  
  if (data === null || data === undefined) {
    return warnings;
  }
  
  if (typeof data === "string") {
    for (const { pattern, type } of GENERIC_PATTERNS) {
      if (pattern.test(data.trim())) {
        warnings.push(`Generic ${type} detected at ${path || "root"}: "${data}"`);
        break;
      }
    }
    return warnings;
  }
  
  if (Array.isArray(data)) {
    data.forEach((item, index) => {
      warnings.push(...checkForGenericContent(item, `${path}[${index}]`));
    });
    return warnings;
  }
  
  if (typeof data === "object") {
    for (const [key, value] of Object.entries(data)) {
      const newPath = path ? `${path}.${key}` : key;
      warnings.push(...checkForGenericContent(value, newPath));
    }
  }
  
  return warnings;
}

// =============================================================================
// Batch Validation
// =============================================================================

export interface BatchValidationResult<T> {
  valid: Array<{ index: number; data: T }>;
  invalid: Array<{ index: number; errors: ValidationError[]; rawData: unknown }>;
  totalCount: number;
  validCount: number;
  invalidCount: number;
}

/**
 * Validate an array of items, collecting all errors
 */
export function validateBatch<T>(
  items: unknown[],
  schema: z.ZodSchema<T>
): BatchValidationResult<T> {
  const valid: Array<{ index: number; data: T }> = [];
  const invalid: Array<{ index: number; errors: ValidationError[]; rawData: unknown }> = [];
  
  items.forEach((item, index) => {
    const result = validateStrict(item, schema);
    
    if (result.success) {
      valid.push({ index, data: result.data });
    } else {
      invalid.push({ index, errors: result.errors, rawData: result.rawData });
    }
  });
  
  return {
    valid,
    invalid,
    totalCount: items.length,
    validCount: valid.length,
    invalidCount: invalid.length,
  };
}
