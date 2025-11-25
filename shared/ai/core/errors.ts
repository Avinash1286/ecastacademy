/**
 * AI Error Classes
 * 
 * Standardized error handling for all AI operations.
 * Provides consistent error classification, retry logic, and debugging info.
 */

import type { AIProvider, AIErrorCategory, AIErrorDetails } from "./types";

// =============================================================================
// Error Codes
// =============================================================================

/**
 * Standardized error codes
 */
export const AIErrorCode = {
  // Configuration errors
  MISSING_API_KEY: "MISSING_API_KEY",
  INVALID_CONFIG: "INVALID_CONFIG",
  UNSUPPORTED_PROVIDER: "UNSUPPORTED_PROVIDER",
  UNSUPPORTED_MODEL: "UNSUPPORTED_MODEL",
  
  // Authentication errors
  INVALID_API_KEY: "INVALID_API_KEY",
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",
  
  // Rate limiting
  RATE_LIMITED: "RATE_LIMITED",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
  
  // Request errors
  TIMEOUT: "TIMEOUT",
  CANCELLED: "CANCELLED",
  INVALID_REQUEST: "INVALID_REQUEST",
  REQUEST_TOO_LARGE: "REQUEST_TOO_LARGE",
  
  // Response errors
  INVALID_RESPONSE: "INVALID_RESPONSE",
  JSON_PARSE_ERROR: "JSON_PARSE_ERROR",
  SCHEMA_VALIDATION_ERROR: "SCHEMA_VALIDATION_ERROR",
  
  // Content errors
  CONTENT_BLOCKED: "CONTENT_BLOCKED",
  SAFETY_VIOLATION: "SAFETY_VIOLATION",
  
  // Server errors
  PROVIDER_ERROR: "PROVIDER_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  
  // Network errors
  NETWORK_ERROR: "NETWORK_ERROR",
  CONNECTION_RESET: "CONNECTION_RESET",
  
  // Unknown
  UNKNOWN: "UNKNOWN",
} as const;

export type AIErrorCodeType = typeof AIErrorCode[keyof typeof AIErrorCode];

// =============================================================================
// Main Error Class
// =============================================================================

/**
 * Unified AI Error
 * 
 * All AI-related errors are wrapped in this class for consistent handling.
 */
export class AIError extends Error {
  readonly category: AIErrorCategory;
  readonly code: AIErrorCodeType;
  readonly provider?: AIProvider;
  readonly statusCode?: number;
  readonly retriable: boolean;
  readonly retryAfterMs?: number;
  readonly context: Record<string, unknown>;
  readonly timestamp: number;
  
  constructor(details: Omit<AIErrorDetails, "message"> & { message: string }) {
    super(details.message);
    this.name = "AIError";
    this.category = details.category;
    this.code = details.code as AIErrorCodeType;
    this.provider = details.provider;
    this.statusCode = details.statusCode;
    this.retriable = details.retriable;
    this.retryAfterMs = details.retryAfterMs;
    this.context = details.context || {};
    this.timestamp = Date.now();
    
    if (details.cause) {
      this.cause = details.cause;
    }
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AIError);
    }
  }
  
  /**
   * Convert to AIErrorDetails for callbacks
   */
  toDetails(): AIErrorDetails {
    return {
      category: this.category,
      code: this.code,
      message: this.message,
      provider: this.provider,
      statusCode: this.statusCode,
      retriable: this.retriable,
      retryAfterMs: this.retryAfterMs,
      cause: this.cause as Error | undefined,
      context: this.context,
    };
  }
  
  /**
   * Create a copy with additional context
   */
  withContext(additionalContext: Record<string, unknown>): AIError {
    return new AIError({
      category: this.category,
      code: this.code,
      message: this.message,
      provider: this.provider,
      statusCode: this.statusCode,
      retriable: this.retriable,
      retryAfterMs: this.retryAfterMs,
      cause: this.cause as Error | undefined,
      context: { ...this.context, ...additionalContext },
    });
  }
  
  /**
   * Serialize for logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      category: this.category,
      code: this.code,
      message: this.message,
      provider: this.provider,
      statusCode: this.statusCode,
      retriable: this.retriable,
      retryAfterMs: this.retryAfterMs,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

// =============================================================================
// Error Factory Functions
// =============================================================================

/**
 * Create a configuration error
 */
export function configError(
  code: AIErrorCodeType,
  message: string,
  context?: Record<string, unknown>
): AIError {
  return new AIError({
    category: "config",
    code,
    message,
    retriable: false,
    context,
  });
}

/**
 * Create an authentication error
 */
export function authError(
  provider: AIProvider,
  message: string,
  statusCode?: number
): AIError {
  return new AIError({
    category: "auth",
    code: AIErrorCode.INVALID_API_KEY,
    message,
    provider,
    statusCode: statusCode || 401,
    retriable: false,
  });
}

/**
 * Create a rate limit error
 */
export function rateLimitError(
  provider: AIProvider,
  retryAfterMs?: number,
  context?: Record<string, unknown>
): AIError {
  return new AIError({
    category: "rate_limit",
    code: AIErrorCode.RATE_LIMITED,
    message: `Rate limit exceeded for ${provider}`,
    provider,
    statusCode: 429,
    retriable: true,
    retryAfterMs: retryAfterMs || 60000,
    context,
  });
}

/**
 * Create a timeout error
 */
export function timeoutError(
  provider: AIProvider,
  timeoutMs: number,
  context?: Record<string, unknown>
): AIError {
  return new AIError({
    category: "timeout",
    code: AIErrorCode.TIMEOUT,
    message: `Request to ${provider} timed out after ${timeoutMs}ms`,
    provider,
    retriable: true,
    context: { ...context, timeoutMs },
  });
}

/**
 * Create a validation error
 */
export function validationError(
  message: string,
  context?: Record<string, unknown>
): AIError {
  return new AIError({
    category: "validation",
    code: AIErrorCode.INVALID_REQUEST,
    message,
    retriable: false,
    context,
  });
}

/**
 * Create a content policy error
 */
export function contentPolicyError(
  provider: AIProvider,
  message: string,
  context?: Record<string, unknown>
): AIError {
  return new AIError({
    category: "content",
    code: AIErrorCode.CONTENT_BLOCKED,
    message,
    provider,
    retriable: false,
    context,
  });
}

/**
 * Create a server error
 */
export function serverError(
  provider: AIProvider,
  statusCode: number,
  message: string,
  context?: Record<string, unknown>
): AIError {
  return new AIError({
    category: "server",
    code: AIErrorCode.PROVIDER_ERROR,
    message,
    provider,
    statusCode,
    retriable: statusCode >= 500,
    retryAfterMs: statusCode >= 500 ? 5000 : undefined,
    context,
  });
}

/**
 * Create a network error
 */
export function networkError(
  message: string,
  cause?: Error
): AIError {
  return new AIError({
    category: "network",
    code: AIErrorCode.NETWORK_ERROR,
    message,
    retriable: true,
    retryAfterMs: 1000,
    cause,
  });
}

/**
 * Create a JSON parsing error
 */
export function jsonParseError(
  rawText: string,
  cause?: Error
): AIError {
  return new AIError({
    category: "validation",
    code: AIErrorCode.JSON_PARSE_ERROR,
    message: "Failed to parse JSON response from AI",
    retriable: false,
    cause,
    context: {
      rawTextPreview: rawText.slice(0, 500),
      rawTextLength: rawText.length,
    },
  });
}

/**
 * Create a schema validation error
 */
export function schemaValidationError(
  errors: Array<{ path: string; message: string }>,
  context?: Record<string, unknown>
): AIError {
  return new AIError({
    category: "validation",
    code: AIErrorCode.SCHEMA_VALIDATION_ERROR,
    message: `Schema validation failed: ${errors.map(e => e.message).join(", ")}`,
    retriable: false,
    context: { ...context, validationErrors: errors },
  });
}

// =============================================================================
// Error Utilities
// =============================================================================

/**
 * Convert unknown error to AIError
 */
export function fromUnknown(error: unknown, context?: Record<string, unknown>): AIError {
  if (error instanceof AIError) {
    return context ? error.withContext(context) : error;
  }
  
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Try to classify the error
    if (message.includes("timeout") || message.includes("timed out")) {
      return new AIError({
        category: "timeout",
        code: AIErrorCode.TIMEOUT,
        message: error.message,
        retriable: true,
        cause: error,
        context,
      });
    }
    
    if (message.includes("rate limit") || message.includes("429") || message.includes("quota")) {
      return new AIError({
        category: "rate_limit",
        code: AIErrorCode.RATE_LIMITED,
        message: error.message,
        statusCode: 429,
        retriable: true,
        retryAfterMs: 60000,
        cause: error,
        context,
      });
    }
    
    if (message.includes("401") || message.includes("403") || message.includes("api key")) {
      return new AIError({
        category: "auth",
        code: AIErrorCode.INVALID_API_KEY,
        message: error.message,
        statusCode: message.includes("403") ? 403 : 401,
        retriable: false,
        cause: error,
        context,
      });
    }
    
    if (message.includes("500") || message.includes("503") || message.includes("internal")) {
      return new AIError({
        category: "server",
        code: AIErrorCode.PROVIDER_ERROR,
        message: error.message,
        statusCode: message.includes("503") ? 503 : 500,
        retriable: true,
        retryAfterMs: 5000,
        cause: error,
        context,
      });
    }
    
    if (message.includes("network") || message.includes("econnreset") || message.includes("fetch")) {
      return new AIError({
        category: "network",
        code: AIErrorCode.NETWORK_ERROR,
        message: error.message,
        retriable: true,
        retryAfterMs: 1000,
        cause: error,
        context,
      });
    }
    
    // Default to unknown
    return new AIError({
      category: "unknown",
      code: AIErrorCode.UNKNOWN,
      message: error.message,
      retriable: false,
      cause: error,
      context,
    });
  }
  
  // Non-Error thrown
  return new AIError({
    category: "unknown",
    code: AIErrorCode.UNKNOWN,
    message: String(error),
    retriable: false,
    context,
  });
}

/**
 * Check if an error is retriable
 */
export function isRetriable(error: AIError): boolean {
  return error.retriable;
}

/**
 * Get retry delay for an error
 */
export function getRetryDelay(error: AIError, attempt: number): number {
  // Use error-specified delay if available
  if (error.retryAfterMs) {
    return error.retryAfterMs;
  }
  
  // Exponential backoff with jitter
  const baseDelay = 1000;
  const maxDelay = 60000;
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
  const jitter = Math.random() * 0.3 * exponentialDelay;
  
  return Math.floor(exponentialDelay + jitter);
}
