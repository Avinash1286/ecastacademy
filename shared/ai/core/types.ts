/**
 * Unified AI Core Types
 * 
 * Central type definitions for the unified AI system.
 * All AI operations throughout the application use these types.
 * 
 * Design Principles:
 * - Single source of truth for AI types
 * - Provider-agnostic interfaces
 * - Extensible for new providers
 * - Type-safe at compile time
 */

import type { JsonSchema } from "../schemas/jsonSchema";

// =============================================================================
// Provider Types
// =============================================================================

/**
 * Supported AI providers.
 * Maps to database `aiModels.provider` field.
 */
export type AIProvider = "google" | "openai";

/**
 * Provider capabilities for feature detection
 */
export interface ProviderCapabilities {
  /** Supports streaming responses */
  streaming: boolean;
  /** Supports structured JSON output with schema */
  structuredOutput: boolean;
  /** Supports native PDF input (multimodal) */
  nativePdf: boolean;
  /** Supports image input (vision) */
  vision: boolean;
  /** Supports function/tool calling */
  functionCalling: boolean;
  /** Maximum context window (tokens) */
  maxContextTokens: number;
  /** Maximum output tokens */
  maxOutputTokens: number;
}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * AI Model Configuration
 * Used to configure which model to use for a request.
 */
export interface AIModelConfig {
  /** Provider identifier */
  provider: AIProvider;
  /** Model identifier (e.g., "gemini-1.5-pro", "gpt-4o") */
  modelId: string;
  /** API key (optional - falls back to environment variables) */
  apiKey?: string;
  /** Temperature for response randomness (0-1) */
  temperature?: number;
  /** Maximum tokens in response */
  maxOutputTokens?: number;
}

/**
 * Request options that apply to all AI requests
 */
export interface AIRequestOptions {
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  /** Maximum retry attempts for transient errors */
  maxRetries?: number;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Skip rate limit check (for high-priority requests) */
  skipRateLimit?: boolean;
  /** Custom headers for the request */
  headers?: Record<string, string>;
}

// =============================================================================
// Message Types
// =============================================================================

/**
 * Role in a conversation
 */
export type MessageRole = "system" | "user" | "assistant";

/**
 * A message in a conversation
 */
export interface Message {
  role: MessageRole;
  content: string;
}

/**
 * Conversation history
 */
export type Conversation = Message[];

// =============================================================================
// Attachment Types
// =============================================================================

/**
 * File attachment for multimodal requests
 */
export interface FileAttachment {
  /** Base64 encoded file data */
  base64: string;
  /** MIME type of the file */
  mimeType: string;
  /** Optional filename for display */
  filename?: string;
}

/**
 * PDF attachment (for Gemini native PDF support)
 */
export interface PdfAttachment extends FileAttachment {
  mimeType: "application/pdf";
}

/**
 * Image attachment (for vision models)
 */
export interface ImageAttachment extends FileAttachment {
  mimeType: `image/${"png" | "jpeg" | "gif" | "webp"}`;
}

// =============================================================================
// Request Types
// =============================================================================

/**
 * Base request interface
 */
export interface BaseAIRequest {
  /** System prompt/instructions */
  systemPrompt: string;
  /** Request options */
  options?: AIRequestOptions;
}

/**
 * Simple text generation request
 */
export interface TextGenerationRequest extends BaseAIRequest {
  type: "text";
  /** User prompt or message */
  prompt: string;
  /** PDF attachments (Gemini only for native support) */
  pdfAttachments?: PdfAttachment[];
  /** Image attachments (vision models) */
  imageAttachments?: ImageAttachment[];
}

/**
 * Conversation/chat request
 */
export interface ChatRequest extends BaseAIRequest {
  type: "chat";
  /** Conversation messages */
  messages: Conversation;
  /** PDF attachments (Gemini only for native support) */
  pdfAttachments?: PdfAttachment[];
  /** Image attachments (vision models) */
  imageAttachments?: ImageAttachment[];
}

/**
 * Structured output request (JSON with schema)
 */
export interface StructuredRequest extends BaseAIRequest {
  type: "structured";
  /** User prompt */
  prompt: string;
  /** JSON schema for the expected response */
  responseSchema: JsonSchema;
  /** PDF attachments (Gemini only) */
  pdfAttachments?: PdfAttachment[];
  /** Image attachments */
  imageAttachments?: ImageAttachment[];
}

/**
 * Union of all request types
 */
export type AIRequest = TextGenerationRequest | ChatRequest | StructuredRequest;

// =============================================================================
// Response Types
// =============================================================================

/**
 * Token usage statistics
 */
export interface TokenUsage {
  /** Tokens in the prompt */
  promptTokens?: number;
  /** Tokens in the response */
  completionTokens?: number;
  /** Total tokens used */
  totalTokens: number;
}

/**
 * Response metadata
 */
export interface ResponseMetadata {
  /** Provider that handled the request */
  provider: AIProvider;
  /** Model used */
  model: string;
  /** Request duration in milliseconds */
  durationMs: number;
  /** Whether request was retried */
  wasRetried: boolean;
  /** Number of attempts made */
  attemptCount: number;
  /** Request ID (if available from provider) */
  requestId?: string;
}

/**
 * Base response interface
 */
export interface BaseAIResponse {
  /** Token usage statistics */
  usage: TokenUsage;
  /** Response metadata */
  metadata: ResponseMetadata;
}

/**
 * Text generation response
 */
export interface TextResponse extends BaseAIResponse {
  /** Generated text */
  text: string;
}

/**
 * Structured output response
 */
export interface StructuredResponse<T = unknown> extends BaseAIResponse {
  /** Parsed data */
  data: T;
  /** Raw text before parsing */
  rawText: string;
}

/**
 * Streaming chunk
 */
export interface StreamChunk {
  /** Text content of this chunk */
  text: string;
  /** Whether this is the final chunk */
  done: boolean;
  /** Accumulated token count (if available) */
  tokenCount?: number;
}

/**
 * Streaming response
 */
export interface StreamResponse extends BaseAIResponse {
  /** Async iterator for streaming chunks */
  stream: AsyncIterable<StreamChunk>;
  /** Promise that resolves to the complete text */
  text: Promise<string>;
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * AI error categories
 */
export type AIErrorCategory =
  | "config"        // Configuration errors
  | "auth"          // Authentication/authorization errors
  | "rate_limit"    // Rate limiting errors
  | "timeout"       // Request timeout
  | "validation"    // Input validation errors
  | "content"       // Content policy violations
  | "server"        // Provider server errors
  | "network"       // Network connectivity issues
  | "unknown";      // Unknown errors

/**
 * AI error details
 */
export interface AIErrorDetails {
  /** Error category */
  category: AIErrorCategory;
  /** Error code (provider-specific or internal) */
  code: string;
  /** Human-readable message */
  message: string;
  /** Provider that generated the error */
  provider?: AIProvider;
  /** HTTP status code (if applicable) */
  statusCode?: number;
  /** Whether the error is retriable */
  retriable: boolean;
  /** Suggested retry delay in milliseconds */
  retryAfterMs?: number;
  /** Original error */
  cause?: Error;
  /** Additional context */
  context?: Record<string, unknown>;
}

// =============================================================================
// Callback Types
// =============================================================================

/**
 * Request lifecycle callbacks
 */
export interface AICallbacks {
  /** Called before making the request */
  onRequestStart?: (request: AIRequest, config: AIModelConfig) => void;
  /** Called when response is received */
  onRequestComplete?: (response: BaseAIResponse, request: AIRequest) => void;
  /** Called on error */
  onRequestError?: (error: AIErrorDetails, request: AIRequest) => void;
  /** Called on retry */
  onRetry?: (attempt: number, error: AIErrorDetails, request: AIRequest) => void;
  /** Called for each streaming chunk */
  onStreamChunk?: (chunk: StreamChunk) => void;
}

// =============================================================================
// Provider Adapter Interface
// =============================================================================

/**
 * Interface that all provider adapters must implement
 */
export interface AIProviderAdapter {
  /** Provider identifier */
  readonly provider: AIProvider;
  /** Provider capabilities */
  readonly capabilities: ProviderCapabilities;
  
  /**
   * Generate text response
   */
  generateText(
    request: TextGenerationRequest | ChatRequest,
    config: AIModelConfig,
    options?: AIRequestOptions
  ): Promise<TextResponse>;
  
  /**
   * Generate structured response
   */
  generateStructured<T>(
    request: StructuredRequest,
    config: AIModelConfig,
    options?: AIRequestOptions
  ): Promise<StructuredResponse<T>>;
  
  /**
   * Generate streaming response
   */
  generateStream(
    request: TextGenerationRequest | ChatRequest,
    config: AIModelConfig,
    options?: AIRequestOptions
  ): Promise<StreamResponse>;
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Feature keys for AI configuration
 */
export type AIFeatureKey =
  | "capsule_generation"
  | "tutor_chat"
  | "notes_generation"
  | "quiz_generation";

/**
 * Result type for operations that can fail
 */
export type AIResult<T> =
  | { success: true; data: T }
  | { success: false; error: AIErrorDetails };

/**
 * Async result type
 */
export type AsyncAIResult<T> = Promise<AIResult<T>>;
