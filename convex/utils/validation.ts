/**
 * Input Validation Utilities
 * 
 * Provides validation and sanitization functions for user input.
 * Defense-in-depth: Even with client-side validation, always validate on server.
 */

// =============================================================================
// Constants
// =============================================================================

export const MAX_STRING_LENGTH = 10000;
export const MAX_NAME_LENGTH = 200;
export const MAX_TITLE_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 5000;
export const MAX_CONTENT_LENGTH = 50000;
export const MAX_URL_LENGTH = 2048;

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate string length and throw if exceeded
 */
export function validateStringLength(
  value: string | undefined | null,
  maxLength: number,
  fieldName: string
): void {
  if (value && value.length > maxLength) {
    throw new Error(`${fieldName} exceeds maximum length of ${maxLength} characters`);
  }
}

/**
 * Validate that a required string is not empty
 */
export function validateRequired(
  value: string | undefined | null,
  fieldName: string
): void {
  if (!value || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }
}

/**
 * Validate a number is within range
 */
export function validateNumberRange(
  value: number | undefined,
  min: number,
  max: number,
  fieldName: string
): void {
  if (value !== undefined) {
    if (value < min || value > max) {
      throw new Error(`${fieldName} must be between ${min} and ${max}`);
    }
  }
}

/**
 * Validate a number is positive
 */
export function validatePositiveNumber(
  value: number | undefined,
  fieldName: string
): void {
  if (value !== undefined && value < 0) {
    throw new Error(`${fieldName} must be a positive number`);
  }
}

/**
 * Validate URL format
 */
export function validateUrl(
  value: string | undefined | null,
  fieldName: string
): void {
  if (value) {
    validateStringLength(value, MAX_URL_LENGTH, fieldName);
    try {
      new URL(value);
    } catch {
      throw new Error(`${fieldName} must be a valid URL`);
    }
  }
}

// =============================================================================
// Sanitization Functions
// =============================================================================

/**
 * Sanitize a string by trimming and limiting length
 */
export function sanitizeString(
  input: string | undefined | null,
  maxLength: number = MAX_STRING_LENGTH
): string {
  if (!input) return "";
  return input.trim().slice(0, maxLength);
}

/**
 * Sanitize a name (title, chapter name, etc.)
 */
export function sanitizeName(input: string | undefined | null): string {
  return sanitizeString(input, MAX_NAME_LENGTH);
}

/**
 * Sanitize a description
 */
export function sanitizeDescription(input: string | undefined | null): string {
  return sanitizeString(input, MAX_DESCRIPTION_LENGTH);
}

// =============================================================================
// Batch Validation
// =============================================================================

/**
 * Validate common content item fields
 */
export function validateContentItemFields(args: {
  title?: string;
  textContent?: string;
  resourceUrl?: string;
  resourceTitle?: string;
}): void {
  if (args.title) {
    validateStringLength(args.title, MAX_TITLE_LENGTH, "Title");
  }
  if (args.textContent) {
    validateStringLength(args.textContent, MAX_CONTENT_LENGTH, "Text content");
  }
  if (args.resourceUrl) {
    validateUrl(args.resourceUrl, "Resource URL");
  }
  if (args.resourceTitle) {
    validateStringLength(args.resourceTitle, MAX_TITLE_LENGTH, "Resource title");
  }
}

/**
 * Validate common course fields
 */
export function validateCourseFields(args: {
  name?: string;
  description?: string;
  thumbnailUrl?: string;
}): void {
  if (args.name) {
    validateStringLength(args.name, MAX_NAME_LENGTH, "Course name");
  }
  if (args.description) {
    validateStringLength(args.description, MAX_DESCRIPTION_LENGTH, "Description");
  }
  if (args.thumbnailUrl) {
    validateUrl(args.thumbnailUrl, "Thumbnail URL");
  }
}

/**
 * Validate chapter fields
 */
export function validateChapterFields(args: {
  name?: string;
  title?: string;
  description?: string;
}): void {
  if (args.name) {
    validateStringLength(args.name, MAX_NAME_LENGTH, "Chapter name");
  }
  if (args.title) {
    validateStringLength(args.title, MAX_TITLE_LENGTH, "Chapter title");
  }
  if (args.description) {
    validateStringLength(args.description, MAX_DESCRIPTION_LENGTH, "Description");
  }
}
