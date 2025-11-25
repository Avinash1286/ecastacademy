/**
 * AI Client Types
 * 
 * Shared types for the unified AI client layer.
 */

import type { JsonSchema } from "../schemas/jsonSchema";

// =============================================================================
// Provider Types
// =============================================================================

/** Provider names matching database schema (aiModels table) */
export type AIProvider = "google" | "openai";

export interface AIModelConfig {
  provider: AIProvider;
  modelId: string;
  apiKey?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

// =============================================================================
// Request Types
// =============================================================================

export interface AIRequestOptions {
  /** Timeout in milliseconds (default: 60000) */
  timeoutMs?: number;
  
  /** Maximum retry attempts for transient errors */
  maxRetries?: number;
  
  /** Signal for request cancellation */
  signal?: AbortSignal;
}

export interface StructuredOutputRequest {
  /** System prompt */
  systemPrompt: string;
  
  /** User message text */
  userMessage: string;
  
  /** JSON schema for structured output */
  responseSchema?: JsonSchema;
  
  /** PDF attachment (for Gemini - sent directly, for OpenAI - see note) */
  pdfAttachment?: {
    base64: string;
    mimeType: string;
  };
  
  /** Image attachments */
  imageAttachments?: Array<{
    base64: string;
    mimeType: string;
  }>;
}

// =============================================================================
// Response Types
// =============================================================================

export interface AIResponse<T = unknown> {
  /** Parsed response data */
  data: T;
  
  /** Raw text response from AI */
  rawText: string;
  
  /** Usage statistics */
  usage: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens: number;
  };
  
  /** Request metadata */
  metadata: {
    provider: AIProvider;
    model: string;
    durationMs: number;
    wasRetried: boolean;
    attemptCount: number;
  };
}

// =============================================================================
// Error Types
// =============================================================================

export interface AIErrorResponse {
  provider: AIProvider;
  statusCode?: number;
  message: string;
  retriable: boolean;
  retryAfterMs?: number;
}

// =============================================================================
// Rate Limiting Types
// =============================================================================

export interface RateLimitConfig {
  provider: AIProvider;
  requestsPerMinute: number;
  tokensPerMinute: number;
}

export interface RateLimitResult {
  allowed: boolean;
  waitMs: number;
  currentUsage: {
    requests: number;
    tokens: number;
  };
}

// =============================================================================
// Callbacks
// =============================================================================

export interface AIClientCallbacks {
  /** Called before making request */
  onRequestStart?: (request: StructuredOutputRequest) => void;
  
  /** Called after receiving response */
  onRequestComplete?: (response: AIResponse) => void;
  
  /** Called on error */
  onRequestError?: (error: Error) => void;
  
  /** Called on retry */
  onRetry?: (attempt: number, error: Error) => void;
}
