/**
 * Error System Exports
 * 
 * Centralized error handling for capsule generation.
 */

export { 
  ErrorCode, 
  isRetriable, 
  isRepairable,
  getRetryDelay,
  getMaxRetries,
  getErrorMessage,
} from "./codes";

export { 
  CapsuleError,
  type CapsuleErrorContext,
  
  // Factory functions
  rateLimitError,
  timeoutError,
  apiError,
  jsonParseError,
  validationError,
  invalidInputError,
  configError,
  fromUnknown,
  fromHttpStatus,
} from "./CapsuleError";
