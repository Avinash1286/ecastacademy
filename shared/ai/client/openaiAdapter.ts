/**
 * OpenAI Adapter
 * 
 * Implementation for OpenAI API with:
 * - Structured output with JSON schema (response_format)
 * - Image support for GPT-4o
 * - Timeout handling
 * 
 * NOTE: OpenAI Chat Completions API does not natively support PDF files.
 * For PDF content, you need to either:
 * 1. Extract text from PDF before sending (done externally)
 * 2. Use the Assistants API with file upload (not implemented here)
 * 3. Convert PDF pages to images and use vision (for GPT-4o)
 * 
 * This adapter expects PDF content to be pre-extracted as text.
 */

import OpenAI from "openai";
import type { 
  AIModelConfig, 
  StructuredOutputRequest, 
  AIResponse,
  AIRequestOptions,
} from "./types";
import { 
  CapsuleError, 
  ErrorCode, 
  timeoutError, 
  rateLimitError,
  apiError,
} from "../errors";
import { extractJson } from "../response";
import type { JsonSchema } from "../schemas/jsonSchema";

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_TIMEOUT_MS = 90_000; // 90 seconds
const DEFAULT_MAX_TOKENS = 4096;

// =============================================================================
// OpenAI Client
// =============================================================================

export class OpenAIAdapter {
  private client: OpenAI;
  private config: AIModelConfig;
  
  constructor(config: AIModelConfig) {
    const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new CapsuleError(
        ErrorCode.CONFIG_ERROR,
        "Missing OPENAI_API_KEY",
        { provider: "openai" }
      );
    }
    
    if (!config.modelId) {
      throw new CapsuleError(
        ErrorCode.CONFIG_ERROR,
        "Model ID is required. Please configure the AI model in the admin panel.",
        { provider: "openai" }
      );
    }
    
    this.config = config;
    this.client = new OpenAI({ 
      apiKey,
      timeout: DEFAULT_TIMEOUT_MS,
    });
  }
  
  /**
   * Make a structured output request to OpenAI
   */
  async generateStructured<T>(
    request: StructuredOutputRequest,
    options: AIRequestOptions = {}
  ): Promise<AIResponse<T>> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const startTime = Date.now();
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    // Merge with external signal if provided
    if (options.signal) {
      options.signal.addEventListener("abort", () => controller.abort());
    }
    
    try {
      // Build messages
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: request.systemPrompt },
      ];
      
      // Build user content
      const userContent: Array<OpenAI.Chat.ChatCompletionContentPart> = [];
      
      // Add text message
      userContent.push({ type: "text", text: request.userMessage });
      
      // Handle PDF - OpenAI doesn't support direct PDF, so we need to handle differently
      if (request.pdfAttachment) {
        // Option 1: For models that support vision, convert PDF info to text prompt
        // The actual PDF text should be extracted before calling this adapter
        // or passed as part of userMessage
        console.warn(
          "OpenAI does not support direct PDF upload in Chat Completions. " +
          "PDF content should be extracted as text and included in userMessage."
        );
        
        // If using a vision model and PDF was converted to images, handle here
        // For now, we skip PDF attachment for OpenAI
      }
      
      // Add image attachments (for GPT-4o and similar vision models)
      if (request.imageAttachments && this.supportsVision()) {
        for (const image of request.imageAttachments) {
          userContent.push({
            type: "image_url",
            image_url: {
              url: `data:${image.mimeType};base64,${image.base64}`,
              detail: "auto",
            },
          });
        }
      }
      
      messages.push({ role: "user", content: userContent });
      
      // Build request params
      const params: OpenAI.Chat.ChatCompletionCreateParams = {
        model: this.config.modelId || "gpt-4o",
        messages,
        temperature: this.config.temperature ?? 0.7,
        max_tokens: this.config.maxOutputTokens ?? DEFAULT_MAX_TOKENS,
      };
      
      // Add response format for structured output
      if (request.responseSchema) {
        params.response_format = {
          type: "json_schema",
          json_schema: {
            name: "response",
            strict: true,
            schema: this.convertSchemaForOpenAI(request.responseSchema),
          },
        };
      } else {
        params.response_format = { type: "json_object" };
      }
      
      // Make request
      const completion = await this.client.chat.completions.create(params, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // Extract response
      const choice = completion.choices[0];
      const rawText = choice?.message?.content || "";
      const usage = completion.usage;
      
      // Parse JSON response
      const extraction = await extractJson<T>(rawText, {
        stage: "openai_response",
      });
      
      if (!extraction.success) {
        throw extraction.error;
      }
      
      const durationMs = Date.now() - startTime;
      
      return {
        data: extraction.data,
        rawText,
        usage: {
          promptTokens: usage?.prompt_tokens,
          completionTokens: usage?.completion_tokens,
          totalTokens: usage?.total_tokens ?? 0,
        },
        metadata: {
          provider: "openai",
          model: this.config.modelId,
          durationMs,
          wasRetried: false,
          attemptCount: 1,
        },
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (controller.signal.aborted) {
        throw timeoutError(timeoutMs, {
          provider: "openai",
          model: this.config.modelId,
          durationMs: Date.now() - startTime,
        });
      }
      
      throw this.handleError(error, startTime);
    }
  }
  
  /**
   * Check if the model supports vision
   */
  private supportsVision(): boolean {
    const model = this.config.modelId.toLowerCase();
    return model.includes("gpt-4o") || 
           model.includes("gpt-4-vision") || 
           model.includes("gpt-4-turbo");
  }
  
  /**
   * Convert JSON schema to OpenAI's format
   */
  private convertSchemaForOpenAI(schema: JsonSchema): Record<string, unknown> {
    // OpenAI uses standard JSON Schema with some restrictions
    // Need to ensure additionalProperties: false for strict mode
    return this.addStrictProperties(this.normalizeSchemaTypes(schema)) as Record<string, unknown>;
  }
  
  private normalizeSchemaTypes(node: object): object {
    const result: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(node)) {
      if (key === "type") {
        // Convert SchemaType enum to lowercase strings
        result.type = String(value).toLowerCase();
      } else if (typeof value === "object" && value !== null) {
        if (Array.isArray(value)) {
          result[key] = value.map(item => 
            typeof item === "object" && item !== null 
              ? this.normalizeSchemaTypes(item) 
              : item
          );
        } else {
          result[key] = this.normalizeSchemaTypes(value);
        }
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }
  
  private addStrictProperties(node: object): object {
    const result: Record<string, unknown> = { ...node };
    
    // Add additionalProperties: false to objects for strict mode
    if (result.type === "object") {
      result.additionalProperties = false;
    }
    
    // Recurse into properties
    if (result.properties && typeof result.properties === "object") {
      const newProps: Record<string, object> = {};
      for (const [key, value] of Object.entries(result.properties)) {
        if (typeof value === "object" && value !== null) {
          newProps[key] = this.addStrictProperties(value);
        }
      }
      result.properties = newProps;
    }
    
    // Recurse into items
    if (result.items && typeof result.items === "object") {
      result.items = this.addStrictProperties(result.items);
    }
    
    return result;
  }
  
  /**
   * Convert API errors to CapsuleError
   */
  private handleError(error: unknown, startTime: number): CapsuleError {
    const durationMs = Date.now() - startTime;
    const context = {
      provider: "openai" as const,
      model: this.config.modelId,
      durationMs,
    };
    
    if (error instanceof CapsuleError) {
      return new CapsuleError(
        error.code,
        error.message,
        { ...error.context, ...context },
        error.cause
      );
    }
    
    // Handle OpenAI specific errors
    if (error instanceof OpenAI.APIError) {
      const status = error.status;
      const message = error.message;
      
      if (status === 429) {
        // Extract retry-after if available
        const retryAfter = error.headers?.["retry-after"];
        const retryMs = retryAfter ? parseInt(retryAfter) * 1000 : undefined;
        return rateLimitError({ ...context, statusCode: status }, retryMs);
      }
      
      if (status === 401 || status === 403) {
        return new CapsuleError(
          ErrorCode.AUTH_ERROR,
          message,
          { ...context, statusCode: status },
          error
        );
      }
      
      if (status === 400) {
        // Check for content policy violations
        if (message.includes("content_policy") || message.includes("flagged")) {
          return new CapsuleError(
            ErrorCode.CONTENT_POLICY,
            message,
            { ...context, statusCode: status },
            error
          );
        }
        return new CapsuleError(
          ErrorCode.INVALID_INPUT,
          message,
          { ...context, statusCode: status },
          error
        );
      }
      
      if (status && status >= 500) {
        return apiError(status, message, context);
      }
      
      return new CapsuleError(
        ErrorCode.API_ERROR,
        message,
        { ...context, statusCode: status },
        error
      );
    }
    
    if (error instanceof Error) {
      return new CapsuleError(
        ErrorCode.UNKNOWN,
        error.message,
        context,
        error
      );
    }
    
    return new CapsuleError(
      ErrorCode.UNKNOWN,
      String(error),
      context
    );
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createOpenAIAdapter(config: AIModelConfig): OpenAIAdapter {
  return new OpenAIAdapter(config);
}
