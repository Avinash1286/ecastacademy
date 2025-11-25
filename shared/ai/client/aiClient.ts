/**
 * Unified AI Client
 * 
 * Factory and utilities for creating AI clients with:
 * - Provider abstraction
 * - Automatic retry with exponential backoff
 * - Timeout handling
 * - Error classification
 */

import { GeminiAdapter, createGeminiAdapter } from "./geminiAdapter";
import { OpenAIAdapter, createOpenAIAdapter } from "./openaiAdapter";
import type { 
  AIModelConfig, 
  StructuredOutputRequest, 
  AIResponse,
  AIRequestOptions,
  AIProvider,
} from "./types";
import { 
  CapsuleError, 
  ErrorCode,
  isRetriable,
  getRetryDelay,
  fromUnknown,
} from "../errors";

// =============================================================================
// Unified Client Interface
// =============================================================================

export interface AIClient {
  generateStructured<T>(
    request: StructuredOutputRequest,
    options?: AIRequestOptions
  ): Promise<AIResponse<T>>;
}

// =============================================================================
// Client Factory
// =============================================================================

export function createAIClient(config: AIModelConfig): AIClient {
  switch (config.provider) {
    case "google":
      // "google" provider uses Google Generative AI (Gemini)
      return createGeminiAdapter(config);
    case "openai":
      return createOpenAIAdapter(config);
    default:
      throw new CapsuleError(
        ErrorCode.CONFIG_ERROR,
        `Unknown AI provider: ${config.provider}. Supported: 'google', 'openai'`,
        { provider: config.provider }
      );
  }
}

// =============================================================================
// Retry Wrapper
// =============================================================================

export interface RetryOptions {
  maxRetries?: number;
  onRetry?: (attempt: number, error: CapsuleError, delayMs: number) => void;
}

/**
 * Execute an AI request with automatic retry for transient errors
 */
export async function executeWithRetry<T>(
  client: AIClient,
  request: StructuredOutputRequest,
  options: AIRequestOptions & RetryOptions = {}
): Promise<AIResponse<T>> {
  const maxRetries = options.maxRetries ?? 3;
  let lastError: CapsuleError | null = null;
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const response = await client.generateStructured<T>(request, options);
      
      // Update metadata if retried
      if (attempt > 1) {
        response.metadata.wasRetried = true;
        response.metadata.attemptCount = attempt;
      }
      
      return response;
    } catch (error) {
      const capsuleError = error instanceof CapsuleError 
        ? error 
        : fromUnknown(error, { attempt });
      
      lastError = capsuleError;
      
      // Check if we should retry
      if (!isRetriable(capsuleError.code) || attempt > maxRetries) {
        throw capsuleError;
      }
      
      // Calculate delay
      const delayMs = getRetryDelay(capsuleError.code, attempt);
      
      // Notify callback
      options.onRetry?.(attempt, capsuleError, delayMs);
      
      // Wait before retry
      await sleep(delayMs);
    }
  }
  
  // Should never reach here, but TypeScript needs it
  throw lastError ?? new CapsuleError(ErrorCode.UNKNOWN, "Unexpected retry loop exit");
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Create a Gemini client with common defaults
 */
export function createGeminiClient(
  modelId: string = "gemini-1.5-flash",
  apiKey?: string
): GeminiAdapter {
  return createGeminiAdapter({
    provider: "google",
    modelId,
    apiKey,
    temperature: 0.7,
    maxOutputTokens: 8192,
  });
}

/**
 * Create an OpenAI client with common defaults
 */
export function createOpenAIClient(
  modelId: string = "gpt-4o",
  apiKey?: string
): OpenAIAdapter {
  return createOpenAIAdapter({
    provider: "openai",
    modelId,
    apiKey,
    temperature: 0.7,
    maxOutputTokens: 4096,
  });
}

/**
 * Get the recommended provider for a given task
 */
export function getRecommendedProvider(options: {
  hasPdf?: boolean;
  needsVision?: boolean;
  preferFast?: boolean;
}): AIProvider {
  // Google (Gemini) is preferred for PDF processing (native support)
  if (options.hasPdf) {
    return "google";
  }
  
  // Both support vision, but Gemini is generally faster
  if (options.needsVision && options.preferFast) {
    return "google";
  }
  
  // Default to Google (Gemini) for speed
  if (options.preferFast) {
    return "google";
  }
  
  // Default
  return "google";
}

// =============================================================================
// Utilities
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if a model ID supports structured output
 */
export function supportsStructuredOutput(provider: AIProvider, modelId: string): boolean {
  if (provider === "google") {
    // All Gemini 1.5+ models support structured output
    return modelId.includes("gemini-1.5") || modelId.includes("gemini-2");
  }
  
  if (provider === "openai") {
    // GPT-4o and newer support JSON schema
    return modelId.includes("gpt-4o") || 
           modelId.includes("gpt-4-turbo") ||
           modelId.includes("gpt-4-0125");
  }
  
  return false;
}

/**
 * Check if a model supports PDF input
 */
export function supportsPdfInput(provider: AIProvider, modelId: string): boolean {
  if (provider === "google") {
    // Gemini 1.5+ supports PDF natively
    return modelId.includes("gemini-1.5") || modelId.includes("gemini-2");
  }
  
  // OpenAI doesn't support PDF in Chat Completions
  return false;
}
