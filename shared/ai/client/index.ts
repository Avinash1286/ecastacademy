/**
 * AI Client Exports
 */

// Types
export type {
  AIProvider,
  AIModelConfig,
  AIRequestOptions,
  StructuredOutputRequest,
  AIResponse,
  AIErrorResponse,
  RateLimitConfig,
  RateLimitResult,
  AIClientCallbacks,
} from "./types";

// Main client
export {
  type AIClient,
  createAIClient,
  executeWithRetry,
  createGeminiClient,
  createOpenAIClient,
  getRecommendedProvider,
  supportsStructuredOutput,
  supportsPdfInput,
  type RetryOptions,
} from "./aiClient";

// Circuit breaker
export {
  type CircuitState,
  type CircuitBreakerConfig,
  type CircuitBreakerState,
  shouldAllowRequest,
  recordSuccess,
  recordFailure,
  resetCircuit,
  getAllCircuitStates,
  withCircuitBreaker,
  CircuitBreakerOpenError,
} from "./circuitBreaker";
// Adapters (for direct use if needed)
export { GeminiAdapter, createGeminiAdapter } from "./geminiAdapter";
export { OpenAIAdapter, createOpenAIAdapter } from "./openaiAdapter";
