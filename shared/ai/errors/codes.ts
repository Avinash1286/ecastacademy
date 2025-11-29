/**
 * Error codes for capsule generation.
 * Categorized by retriability and handling strategy.
 */

export enum ErrorCode {
  // ==========================================================================
  // Retriable Errors - Can be automatically retried with backoff
  // ==========================================================================
  
  /** API rate limit exceeded - wait and retry */
  RATE_LIMIT = "RATE_LIMIT",
  
  /** Request timed out - retry with same or shorter timeout */
  TIMEOUT = "TIMEOUT",
  
  /** Transient API error (5xx) - retry with backoff */
  API_ERROR = "API_ERROR",
  
  /** Network connectivity issue - retry after brief wait */
  NETWORK_ERROR = "NETWORK_ERROR",
  
  /** Service temporarily unavailable */
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  
  // ==========================================================================
  // Repairable Errors - Can be fixed without full retry
  // ==========================================================================
  
  /** JSON parsing failed - try repair strategies */
  JSON_PARSE_ERROR = "JSON_PARSE_ERROR",
  
  /** JSON valid but doesn't match schema - try validation repair */
  VALIDATION_ERROR = "VALIDATION_ERROR",
  
  /** Schema structure is wrong - may need AI re-generation */
  SCHEMA_MISMATCH = "SCHEMA_MISMATCH",
  
  // ==========================================================================
  // Non-Retriable Errors - Fail fast, don't waste resources
  // ==========================================================================
  
  /** Invalid input from user (bad PDF, empty topic) */
  INVALID_INPUT = "INVALID_INPUT",
  
  /** Content violates AI provider's policy */
  CONTENT_POLICY = "CONTENT_POLICY",
  
  /** Authentication failed */
  AUTH_ERROR = "AUTH_ERROR",
  
  /** Missing required configuration */
  CONFIG_ERROR = "CONFIG_ERROR",
  
  /** Feature not supported for this provider/model */
  NOT_SUPPORTED = "NOT_SUPPORTED",
  
  /** Max retries exceeded */
  MAX_RETRIES_EXCEEDED = "MAX_RETRIES_EXCEEDED",
  
  /** Token budget exceeded for this generation */
  BUDGET_EXCEEDED = "BUDGET_EXCEEDED",
  
  /** Generation was cancelled */
  CANCELLED = "CANCELLED",
  
  /** Unknown/unexpected error */
  UNKNOWN = "UNKNOWN",
}

/**
 * Determines if an error code represents a retriable error
 */
export function isRetriable(code: ErrorCode): boolean {
  switch (code) {
    case ErrorCode.RATE_LIMIT:
    case ErrorCode.TIMEOUT:
    case ErrorCode.API_ERROR:
    case ErrorCode.NETWORK_ERROR:
    case ErrorCode.SERVICE_UNAVAILABLE:
      return true;
    default:
      return false;
  }
}

/**
 * Determines if an error code represents a repairable error
 */
export function isRepairable(code: ErrorCode): boolean {
  switch (code) {
    case ErrorCode.JSON_PARSE_ERROR:
    case ErrorCode.VALIDATION_ERROR:
    case ErrorCode.SCHEMA_MISMATCH:
      return true;
    default:
      return false;
  }
}

/**
 * Get recommended retry delay in milliseconds for an error code
 */
export function getRetryDelay(code: ErrorCode, attempt: number): number {
  const baseDelays: Record<ErrorCode, number> = {
    [ErrorCode.RATE_LIMIT]: 10000,        // 10 seconds base for rate limits
    [ErrorCode.TIMEOUT]: 5000,            // 5 seconds
    [ErrorCode.API_ERROR]: 3000,          // 3 seconds
    [ErrorCode.NETWORK_ERROR]: 2000,      // 2 seconds
    [ErrorCode.SERVICE_UNAVAILABLE]: 15000, // 15 seconds
    
    // Non-retriable - no delay
    [ErrorCode.JSON_PARSE_ERROR]: 0,
    [ErrorCode.VALIDATION_ERROR]: 0,
    [ErrorCode.SCHEMA_MISMATCH]: 0,
    [ErrorCode.INVALID_INPUT]: 0,
    [ErrorCode.CONTENT_POLICY]: 0,
    [ErrorCode.AUTH_ERROR]: 0,
    [ErrorCode.CONFIG_ERROR]: 0,
    [ErrorCode.NOT_SUPPORTED]: 0,
    [ErrorCode.MAX_RETRIES_EXCEEDED]: 0,
    [ErrorCode.BUDGET_EXCEEDED]: 0,
    [ErrorCode.CANCELLED]: 0,
    [ErrorCode.UNKNOWN]: 0,
  };
  
  const baseDelay = baseDelays[code] || 1000;
  
  // Exponential backoff with jitter
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 1000; // 0-1 second jitter
  
  // Cap at 60 seconds
  return Math.min(exponentialDelay + jitter, 60000);
}

/**
 * Get max retry attempts for an error code
 */
export function getMaxRetries(code: ErrorCode): number {
  switch (code) {
    case ErrorCode.RATE_LIMIT:
      return 5; // Rate limits often resolve after waiting
    case ErrorCode.TIMEOUT:
      return 3;
    case ErrorCode.API_ERROR:
      return 3;
    case ErrorCode.NETWORK_ERROR:
      return 3;
    case ErrorCode.SERVICE_UNAVAILABLE:
      return 3;
    default:
      return 0; // Non-retriable
  }
}

/**
 * Get human-readable error message for an error code
 */
export function getErrorMessage(code: ErrorCode): string {
  const messages: Record<ErrorCode, string> = {
    [ErrorCode.RATE_LIMIT]: "Rate limit exceeded. Please wait before trying again.",
    [ErrorCode.TIMEOUT]: "Request timed out. The server took too long to respond.",
    [ErrorCode.API_ERROR]: "The AI service encountered an error. Please try again.",
    [ErrorCode.NETWORK_ERROR]: "Network connection failed. Check your internet connection.",
    [ErrorCode.SERVICE_UNAVAILABLE]: "The AI service is temporarily unavailable.",
    [ErrorCode.JSON_PARSE_ERROR]: "Failed to parse AI response. The format was invalid.",
    [ErrorCode.VALIDATION_ERROR]: "AI response didn't match expected format.",
    [ErrorCode.SCHEMA_MISMATCH]: "AI response structure was incorrect.",
    [ErrorCode.INVALID_INPUT]: "Invalid input provided for generation.",
    [ErrorCode.CONTENT_POLICY]: "Content was flagged by the AI safety system.",
    [ErrorCode.AUTH_ERROR]: "Authentication failed. Check API credentials.",
    [ErrorCode.CONFIG_ERROR]: "Configuration error. Check system settings.",
    [ErrorCode.NOT_SUPPORTED]: "This feature is not supported by the current configuration.",
    [ErrorCode.MAX_RETRIES_EXCEEDED]: "Maximum retry attempts exceeded.",
    [ErrorCode.BUDGET_EXCEEDED]: "Generation exceeded maximum token budget. Try a smaller course.",
    [ErrorCode.CANCELLED]: "Generation was cancelled.",
    [ErrorCode.UNKNOWN]: "An unexpected error occurred.",
  };
  
  return messages[code] || "An error occurred.";
}
