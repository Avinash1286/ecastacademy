/**
 * Robust JSON Extractor
 * 
 * Multiple strategies to extract valid JSON from AI responses.
 * Handles common issues like markdown code fences, trailing text, malformed JSON.
 */

import { jsonParseError, CapsuleError, ErrorCode } from "../errors";

// =============================================================================
// Types
// =============================================================================

export type JsonExtractionResult<T = unknown> = 
  | {
      success: true;
      data: T;
      strategy: ExtractionStrategy;
      wasRepaired: boolean;
      warnings?: string[];
    }
  | {
      success: false;
      error: CapsuleError;
      attemptedStrategies: ExtractionStrategy[];
      rawInput: string;
    };

export type ExtractionStrategy = 
  | "direct"
  | "strip_markdown"
  | "balanced_braces"
  | "regex_extract"
  | "manual_repair"
  | "jsonrepair_lib";

// =============================================================================
// Strategy 1: Direct Parse
// =============================================================================

function tryDirectParse(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// =============================================================================
// Strategy 2: Strip Markdown Fences
// =============================================================================

const MARKDOWN_FENCE_PATTERNS = [
  /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/,      // Standard code fence
  /^```(?:json)?\s*([\s\S]*?)```$/,             // Compact code fence
  /^`([\s\S]*?)`$/,                             // Inline code
];

function stripMarkdownFences(raw: string): string {
  let result = raw.trim();
  
  for (const pattern of MARKDOWN_FENCE_PATTERNS) {
    const match = result.match(pattern);
    if (match && match[1]) {
      result = match[1].trim();
      break;
    }
  }
  
  return result;
}

function tryStripMarkdown(raw: string): unknown | null {
  const stripped = stripMarkdownFences(raw);
  if (stripped === raw) return null; // No change, don't try same parse
  
  try {
    return JSON.parse(stripped);
  } catch {
    return null;
  }
}

// =============================================================================
// Strategy 3: Balanced Brace Extraction
// =============================================================================

function extractBalancedJson(raw: string): string | null {
  const trimmed = raw.trim();
  
  // Find first { or [
  let startChar: "{" | "[" | null = null;
  let endChar: "}" | "]" = "}";
  let startIndex = -1;
  
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === "{") {
      startChar = "{";
      endChar = "}";
      startIndex = i;
      break;
    }
    if (trimmed[i] === "[") {
      startChar = "[";
      endChar = "]";
      startIndex = i;
      break;
    }
  }
  
  if (startIndex === -1 || !startChar) return null;
  
  // Track nesting with proper string handling
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  
  for (let i = startIndex; i < trimmed.length; i++) {
    const char = trimmed[i];
    
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    
    if (char === "\\") {
      escapeNext = true;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
      continue;
    }
    
    if (inString) continue;
    
    if (char === startChar || char === (startChar === "{" ? "{" : "[")) {
      depth++;
    } else if (char === endChar || char === (endChar === "}" ? "}" : "]")) {
      depth--;
      if (depth === 0) {
        return trimmed.slice(startIndex, i + 1);
      }
    }
  }
  
  return null;
}

function tryBalancedExtraction(raw: string): unknown | null {
  const extracted = extractBalancedJson(raw);
  if (!extracted) return null;
  
  try {
    return JSON.parse(extracted);
  } catch {
    return null;
  }
}

// =============================================================================
// Strategy 4: Regex-based Extraction (for common patterns)
// =============================================================================

const JSON_OBJECT_PATTERNS = [
  // JSON after common preambles
  /(?:here(?:'s| is)(?: the)? (?:the )?json:?\s*)([\s\S]*)/i,
  /(?:output:?\s*)([\s\S]*)/i,
  /(?:result:?\s*)([\s\S]*)/i,
];

function tryRegexExtraction(raw: string): unknown | null {
  for (const pattern of JSON_OBJECT_PATTERNS) {
    const match = raw.match(pattern);
    if (match && match[1]) {
      const potential = match[1].trim();
      // Try balanced extraction on the remainder
      const extracted = extractBalancedJson(potential);
      if (extracted) {
        try {
          return JSON.parse(extracted);
        } catch {
          continue;
        }
      }
    }
  }
  return null;
}

// =============================================================================
// Strategy 5: Manual Repair (common issues)
// =============================================================================

function tryManualRepair(raw: string): { data: unknown; repairs: string[] } | null {
  let text = stripMarkdownFences(raw);
  const extracted = extractBalancedJson(text);
  if (!extracted) return null;
  
  text = extracted;
  const repairs: string[] = [];
  
  // Repair 1: Remove trailing commas before } or ]
  const trailingCommaFixed = text.replace(/,(\s*[}\]])/g, "$1");
  if (trailingCommaFixed !== text) {
    repairs.push("removed_trailing_commas");
    text = trailingCommaFixed;
  }
  
  // Repair 2: Fix single quotes to double quotes (careful with apostrophes)
  // Only fix quotes around keys and simple string values
  const singleQuoteFixed = text.replace(
    /(\{|\[|,)\s*'([^']+)'(\s*:)/g, 
    '$1"$2"$3'
  );
  if (singleQuoteFixed !== text) {
    repairs.push("fixed_single_quotes_keys");
    text = singleQuoteFixed;
  }
  
  // Repair 3: Add quotes to unquoted keys
  const unquotedKeyFixed = text.replace(
    /(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g,
    '$1"$2":'
  );
  if (unquotedKeyFixed !== text) {
    repairs.push("quoted_unquoted_keys");
    text = unquotedKeyFixed;
  }
  
  // Repair 4: Fix newlines in strings (replace with \n)
  // This is tricky - only do it if we're inside a string value
  const newlineFixed = text.replace(
    /"([^"]*)\n([^"]*)"/g,
    (match, before, after) => `"${before}\\n${after}"`
  );
  if (newlineFixed !== text) {
    repairs.push("escaped_newlines");
    text = newlineFixed;
  }
  
  // Repair 5: Remove control characters
  const controlCharsFixed = text.replace(/[\x00-\x1F\x7F]/g, (char) => {
    if (char === "\n" || char === "\r" || char === "\t") {
      return char; // Keep these
    }
    repairs.push("removed_control_chars");
    return "";
  });
  text = controlCharsFixed;
  
  if (repairs.length === 0) return null;
  
  try {
    return { data: JSON.parse(text), repairs };
  } catch {
    return null;
  }
}

// =============================================================================
// Strategy 6: jsonrepair Library (if available)
// =============================================================================

let jsonrepairLib: ((text: string) => string) | null = null;
let jsonrepairLoaded = false;

async function loadJsonrepair(): Promise<void> {
  if (jsonrepairLoaded) return;
  jsonrepairLoaded = true;
  
  try {
    // Dynamic import to avoid bundling issues
    const mod = await import("jsonrepair");
    jsonrepairLib = mod.jsonrepair;
  } catch {
    // Library not installed - that's okay
    jsonrepairLib = null;
  }
}

async function tryJsonrepair(raw: string): Promise<unknown | null> {
  await loadJsonrepair();
  if (!jsonrepairLib) return null;
  
  const extracted = extractBalancedJson(raw) || stripMarkdownFences(raw);
  
  try {
    const repaired = jsonrepairLib(extracted);
    return JSON.parse(repaired);
  } catch {
    return null;
  }
}

// =============================================================================
// Main Extraction Function
// =============================================================================

export async function extractJson<T = unknown>(
  raw: string,
  context?: { stage?: string; attempt?: number }
): Promise<JsonExtractionResult<T>> {
  const attemptedStrategies: ExtractionStrategy[] = [];
  
  if (!raw || typeof raw !== "string") {
    return {
      success: false,
      error: new CapsuleError(
        ErrorCode.JSON_PARSE_ERROR,
        "Empty or invalid input for JSON extraction",
        context
      ),
      attemptedStrategies,
      rawInput: String(raw).substring(0, 500),
    };
  }
  
  const trimmed = raw.trim();
  
  // Strategy 1: Direct parse
  attemptedStrategies.push("direct");
  const direct = tryDirectParse(trimmed);
  if (direct !== null) {
    return {
      success: true,
      data: direct as T,
      strategy: "direct",
      wasRepaired: false,
    };
  }
  
  // Strategy 2: Strip markdown fences
  attemptedStrategies.push("strip_markdown");
  const stripped = tryStripMarkdown(trimmed);
  if (stripped !== null) {
    return {
      success: true,
      data: stripped as T,
      strategy: "strip_markdown",
      wasRepaired: false,
      warnings: ["Response was wrapped in markdown code fences"],
    };
  }
  
  // Strategy 3: Balanced brace extraction
  attemptedStrategies.push("balanced_braces");
  const balanced = tryBalancedExtraction(trimmed);
  if (balanced !== null) {
    return {
      success: true,
      data: balanced as T,
      strategy: "balanced_braces",
      wasRepaired: false,
      warnings: ["JSON extracted from surrounding text"],
    };
  }
  
  // Strategy 4: Regex extraction
  attemptedStrategies.push("regex_extract");
  const regexed = tryRegexExtraction(trimmed);
  if (regexed !== null) {
    return {
      success: true,
      data: regexed as T,
      strategy: "regex_extract",
      wasRepaired: false,
      warnings: ["JSON extracted using pattern matching"],
    };
  }
  
  // Strategy 5: Manual repair
  attemptedStrategies.push("manual_repair");
  const repaired = tryManualRepair(trimmed);
  if (repaired !== null) {
    return {
      success: true,
      data: repaired.data as T,
      strategy: "manual_repair",
      wasRepaired: true,
      warnings: [`JSON repaired: ${repaired.repairs.join(", ")}`],
    };
  }
  
  // Strategy 6: jsonrepair library
  attemptedStrategies.push("jsonrepair_lib");
  const libRepaired = await tryJsonrepair(trimmed);
  if (libRepaired !== null) {
    return {
      success: true,
      data: libRepaired as T,
      strategy: "jsonrepair_lib",
      wasRepaired: true,
      warnings: ["JSON repaired using jsonrepair library"],
    };
  }
  
  // All strategies failed
  return {
    success: false,
    error: jsonParseError(
      trimmed,
      new Error("All JSON extraction strategies failed"),
      context
    ),
    attemptedStrategies,
    rawInput: trimmed.substring(0, 1000),
  };
}

// =============================================================================
// Sync version (without jsonrepair library)
// =============================================================================

export function extractJsonSync<T = unknown>(
  raw: string,
  context?: { stage?: string; attempt?: number }
): JsonExtractionResult<T> {
  const attemptedStrategies: ExtractionStrategy[] = [];
  
  if (!raw || typeof raw !== "string") {
    return {
      success: false,
      error: new CapsuleError(
        ErrorCode.JSON_PARSE_ERROR,
        "Empty or invalid input for JSON extraction",
        context
      ),
      attemptedStrategies,
      rawInput: String(raw).substring(0, 500),
    };
  }
  
  const trimmed = raw.trim();
  
  // Strategy 1: Direct parse
  attemptedStrategies.push("direct");
  const direct = tryDirectParse(trimmed);
  if (direct !== null) {
    return {
      success: true,
      data: direct as T,
      strategy: "direct",
      wasRepaired: false,
    };
  }
  
  // Strategy 2: Strip markdown fences
  attemptedStrategies.push("strip_markdown");
  const stripped = tryStripMarkdown(trimmed);
  if (stripped !== null) {
    return {
      success: true,
      data: stripped as T,
      strategy: "strip_markdown",
      wasRepaired: false,
      warnings: ["Response was wrapped in markdown code fences"],
    };
  }
  
  // Strategy 3: Balanced brace extraction
  attemptedStrategies.push("balanced_braces");
  const balanced = tryBalancedExtraction(trimmed);
  if (balanced !== null) {
    return {
      success: true,
      data: balanced as T,
      strategy: "balanced_braces",
      wasRepaired: false,
      warnings: ["JSON extracted from surrounding text"],
    };
  }
  
  // Strategy 4: Regex extraction
  attemptedStrategies.push("regex_extract");
  const regexed = tryRegexExtraction(trimmed);
  if (regexed !== null) {
    return {
      success: true,
      data: regexed as T,
      strategy: "regex_extract",
      wasRepaired: false,
      warnings: ["JSON extracted using pattern matching"],
    };
  }
  
  // Strategy 5: Manual repair
  attemptedStrategies.push("manual_repair");
  const repaired = tryManualRepair(trimmed);
  if (repaired !== null) {
    return {
      success: true,
      data: repaired.data as T,
      strategy: "manual_repair",
      wasRepaired: true,
      warnings: [`JSON repaired: ${repaired.repairs.join(", ")}`],
    };
  }
  
  // All strategies failed
  return {
    success: false,
    error: jsonParseError(
      trimmed,
      new Error("All JSON extraction strategies failed"),
      context
    ),
    attemptedStrategies,
    rawInput: trimmed.substring(0, 1000),
  };
}

// =============================================================================
// Utility Exports
// =============================================================================

export { stripMarkdownFences, extractBalancedJson };
