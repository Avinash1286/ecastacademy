/**
 * Deterministic Repair
 * 
 * Attempts to fix common validation errors without using AI.
 * Fast, predictable, and doesn't consume API quota.
 */

import type { ValidationError } from "./strictValidator";
import { validateStrict } from "./strictValidator";
import type { z } from "zod";

// =============================================================================
// Types
// =============================================================================

export interface RepairAction {
  path: string;
  action: string;
  originalValue: unknown;
  repairedValue: unknown;
}

export type RepairResult<T> = 
  | { 
      success: true; 
      data: T; 
      repairs: RepairAction[];
      remainingErrors: ValidationError[];
    }
  | { 
      success: false; 
      repairs: RepairAction[];
      remainingErrors: ValidationError[];
      rawData: unknown;
    };

// =============================================================================
// Path Utilities
// =============================================================================

function getPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  
  const parts = path.split(".");
  let current: unknown = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    
    // Handle array indices
    const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, indexStr] = arrayMatch;
      current = (current as Record<string, unknown>)[key];
      if (!Array.isArray(current)) return undefined;
      current = current[parseInt(indexStr, 10)];
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }
  
  return current;
}

function setPath(obj: unknown, path: string, value: unknown): unknown {
  if (!path) return value;
  
  const result = structuredClone(obj);
  const parts = path.split(".");
  let current: unknown = result;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
    
    if (arrayMatch) {
      const [, key, indexStr] = arrayMatch;
      current = (current as Record<string, unknown>)[key];
      current = (current as unknown[])[parseInt(indexStr, 10)];
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }
  
  const lastPart = parts[parts.length - 1];
  const arrayMatch = lastPart.match(/^(.+)\[(\d+)\]$/);
  
  if (arrayMatch) {
    const [, key, indexStr] = arrayMatch;
    const arr = (current as Record<string, unknown>)[key] as unknown[];
    arr[parseInt(indexStr, 10)] = value;
  } else {
    (current as Record<string, unknown>)[lastPart] = value;
  }
  
  return result;
}

// =============================================================================
// Repair Strategies
// =============================================================================

type RepairStrategy = (
  data: unknown,
  error: ValidationError
) => { data: unknown; action: RepairAction } | null;

/**
 * Trim whitespace from strings
 */
const trimWhitespace: RepairStrategy = (data, error) => {
  if (error.code !== "too_small") return null;
  
  const value = getPath(data, error.path);
  if (typeof value !== "string") return null;
  
  const trimmed = value.trim();
  if (trimmed === value) return null;
  
  // Check if trimming helps
  if (trimmed.length > 0) {
    return {
      data: setPath(data, error.path, trimmed),
      action: {
        path: error.path,
        action: "trim_whitespace",
        originalValue: value,
        repairedValue: trimmed,
      },
    };
  }
  
  return null;
};

/**
 * Convert string numbers to actual numbers
 */
const coerceStringToNumber: RepairStrategy = (data, error) => {
  if (error.code !== "invalid_type") return null;
  if (!error.expected?.includes("number")) return null;
  
  const value = getPath(data, error.path);
  if (typeof value !== "string") return null;
  
  const parsed = parseFloat(value);
  if (isNaN(parsed)) return null;
  
  return {
    data: setPath(data, error.path, parsed),
    action: {
      path: error.path,
      action: "coerce_to_number",
      originalValue: value,
      repairedValue: parsed,
    },
  };
};

/**
 * Convert number to string where expected
 */
const coerceNumberToString: RepairStrategy = (data, error) => {
  if (error.code !== "invalid_type") return null;
  if (!error.expected?.includes("string")) return null;
  
  const value = getPath(data, error.path);
  if (typeof value !== "number") return null;
  
  const stringValue = String(value);
  
  return {
    data: setPath(data, error.path, stringValue),
    action: {
      path: error.path,
      action: "coerce_to_string",
      originalValue: value,
      repairedValue: stringValue,
    },
  };
};

/**
 * Generate missing IDs for array items
 */
const generateMissingIds: RepairStrategy = (data, error) => {
  // Look for errors about missing or empty IDs
  if (!error.path.includes("id") && !error.path.includes("Id")) return null;
  
  const value = getPath(data, error.path);
  if (value !== undefined && value !== null && value !== "") return null;
  
  // Generate a simple ID based on path
  const pathParts = error.path.split(".");
  const index = pathParts.findIndex(p => /\[\d+\]/.test(p));
  const generatedId = index >= 0 
    ? `auto-${pathParts[index].match(/\[(\d+)\]/)?.[1] || "0"}`
    : `auto-${Date.now()}`;
  
  return {
    data: setPath(data, error.path, generatedId),
    action: {
      path: error.path,
      action: "generate_id",
      originalValue: value,
      repairedValue: generatedId,
    },
  };
};

/**
 * Fix array minimum by padding with template items
 */
const padArray: RepairStrategy = (data, error) => {
  if (error.code !== "too_small") return null;
  if (!error.message.includes("array") && !error.message.includes("items")) return null;
  
  const value = getPath(data, error.path);
  if (!Array.isArray(value)) return null;
  
  // Extract minimum from error message
  const minMatch = error.message.match(/min\s*(\d+)/i);
  if (!minMatch) return null;
  
  const minRequired = parseInt(minMatch[1], 10);
  if (value.length >= minRequired) return null;
  
  // Can't reliably pad without knowing item structure
  // This is left for the caller to handle
  return null;
};

/**
 * Fix correctAnswer index that's out of bounds
 */
const fixCorrectAnswerIndex: RepairStrategy = (data, error) => {
  if (!error.path.includes("correctAnswer")) return null;
  
  const value = getPath(data, error.path);
  if (typeof value !== "number") return null;
  
  // Try to find the options array
  const pathParts = error.path.split(".");
  const contentPath = pathParts.slice(0, -1).join(".");
  const content = getPath(data, contentPath);
  
  if (!content || typeof content !== "object") return null;
  
  const options = (content as Record<string, unknown>).options;
  if (!Array.isArray(options)) return null;
  
  // Clamp to valid range
  const maxIndex = options.length - 1;
  const clampedValue = Math.max(0, Math.min(value, maxIndex));
  
  if (clampedValue === value) return null;
  
  return {
    data: setPath(data, error.path, clampedValue),
    action: {
      path: error.path,
      action: "clamp_correct_answer",
      originalValue: value,
      repairedValue: clampedValue,
    },
  };
};

/**
 * Ensure fill-blanks text has placeholders
 */
const addMissingPlaceholders: RepairStrategy = (data, error) => {
  if (!error.message.includes("placeholder")) return null;
  
  // Find the fillBlanks content
  const pathParts = error.path.split(".");
  let contentPath = "";
  for (let i = 0; i < pathParts.length; i++) {
    if (pathParts[i] === "text" || pathParts[i] === "content") {
      contentPath = pathParts.slice(0, i + 1).join(".");
      break;
    }
  }
  
  if (!contentPath) return null;
  
  const content = getPath(data, contentPath.replace(".text", ""));
  if (!content || typeof content !== "object") return null;
  
  const contentObj = content as Record<string, unknown>;
  const text = contentObj.text;
  const blanks = contentObj.blanks;
  
  if (typeof text !== "string" || !Array.isArray(blanks)) return null;
  
  // Check if text already has placeholders
  if (text.includes("{{")) return null;
  
  // Add placeholders to the end
  const blankIds = blanks.map((b: Record<string, unknown>, i: number) => 
    (b.id as string) || `blank-${i + 1}`
  );
  const placeholders = blankIds.map((id) => `{{${id}}}`).join(" ");
  const newText = `${text} ${placeholders}`;
  
  const textPath = contentPath.endsWith("text") ? contentPath : `${contentPath}.text`;
  
  return {
    data: setPath(data, textPath, newText),
    action: {
      path: textPath,
      action: "add_placeholders",
      originalValue: text,
      repairedValue: newText,
    },
  };
};

/**
 * Fix blank IDs to be unique
 */
const fixDuplicateBlankIds: RepairStrategy = (data, error) => {
  if (!error.path.includes("blanks")) return null;
  
  // Find the blanks array path
  const pathParts = error.path.split(".");
  let blanksPath = "";
  for (let i = 0; i < pathParts.length; i++) {
    if (pathParts[i] === "blanks" || pathParts[i].startsWith("blanks[")) {
      blanksPath = pathParts.slice(0, i + 1).join(".");
      break;
    }
  }
  
  if (!blanksPath) return null;
  
  const blanks = getPath(data, blanksPath);
  if (!Array.isArray(blanks)) return null;
  
  // Check for duplicates
  const ids = new Set<string>();
  let hasDuplicates = false;
  
  for (const blank of blanks) {
    if (blank && typeof blank === "object" && "id" in blank) {
      if (ids.has(blank.id as string)) {
        hasDuplicates = true;
        break;
      }
      ids.add(blank.id as string);
    }
  }
  
  if (!hasDuplicates) return null;
  
  // Fix duplicates
  const newBlanks = blanks.map((blank: Record<string, unknown>, i: number) => ({
    ...blank,
    id: `blank-${i + 1}`,
  }));
  
  return {
    data: setPath(data, blanksPath, newBlanks),
    action: {
      path: blanksPath,
      action: "fix_duplicate_ids",
      originalValue: blanks,
      repairedValue: newBlanks,
    },
  };
};

// Ordered list of repair strategies
const REPAIR_STRATEGIES: RepairStrategy[] = [
  trimWhitespace,
  coerceStringToNumber,
  coerceNumberToString,
  generateMissingIds,
  fixCorrectAnswerIndex,
  addMissingPlaceholders,
  fixDuplicateBlankIds,
  padArray,
];

// =============================================================================
// Main Repair Function
// =============================================================================

/**
 * Attempt to repair validation errors without AI
 */
export function attemptRepair<T>(
  data: unknown,
  schema: z.ZodSchema<T>,
  errors: ValidationError[]
): RepairResult<T> {
  let currentData = structuredClone(data);
  const repairs: RepairAction[] = [];
  
  // Try each error
  for (const error of errors) {
    for (const strategy of REPAIR_STRATEGIES) {
      const result = strategy(currentData, error);
      if (result) {
        currentData = result.data;
        repairs.push(result.action);
        break; // Move to next error
      }
    }
  }
  
  // Re-validate after repairs
  if (repairs.length > 0) {
    const revalidation = validateStrict(currentData, schema);
    
    if (revalidation.success) {
      return {
        success: true,
        data: revalidation.data,
        repairs,
        remainingErrors: [],
      };
    }
    
    return {
      success: false,
      repairs,
      remainingErrors: revalidation.errors,
      rawData: currentData,
    };
  }
  
  // No repairs possible
  return {
    success: false,
    repairs: [],
    remainingErrors: errors,
    rawData: data,
  };
}

/**
 * Validate and attempt repair in one step
 */
export function validateAndRepair<T>(
  data: unknown,
  schema: z.ZodSchema<T>
): RepairResult<T> {
  const validation = validateStrict(data, schema);
  
  if (validation.success) {
    return {
      success: true,
      data: validation.data,
      repairs: [],
      remainingErrors: [],
    };
  }
  
  return attemptRepair(data, schema, validation.errors);
}
