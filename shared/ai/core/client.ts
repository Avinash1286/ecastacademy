/**
 * Unified AI Client
 * 
 * The main entry point for all AI operations in the application.
 * Provides a consistent interface for text generation, structured output,
 * and streaming across all providers.
 * 
 * Features:
 * - Provider abstraction
 * - Automatic retry with exponential backoff
 * - Rate limiting integration
 * - Request/response logging
 * - Callback hooks for observability
 * 
 * Usage:
 * ```typescript
 * import { ai } from "@shared/ai/core";
 * 
 * // Text generation
 * const response = await ai.generateText({
 *   provider: "google",
 *   modelId: "gemini-1.5-pro",
 *   systemPrompt: "You are a helpful assistant",
 *   prompt: "Hello!",
 * });
 * 
 * // Structured output
 * const data = await ai.generateStructured<MyType>({
 *   provider: "google",
 *   modelId: "gemini-1.5-flash",
 *   systemPrompt: "Generate a course outline",
 *   prompt: "Create an outline for a Python course",
 *   responseSchema: mySchema,
 * });
 * 
 * // Streaming
 * const stream = await ai.generateStream({
 *   provider: "openai",
 *   modelId: "gpt-4o",
 *   systemPrompt: "You are a tutor",
 *   messages: conversation,
 * });
 * for await (const chunk of stream.stream) {
 *   console.log(chunk.text);
 * }
 * ```
 */

import type {
  AIProvider,
  AIModelConfig,
  AIRequestOptions,
  AICallbacks,
  TextGenerationRequest,
  ChatRequest,
  StructuredRequest,
  TextResponse,
  StructuredResponse,
  StreamResponse,
  Message,
  PdfAttachment,
  ImageAttachment,
} from "./types";
import { getProviderAdapter, selectBestProvider } from "./registry";
import {
  AIError,
  fromUnknown,
  isRetriable,
  getRetryDelay,
} from "./errors";
import type { JsonSchema } from "../schemas/jsonSchema";

// =============================================================================
// Request Builder Types
// =============================================================================

interface BaseRequestConfig {
  /** Provider to use */
  provider?: AIProvider;
  /** Model ID (uses provider default if not specified) */
  modelId?: string;
  /** API key (uses environment variable if not specified) */
  apiKey?: string;
  /** Temperature for randomness (0-1) */
  temperature?: number;
  /** Maximum output tokens */
  maxOutputTokens?: number;
  /** System prompt */
  systemPrompt: string;
  /** Request options */
  options?: AIRequestOptions;
}

interface TextRequestConfig extends BaseRequestConfig {
  /** User prompt */
  prompt: string;
  /** PDF attachments (Gemini only) */
  pdfAttachments?: PdfAttachment[];
  /** Image attachments */
  imageAttachments?: ImageAttachment[];
}

interface ChatRequestConfig extends BaseRequestConfig {
  /** Conversation messages */
  messages: Message[];
  /** PDF attachments (Gemini only) */
  pdfAttachments?: PdfAttachment[];
  /** Image attachments */
  imageAttachments?: ImageAttachment[];
}

interface StructuredRequestConfig extends BaseRequestConfig {
  /** User prompt */
  prompt: string;
  /** JSON schema for response */
  responseSchema: JsonSchema;
  /** PDF attachments (Gemini only) */
  pdfAttachments?: PdfAttachment[];
  /** Image attachments */
  imageAttachments?: ImageAttachment[];
}

// =============================================================================
// Unified AI Client Class
// =============================================================================

class UnifiedAIClient {
  private callbacks: AICallbacks = {};
  private defaultProvider: AIProvider = "google";
  private defaultOptions: AIRequestOptions = {
    timeoutMs: 120_000,
    maxRetries: 2,
  };
  
  /**
   * Set global callbacks for observability
   */
  setCallbacks(callbacks: AICallbacks): void {
    this.callbacks = callbacks;
  }
  
  /**
   * Set default provider
   */
  setDefaultProvider(provider: AIProvider): void {
    this.defaultProvider = provider;
  }
  
  /**
   * Set default request options
   */
  setDefaultOptions(options: Partial<AIRequestOptions>): void {
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }
  
  /**
   * Build model config from request
   */
  private buildModelConfig(config: BaseRequestConfig): AIModelConfig {
    const provider = config.provider || this.defaultProvider;
    return {
      provider,
      modelId: config.modelId || this.getDefaultModel(provider),
      apiKey: config.apiKey,
      temperature: config.temperature,
      maxOutputTokens: config.maxOutputTokens,
    };
  }
  
  /**
   * Get default model for provider
   */
  private getDefaultModel(provider: AIProvider): string {
    switch (provider) {
      case "google":
        return "gemini-1.5-flash";
      case "openai":
        return "gpt-4o";
      default:
        return "gemini-1.5-flash";
    }
  }
  
  /**
   * Merge request options with defaults
   */
  private mergeOptions(options?: AIRequestOptions): AIRequestOptions {
    return { ...this.defaultOptions, ...options };
  }
  
  /**
   * Execute with retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    request: TextGenerationRequest | ChatRequest | StructuredRequest,
    modelConfig: AIModelConfig,
    options: AIRequestOptions
  ): Promise<T> {
    const maxRetries = options.maxRetries ?? 2;
    let lastError: AIError | null = null;
    
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        // Notify start
        if (attempt === 1) {
          this.callbacks.onRequestStart?.(request, modelConfig);
        }
        
        const result = await operation();
        
        // Notify complete
        if (isTextResponse(result) || isStructuredResponse(result) || isStreamResponse(result)) {
          this.callbacks.onRequestComplete?.(result, request);
        }
        
        return result;
      } catch (error) {
        const aiError = error instanceof AIError
          ? error
          : fromUnknown(error, { attempt });
        
        lastError = aiError;
        
        // Notify error
        this.callbacks.onRequestError?.(aiError.toDetails(), request);
        
        // Check if should retry
        if (!isRetriable(aiError) || attempt > maxRetries) {
          throw aiError;
        }
        
        // Calculate delay
        const delayMs = getRetryDelay(aiError, attempt);
        
        // Notify retry
        this.callbacks.onRetry?.(attempt, aiError.toDetails(), request);
        
        // Wait before retry
        await sleep(delayMs);
      }
    }
    
    throw lastError || new AIError({
      category: "unknown",
      code: "UNKNOWN",
      message: "Unexpected error in retry loop",
      retriable: false,
    });
  }
  
  /**
   * Generate text response
   */
  async generateText(config: TextRequestConfig): Promise<TextResponse> {
    const modelConfig = this.buildModelConfig(config);
    const options = this.mergeOptions(config.options);
    const adapter = getProviderAdapter(modelConfig.provider);
    
    const request: TextGenerationRequest = {
      type: "text",
      systemPrompt: config.systemPrompt,
      prompt: config.prompt,
      pdfAttachments: config.pdfAttachments,
      imageAttachments: config.imageAttachments,
    };
    
    return this.executeWithRetry(
      () => adapter.generateText(request, modelConfig, options),
      request,
      modelConfig,
      options
    );
  }
  
  /**
   * Generate chat response
   */
  async generateChat(config: ChatRequestConfig): Promise<TextResponse> {
    const modelConfig = this.buildModelConfig(config);
    const options = this.mergeOptions(config.options);
    const adapter = getProviderAdapter(modelConfig.provider);
    
    const request: ChatRequest = {
      type: "chat",
      systemPrompt: config.systemPrompt,
      messages: config.messages,
      pdfAttachments: config.pdfAttachments,
      imageAttachments: config.imageAttachments,
    };
    
    return this.executeWithRetry(
      () => adapter.generateText(request, modelConfig, options),
      request,
      modelConfig,
      options
    );
  }
  
  /**
   * Generate structured JSON response
   */
  async generateStructured<T>(config: StructuredRequestConfig): Promise<StructuredResponse<T>> {
    const modelConfig = this.buildModelConfig(config);
    const options = this.mergeOptions(config.options);
    const adapter = getProviderAdapter(modelConfig.provider);
    
    const request: StructuredRequest = {
      type: "structured",
      systemPrompt: config.systemPrompt,
      prompt: config.prompt,
      responseSchema: config.responseSchema,
      pdfAttachments: config.pdfAttachments,
      imageAttachments: config.imageAttachments,
    };
    
    return this.executeWithRetry(
      () => adapter.generateStructured<T>(request, modelConfig, options),
      request,
      modelConfig,
      options
    );
  }
  
  /**
   * Generate streaming response
   */
  async generateStream(config: TextRequestConfig | ChatRequestConfig): Promise<StreamResponse> {
    const modelConfig = this.buildModelConfig(config);
    const options = this.mergeOptions(config.options);
    const adapter = getProviderAdapter(modelConfig.provider);
    
    const request: TextGenerationRequest | ChatRequest = "messages" in config
      ? {
          type: "chat" as const,
          systemPrompt: config.systemPrompt,
          messages: config.messages,
          pdfAttachments: config.pdfAttachments,
          imageAttachments: config.imageAttachments,
        }
      : {
          type: "text" as const,
          systemPrompt: config.systemPrompt,
          prompt: (config as TextRequestConfig).prompt,
          pdfAttachments: config.pdfAttachments,
          imageAttachments: config.imageAttachments,
        };
    
    // No retry for streaming - return directly
    this.callbacks.onRequestStart?.(request, modelConfig);
    
    try {
      const response = await adapter.generateStream(request, modelConfig, options);
      this.callbacks.onRequestComplete?.(response, request);
      return response;
    } catch (error) {
      const aiError = error instanceof AIError ? error : fromUnknown(error);
      this.callbacks.onRequestError?.(aiError.toDetails(), request);
      throw aiError;
    }
  }
  
  /**
   * Select the best provider for given requirements
   */
  selectProvider(requirements: {
    needsPdf?: boolean;
    needsStreaming?: boolean;
    needsStructured?: boolean;
    needsVision?: boolean;
    preferFast?: boolean;
  }): AIProvider {
    return selectBestProvider(requirements);
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isTextResponse(value: unknown): value is TextResponse {
  return typeof value === "object" && value !== null && "text" in value && "metadata" in value;
}

function isStructuredResponse(value: unknown): value is StructuredResponse {
  return typeof value === "object" && value !== null && "data" in value && "rawText" in value;
}

function isStreamResponse(value: unknown): value is StreamResponse {
  return typeof value === "object" && value !== null && "stream" in value;
}

// =============================================================================
// Singleton Instance
// =============================================================================

/**
 * Global AI client instance
 * 
 * Usage:
 * ```typescript
 * import { ai } from "@shared/ai/core";
 * const response = await ai.generateText({ ... });
 * ```
 */
export const ai = new UnifiedAIClient();

// =============================================================================
// Legacy Compatibility
// =============================================================================

/**
 * Get an AI client for the Vercel AI SDK
 * 
 * This provides backward compatibility with the old centralized.ts API.
 * Use `ai.generateText()` or `ai.generateStream()` for new code.
 * 
 * @deprecated Use the unified `ai` client instead
 */
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

interface LegacyModelConfig {
  provider: "google" | "openai";
  modelId: string;
  apiKey?: string;
}

export function getAIClient(config: LegacyModelConfig): LanguageModel {
  if (config.provider === "google") {
    const google = createGoogleGenerativeAI({
      apiKey: config.apiKey ?? process.env.GEMINI_API_KEY,
    });
    return google(config.modelId);
  }
  
  if (config.provider === "openai") {
    const openai = createOpenAI({
      apiKey: config.apiKey ?? process.env.OPENAI_API_KEY,
    });
    return openai(config.modelId);
  }
  
  throw new Error(`Unsupported AI provider: ${config.provider}`);
}

// Export the class for testing
export { UnifiedAIClient };
