/**
 * Unified AI Core Module
 * 
 * The central AI system for all AI operations in the application.
 * 
 * ## Quick Start
 * 
 * ```typescript
 * import { ai } from "@shared/ai/core";
 * 
 * // Generate text
 * const response = await ai.generateText({
 *   provider: "google",
 *   modelId: "gemini-1.5-pro",
 *   systemPrompt: "You are a helpful assistant",
 *   prompt: "Hello!",
 * });
 * console.log(response.text);
 * 
 * // Generate structured JSON
 * const data = await ai.generateStructured<CourseOutline>({
 *   provider: "google",
 *   systemPrompt: "Generate a course outline",
 *   prompt: "Create an outline for Python basics",
 *   responseSchema: courseOutlineSchema,
 * });
 * console.log(data.data);
 * 
 * // Stream chat responses
 * const stream = await ai.generateStream({
 *   provider: "openai",
 *   modelId: "gpt-4o",
 *   systemPrompt: "You are a tutor",
 *   messages: [{ role: "user", content: "Explain recursion" }],
 * });
 * for await (const chunk of stream.stream) {
 *   process.stdout.write(chunk.text);
 * }
 * ```
 * 
 * ## Architecture
 * 
 * ```
 * ┌─────────────────────────────────────────────────────────────┐
 * │                      Application Code                       │
 * └─────────────────────────────────────────────────────────────┘
 *                              │
 *                              ▼
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    Unified AI Client                        │
 * │  - Request building      - Retry logic                      │
 * │  - Response handling     - Callbacks                        │
 * └─────────────────────────────────────────────────────────────┘
 *                              │
 *                              ▼
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    Provider Registry                        │
 * │  - Provider selection    - Capability checking              │
 * └─────────────────────────────────────────────────────────────┘
 *                              │
 *              ┌───────────────┴───────────────┐
 *              ▼                               ▼
 * ┌─────────────────────────┐    ┌─────────────────────────┐
 * │    Google Adapter       │    │    OpenAI Adapter       │
 * │  - Native PDF           │    │  - Structured output    │
 * │  - Streaming            │    │  - Streaming            │
 * │  - Structured output    │    │  - Vision (GPT-4o)      │
 * └─────────────────────────┘    └─────────────────────────┘
 *              │                               │
 *              ▼                               ▼
 * ┌─────────────────────────┐    ┌─────────────────────────┐
 * │  @google/generative-ai  │    │        openai           │
 * └─────────────────────────┘    └─────────────────────────┘
 * ```
 * 
 * ## Features
 * 
 * - **Provider Abstraction**: Unified interface for Google and OpenAI
 * - **Automatic Retry**: Exponential backoff for transient errors
 * - **Structured Output**: JSON schema validation for AI responses
 * - **Streaming**: Real-time response streaming
 * - **Multimodal**: PDF and image support (provider-dependent)
 * - **Observability**: Callbacks for logging and metrics
 * - **Type Safety**: Full TypeScript support
 * 
 * @module @shared/ai/core
 */

// =============================================================================
// Main Client Export
// =============================================================================

export { ai, UnifiedAIClient, getAIClient } from "./client";

// =============================================================================
// Type Exports
// =============================================================================

export type {
  // Providers
  AIProvider,
  ProviderCapabilities,
  AIProviderAdapter,
  
  // Configuration
  AIModelConfig,
  AIRequestOptions,
  AIFeatureKey,
  
  // Messages
  MessageRole,
  Message,
  Conversation,
  
  // Attachments
  FileAttachment,
  PdfAttachment,
  ImageAttachment,
  
  // Requests
  BaseAIRequest,
  TextGenerationRequest,
  ChatRequest,
  StructuredRequest,
  AIRequest,
  
  // Responses
  TokenUsage,
  ResponseMetadata,
  BaseAIResponse,
  TextResponse,
  StructuredResponse,
  StreamChunk,
  StreamResponse,
  
  // Errors
  AIErrorCategory,
  AIErrorDetails,
  
  // Callbacks
  AICallbacks,
  
  // Results
  AIResult,
  AsyncAIResult,
} from "./types";

// =============================================================================
// Error Exports
// =============================================================================

export {
  AIError,
  AIErrorCode,
  configError,
  authError,
  rateLimitError,
  timeoutError,
  validationError,
  contentPolicyError,
  serverError,
  networkError,
  jsonParseError,
  schemaValidationError,
  fromUnknown,
  isRetriable,
  getRetryDelay,
} from "./errors";

// =============================================================================
// Registry Exports
// =============================================================================

export {
  getProviderAdapter,
  getProviderCapabilities,
  hasCapability,
  selectBestProvider,
  getAvailableProviders,
  isProviderAvailable,
  getDefaultModel,
} from "./registry";

// =============================================================================
// Provider Exports (for advanced use)
// =============================================================================

export { getGoogleAdapter, GoogleAdapter } from "./providers/google";
export { getOpenAIAdapter, OpenAIAdapter } from "./providers/openai";
