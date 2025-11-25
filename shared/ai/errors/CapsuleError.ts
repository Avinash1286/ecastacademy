/**
 * Custom error class for capsule generation.
 * Provides structured error information for proper handling.
 */

import { 
  ErrorCode, 
  isRetriable, 
  isRepairable, 
  getRetryDelay, 
  getMaxRetries,
  getErrorMessage 
} from "./codes";

export interface CapsuleErrorContext {
  /** Stage where the error occurred */
  stage?: string;
  
  /** Attempt number when error occurred */
  attempt?: number;
  
  /** Module index if applicable */
  moduleIndex?: number;
  
  /** Lesson index if applicable */
  lessonIndex?: number;
  
  /** Raw AI response if available */
  rawResponse?: string;
  
  /** Validation errors if applicable */
  validationErrors?: Array<{
    path: string;
    message: string;
  }>;
  
  /** HTTP status code if applicable */
  statusCode?: number;
  
  /** Provider (google, openai) */
  provider?: string;
  
  /** Model ID */
  model?: string;
  
  /** Request duration in ms */
  durationMs?: number;
  
  /** Any additional context */
  [key: string]: unknown;
}

export class CapsuleError extends Error {
  public readonly code: ErrorCode;
  public readonly context: CapsuleErrorContext;
  public readonly retriable: boolean;
  public readonly repairable: boolean;
  public readonly cause?: Error;
  public readonly timestamp: number;
  
  constructor(
    code: ErrorCode,
    message?: string,
    context: CapsuleErrorContext = {},
    cause?: Error
  ) {
    super(message || getErrorMessage(code));
    
    this.name = "CapsuleError";
    this.code = code;
    this.context = context;
    this.retriable = isRetriable(code);
    this.repairable = isRepairable(code);
    this.cause = cause;
    this.timestamp = Date.now();
    
    // Maintain proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CapsuleError);
    }
  }
  
  /**
   * Get recommended retry delay for this error
   */
  getRetryDelay(): number {
    return getRetryDelay(this.code, this.context.attempt || 1);
  }
  
  /**
   * Get max retry attempts for this error type
   */
  getMaxRetries(): number {
    return getMaxRetries(this.code);
  }
  
  /**
   * Check if more retries should be attempted
   */
  shouldRetry(): boolean {
    if (!this.retriable) return false;
    const attempt = this.context.attempt || 1;
    return attempt < this.getMaxRetries();
  }
  
  /**
   * Create a new error with incremented attempt
   */
  withNextAttempt(): CapsuleError {
    return new CapsuleError(
      this.code,
      this.message,
      {
        ...this.context,
        attempt: (this.context.attempt || 1) + 1,
      },
      this.cause
    );
  }
  
  /**
   * Serialize error for logging/storage
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      retriable: this.retriable,
      repairable: this.repairable,
      context: this.context,
      timestamp: this.timestamp,
      cause: this.cause ? {
        name: this.cause.name,
        message: this.cause.message,
      } : undefined,
    };
  }
  
  /**
   * Create a user-friendly error message
   */
  toUserMessage(): string {
    const baseMessage = getErrorMessage(this.code);
    
    if (this.retriable && this.shouldRetry()) {
      const delay = Math.ceil(this.getRetryDelay() / 1000);
      return `${baseMessage} Retrying in ${delay} seconds...`;
    }
    
    return baseMessage;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a rate limit error
 */
export function rateLimitError(
  context?: CapsuleErrorContext,
  retryAfterMs?: number
): CapsuleError {
  return new CapsuleError(
    ErrorCode.RATE_LIMIT,
    retryAfterMs 
      ? `Rate limit exceeded. Retry after ${Math.ceil(retryAfterMs / 1000)}s`
      : undefined,
    context
  );
}

/**
 * Create a timeout error
 */
export function timeoutError(
  timeoutMs: number,
  context?: CapsuleErrorContext
): CapsuleError {
  return new CapsuleError(
    ErrorCode.TIMEOUT,
    `Request timed out after ${timeoutMs}ms`,
    context
  );
}

/**
 * Create an API error
 */
export function apiError(
  statusCode: number,
  message: string,
  context?: CapsuleErrorContext
): CapsuleError {
  return new CapsuleError(
    ErrorCode.API_ERROR,
    `API error (${statusCode}): ${message}`,
    { ...context, statusCode }
  );
}

/**
 * Create a JSON parse error
 */
export function jsonParseError(
  rawResponse: string,
  parseError: Error,
  context?: CapsuleErrorContext
): CapsuleError {
  return new CapsuleError(
    ErrorCode.JSON_PARSE_ERROR,
    `JSON parse failed: ${parseError.message}`,
    { 
      ...context, 
      rawResponse: rawResponse.substring(0, 500), // Truncate for logging
    },
    parseError
  );
}

/**
 * Create a validation error
 */
export function validationError(
  errors: Array<{ path: string; message: string }>,
  context?: CapsuleErrorContext
): CapsuleError {
  const summary = errors.slice(0, 3).map(e => `${e.path}: ${e.message}`).join("; ");
  return new CapsuleError(
    ErrorCode.VALIDATION_ERROR,
    `Validation failed: ${summary}${errors.length > 3 ? ` (+${errors.length - 3} more)` : ""}`,
    { ...context, validationErrors: errors }
  );
}

/**
 * Create an invalid input error
 */
export function invalidInputError(
  message: string,
  context?: CapsuleErrorContext
): CapsuleError {
  return new CapsuleError(
    ErrorCode.INVALID_INPUT,
    message,
    context
  );
}

/**
 * Create a config error
 */
export function configError(
  message: string,
  context?: CapsuleErrorContext
): CapsuleError {
  return new CapsuleError(
    ErrorCode.CONFIG_ERROR,
    message,
    context
  );
}

/**
 * Create an error from an unknown error
 */
export function fromUnknown(
  error: unknown,
  context?: CapsuleErrorContext
): CapsuleError {
  if (error instanceof CapsuleError) {
    // Already a CapsuleError, just add context
    return new CapsuleError(
      error.code,
      error.message,
      { ...error.context, ...context },
      error.cause
    );
  }
  
  if (error instanceof Error) {
    // Detect error type from message/name
    const message = error.message.toLowerCase();
    
    if (message.includes("rate limit") || message.includes("429")) {
      return rateLimitError(context);
    }
    
    if (message.includes("timeout") || message.includes("timed out")) {
      return timeoutError(0, context);
    }
    
    if (message.includes("network") || message.includes("fetch failed")) {
      return new CapsuleError(ErrorCode.NETWORK_ERROR, error.message, context, error);
    }
    
    if (message.includes("unauthorized") || message.includes("401")) {
      return new CapsuleError(ErrorCode.AUTH_ERROR, error.message, context, error);
    }
    
    if (message.includes("content") && message.includes("policy")) {
      return new CapsuleError(ErrorCode.CONTENT_POLICY, error.message, context, error);
    }
    
    // Default to unknown
    return new CapsuleError(ErrorCode.UNKNOWN, error.message, context, error);
  }
  
  // Non-Error thrown
  return new CapsuleError(
    ErrorCode.UNKNOWN,
    String(error),
    context
  );
}

/**
 * Classify an HTTP status code into an error
 */
export function fromHttpStatus(
  status: number,
  message: string,
  context?: CapsuleErrorContext
): CapsuleError {
  if (status === 429) {
    return rateLimitError({ ...context, statusCode: status });
  }
  
  if (status === 401 || status === 403) {
    return new CapsuleError(
      ErrorCode.AUTH_ERROR,
      message,
      { ...context, statusCode: status }
    );
  }
  
  if (status === 400) {
    return invalidInputError(message, { ...context, statusCode: status });
  }
  
  if (status === 503) {
    return new CapsuleError(
      ErrorCode.SERVICE_UNAVAILABLE,
      message,
      { ...context, statusCode: status }
    );
  }
  
  if (status >= 500) {
    return apiError(status, message, context);
  }
  
  return new CapsuleError(
    ErrorCode.UNKNOWN,
    message,
    { ...context, statusCode: status }
  );
}
