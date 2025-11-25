/**
 * OpenAI Provider Adapter
 * 
 * Implements the AIProviderAdapter interface for OpenAI.
 * 
 * Features:
 * - Structured JSON output with response_format
 * - Streaming support
 * - Vision support (GPT-4o)
 * - Robust error handling
 * 
 * Note: OpenAI does not support native PDF input. PDFs must be
 * either pre-extracted to text or converted to images.
 */

import OpenAI from "openai";
import type {
  AIProviderAdapter,
  ProviderCapabilities,
  AIModelConfig,
  AIRequestOptions,
  TextGenerationRequest,
  ChatRequest,
  StructuredRequest,
  TextResponse,
  StructuredResponse,
  StreamResponse,
  StreamChunk,
} from "../types";
import {
  AIError,
  AIErrorCode,
  configError,
  authError,
  rateLimitError,
  timeoutError,
  contentPolicyError,
  serverError,
  jsonParseError,
  fromUnknown,
} from "../errors";

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_TIMEOUT_MS = 90_000; // 90 seconds
const DEFAULT_MAX_TOKENS = 4096;

const OPENAI_CAPABILITIES: ProviderCapabilities = {
  streaming: true,
  structuredOutput: true,
  nativePdf: false, // OpenAI does not support PDF directly
  vision: true, // GPT-4o supports vision
  functionCalling: true,
  maxContextTokens: 128_000, // GPT-4o
  maxOutputTokens: 16384,
};

// =============================================================================
// Error Handling
// =============================================================================

function handleOpenAIError(
  error: unknown,
  config: AIModelConfig,
  durationMs: number
): AIError {
  const context = {
    provider: "openai" as const,
    model: config.modelId,
    durationMs,
  };
  
  if (error instanceof AIError) {
    return (error as AIError).withContext(context);
  }
  
  if (error instanceof OpenAI.APIError) {
    const status = error.status;
    const message = error.message;
    
    if (status === 429) {
      // Extract retry-after if available
      const retryAfter = error.headers?.["retry-after"];
      const retryMs = retryAfter ? parseInt(retryAfter) * 1000 : 60000;
      return rateLimitError("openai", retryMs, context);
    }
    
    if (status === 401 || status === 403) {
      return authError("openai", message, status);
    }
    
    if (status === 400 && message.includes("content_policy")) {
      return contentPolicyError("openai", message, context);
    }
    
    if (status && status >= 500) {
      return serverError("openai", status, message, context);
    }
  }
  
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes("timeout") || message.includes("timed out")) {
      return timeoutError("openai", DEFAULT_TIMEOUT_MS, context);
    }
    
    if (message.includes("rate limit") || message.includes("429")) {
      return rateLimitError("openai", 60000, context);
    }
  }
  
  return fromUnknown(error, context);
}

// =============================================================================
// OpenAI Adapter Class
// =============================================================================

export class OpenAIAdapter implements AIProviderAdapter {
  readonly provider = "openai" as const;
  readonly capabilities = OPENAI_CAPABILITIES;
  
  private clientCache = new Map<string, OpenAI>();
  
  /**
   * Get or create a client for the given API key
   */
  private getClient(apiKey: string): OpenAI {
    if (!this.clientCache.has(apiKey)) {
      this.clientCache.set(apiKey, new OpenAI({
        apiKey,
        timeout: DEFAULT_TIMEOUT_MS,
      }));
    }
    return this.clientCache.get(apiKey)!;
  }
  
  /**
   * Get the API key from config or environment
   */
  private getApiKey(config: AIModelConfig): string {
    const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw configError(
        AIErrorCode.MISSING_API_KEY,
        "Missing OPENAI_API_KEY environment variable or apiKey in config",
        { provider: "openai" }
      );
    }
    return apiKey;
  }
  
  /**
   * Build chat messages from request
   */
  private buildMessages(
    request: TextGenerationRequest | ChatRequest | StructuredRequest
  ): OpenAI.Chat.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: request.systemPrompt },
    ];
    
    if (request.type === "chat") {
      // Add conversation history
      for (const msg of request.messages) {
        if (msg.role === "system") continue; // Already added
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
      
      // Handle attachments in the last user message
      if (request.imageAttachments && request.imageAttachments.length > 0) {
        const lastUserIndex = messages.length - 1;
        const lastMsg = messages[lastUserIndex];
        
        if (lastMsg.role === "user" && typeof lastMsg.content === "string") {
          const content: OpenAI.Chat.ChatCompletionContentPart[] = [
            { type: "text", text: lastMsg.content },
          ];
          
          for (const img of request.imageAttachments) {
            content.push({
              type: "image_url",
              image_url: {
                url: `data:${img.mimeType};base64,${img.base64}`,
              },
            });
          }
          
          messages[lastUserIndex] = { role: "user", content };
        }
      }
    } else {
      // Text or structured request
      const prompt = "prompt" in request ? request.prompt : "";
      
      if (request.imageAttachments && request.imageAttachments.length > 0) {
        const content: OpenAI.Chat.ChatCompletionContentPart[] = [
          { type: "text", text: prompt },
        ];
        
        for (const img of request.imageAttachments) {
          content.push({
            type: "image_url",
            image_url: {
              url: `data:${img.mimeType};base64,${img.base64}`,
            },
          });
        }
        
        messages.push({ role: "user", content });
      } else {
        messages.push({ role: "user", content: prompt });
      }
    }
    
    // Handle PDF - OpenAI doesn't support native PDF
    // Add a note if PDF was attached
    if ("pdfAttachments" in request && request.pdfAttachments && request.pdfAttachments.length > 0) {
      console.warn(
        "[OpenAI Adapter] PDF attachments are not natively supported. " +
        "Consider using Google/Gemini for PDF processing or pre-extracting text."
      );
    }
    
    return messages;
  }
  
  /**
   * Execute request with timeout handling
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    config: AIModelConfig,
    signal?: AbortSignal
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    if (signal) {
      signal.addEventListener("abort", () => controller.abort());
    }
    
    try {
      const result = await promise;
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (controller.signal.aborted) {
        throw timeoutError("openai", timeoutMs, {
          model: config.modelId,
        });
      }
      
      throw error;
    }
  }
  
  /**
   * Generate text response
   */
  async generateText(
    request: TextGenerationRequest | ChatRequest,
    config: AIModelConfig,
    options?: AIRequestOptions
  ): Promise<TextResponse> {
    const startTime = Date.now();
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    
    try {
      const apiKey = this.getApiKey(config);
      const client = this.getClient(apiKey);
      
      const messages = this.buildMessages(request);
      
      const response = await this.withTimeout(
        client.chat.completions.create({
          model: config.modelId || "gpt-4o",
          messages,
          temperature: config.temperature ?? 0.7,
          max_tokens: config.maxOutputTokens ?? DEFAULT_MAX_TOKENS,
        }),
        timeoutMs,
        config,
        options?.signal
      );
      
      const choice = response.choices[0];
      const text = choice?.message?.content || "";
      const usage = response.usage;
      
      const durationMs = Date.now() - startTime;
      
      return {
        text,
        usage: {
          promptTokens: usage?.prompt_tokens,
          completionTokens: usage?.completion_tokens,
          totalTokens: usage?.total_tokens ?? 0,
        },
        metadata: {
          provider: "openai",
          model: config.modelId,
          durationMs,
          wasRetried: false,
          attemptCount: 1,
          requestId: response.id,
        },
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      throw handleOpenAIError(error, config, durationMs);
    }
  }
  
  /**
   * Generate structured JSON response
   */
  async generateStructured<T>(
    request: StructuredRequest,
    config: AIModelConfig,
    options?: AIRequestOptions
  ): Promise<StructuredResponse<T>> {
    const startTime = Date.now();
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    
    try {
      const apiKey = this.getApiKey(config);
      const client = this.getClient(apiKey);
      
      const messages = this.buildMessages(request);
      
      // Use response_format for structured output
      const response = await this.withTimeout(
        client.chat.completions.create({
          model: config.modelId || "gpt-4o",
          messages,
          temperature: config.temperature ?? 0.7,
          max_tokens: config.maxOutputTokens ?? DEFAULT_MAX_TOKENS,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "response",
              strict: true,
              schema: request.responseSchema as unknown as Record<string, unknown>,
            },
          },
        }),
        timeoutMs,
        config,
        options?.signal
      );
      
      const choice = response.choices[0];
      const rawText = choice?.message?.content || "{}";
      const usage = response.usage;
      
      // Parse JSON
      let data: T;
      try {
        data = JSON.parse(rawText) as T;
      } catch (parseError) {
        throw jsonParseError(rawText, parseError as Error);
      }
      
      const durationMs = Date.now() - startTime;
      
      return {
        data,
        rawText,
        usage: {
          promptTokens: usage?.prompt_tokens,
          completionTokens: usage?.completion_tokens,
          totalTokens: usage?.total_tokens ?? 0,
        },
        metadata: {
          provider: "openai",
          model: config.modelId,
          durationMs,
          wasRetried: false,
          attemptCount: 1,
          requestId: response.id,
        },
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      throw handleOpenAIError(error, config, durationMs);
    }
  }
  
  /**
   * Generate streaming response
   * @param _options - Request options (reserved for future use)
   */
  async generateStream(
    request: TextGenerationRequest | ChatRequest,
    config: AIModelConfig,
    // Reserved for future timeout/cancellation support in streaming
    _options?: AIRequestOptions
  ): Promise<StreamResponse> {
    void _options; // Acknowledge parameter
    const startTime = Date.now();
    
    try {
      const apiKey = this.getApiKey(config);
      const client = this.getClient(apiKey);
      
      const messages = this.buildMessages(request);
      
      const stream = await client.chat.completions.create({
        model: config.modelId || "gpt-4o",
        messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxOutputTokens ?? DEFAULT_MAX_TOKENS,
        stream: true,
        stream_options: { include_usage: true },
      });
      
      let fullText = "";
      let totalTokens = 0;
      
      // Create async iterator
      const createStream = async function* (): AsyncIterable<StreamChunk> {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content || "";
          fullText += delta;
          
          if (chunk.usage?.total_tokens) {
            totalTokens = chunk.usage.total_tokens;
          }
          
          yield {
            text: delta,
            done: chunk.choices[0]?.finish_reason === "stop",
            tokenCount: totalTokens,
          };
        }
      };
      
      const streamIterator = createStream();
      
      // Create text promise
      const textPromise = (async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _chunk of streamIterator) {
          // Consume
        }
        return fullText;
      })();
      
      const durationMs = Date.now() - startTime;
      
      return {
        stream: createStream(),
        text: textPromise,
        usage: {
          totalTokens: 0,
        },
        metadata: {
          provider: "openai",
          model: config.modelId,
          durationMs,
          wasRetried: false,
          attemptCount: 1,
        },
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      throw handleOpenAIError(error, config, durationMs);
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

let openaiAdapterInstance: OpenAIAdapter | null = null;

/**
 * Get the singleton OpenAI adapter instance
 */
export function getOpenAIAdapter(): OpenAIAdapter {
  if (!openaiAdapterInstance) {
    openaiAdapterInstance = new OpenAIAdapter();
  }
  return openaiAdapterInstance;
}
