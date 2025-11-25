/**
 * Gemini Adapter
 * 
 * Implementation for Google Gemini API with:
 * - Direct PDF support (multimodal)
 * - Structured output with JSON schema
 * - Timeout handling
 */

import { 
  GoogleGenerativeAI, 
  GenerativeModel,
  SchemaType,
  type GenerationConfig,
} from "@google/generative-ai";

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

const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes for large PDFs
const DEFAULT_MAX_TOKENS = 8192;

// =============================================================================
// Gemini Client
// =============================================================================

export class GeminiAdapter {
  private client: GoogleGenerativeAI;
  private model: GenerativeModel;
  private config: AIModelConfig;
  
  constructor(config: AIModelConfig) {
    const apiKey = config.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new CapsuleError(
        ErrorCode.CONFIG_ERROR,
        "Missing GEMINI_API_KEY",
        { provider: "google" }
      );
    }
    
    this.config = config;
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = this.client.getGenerativeModel({
      model: config.modelId || "gemini-1.5-flash",
    });
  }
  
  /**
   * Make a structured output request to Gemini
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
      // Build generation config
      const generationConfig: GenerationConfig = {
        temperature: this.config.temperature ?? 0.7,
        maxOutputTokens: this.config.maxOutputTokens ?? DEFAULT_MAX_TOKENS,
      };
      
      // Add response schema if provided
      if (request.responseSchema) {
        generationConfig.responseMimeType = "application/json";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        generationConfig.responseSchema = this.convertSchema(request.responseSchema) as any;
      }
      
      // Build content parts
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
      
      // Add text message
      parts.push({ text: request.userMessage });
      
      // Add PDF attachment directly (Gemini is multimodal!)
      if (request.pdfAttachment) {
        parts.push({
          inlineData: {
            mimeType: request.pdfAttachment.mimeType,
            data: request.pdfAttachment.base64,
          },
        });
      }
      
      // Add image attachments
      if (request.imageAttachments) {
        for (const image of request.imageAttachments) {
          parts.push({
            inlineData: {
              mimeType: image.mimeType,
              data: image.base64,
            },
          });
        }
      }
      
      // Make request
      const result = await this.model.generateContent({
        systemInstruction: request.systemPrompt,
        contents: [{ role: "user", parts }],
        generationConfig,
      });
      
      clearTimeout(timeoutId);
      
      // Extract response
      const response = result.response;
      const rawText = response.text();
      const usage = response.usageMetadata;
      
      // Parse JSON response
      const extraction = await extractJson<T>(rawText, {
        stage: "gemini_response",
      });
      
      if (!extraction.success) {
        throw extraction.error;
      }
      
      const durationMs = Date.now() - startTime;
      
      return {
        data: extraction.data,
        rawText,
        usage: {
          promptTokens: usage?.promptTokenCount,
          completionTokens: usage?.candidatesTokenCount,
          totalTokens: usage?.totalTokenCount ?? 0,
        },
        metadata: {
          provider: "google",
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
          provider: "google",
          model: this.config.modelId,
          durationMs: Date.now() - startTime,
        });
      }
      
      throw this.handleError(error, startTime);
    }
  }
  
  /**
   * Convert our JSON schema format to Gemini's format
   */
  private convertSchema(schema: JsonSchema): object {
    // Gemini uses a similar format to JSON Schema but with SchemaType enum
    return this.convertSchemaNode(schema);
  }
  
  private convertSchemaNode(node: JsonSchema | object): object {
    const result: Record<string, unknown> = {};
    
    if ("type" in node) {
      // Convert type string to SchemaType if needed
      const typeValue = node.type;
      if (typeof typeValue === "string") {
        result.type = this.mapType(typeValue);
      } else {
        result.type = typeValue;
      }
    }
    
    if ("description" in node && node.description) {
      result.description = node.description;
    }
    
    if ("enum" in node && node.enum) {
      result.enum = node.enum;
    }
    
    if ("properties" in node && node.properties) {
      result.properties = {};
      for (const [key, value] of Object.entries(node.properties)) {
        (result.properties as Record<string, object>)[key] = this.convertSchemaNode(value);
      }
    }
    
    if ("required" in node && node.required) {
      result.required = node.required;
    }
    
    if ("items" in node && node.items) {
      result.items = this.convertSchemaNode(node.items);
    }
    
    if ("minimum" in node) result.minimum = node.minimum;
    if ("maximum" in node) result.maximum = node.maximum;
    if ("minItems" in node) result.minItems = node.minItems;
    if ("maxItems" in node) result.maxItems = node.maxItems;
    if ("minLength" in node) result.minLength = node.minLength;
    
    return result;
  }
  
  private mapType(type: string): SchemaType {
    const typeMap: Record<string, SchemaType> = {
      string: SchemaType.STRING,
      number: SchemaType.NUMBER,
      integer: SchemaType.INTEGER,
      boolean: SchemaType.BOOLEAN,
      array: SchemaType.ARRAY,
      object: SchemaType.OBJECT,
      STRING: SchemaType.STRING,
      NUMBER: SchemaType.NUMBER,
      INTEGER: SchemaType.INTEGER,
      BOOLEAN: SchemaType.BOOLEAN,
      ARRAY: SchemaType.ARRAY,
      OBJECT: SchemaType.OBJECT,
    };
    return typeMap[type] ?? SchemaType.STRING;
  }
  
  /**
   * Convert API errors to CapsuleError
   */
  private handleError(error: unknown, startTime: number): CapsuleError {
    const durationMs = Date.now() - startTime;
    const context = {
      provider: "google" as const,
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
    
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      // Rate limit errors
      if (message.includes("429") || message.includes("rate limit") || message.includes("quota")) {
        return rateLimitError(context);
      }
      
      // Content policy
      if (message.includes("safety") || message.includes("blocked") || message.includes("policy")) {
        return new CapsuleError(
          ErrorCode.CONTENT_POLICY,
          error.message,
          context,
          error
        );
      }
      
      // Auth errors
      if (message.includes("401") || message.includes("403") || message.includes("api key")) {
        return new CapsuleError(
          ErrorCode.AUTH_ERROR,
          error.message,
          context,
          error
        );
      }
      
      // Server errors
      if (message.includes("500") || message.includes("503") || message.includes("internal")) {
        return apiError(500, error.message, context);
      }
      
      // Default to API error
      return new CapsuleError(
        ErrorCode.API_ERROR,
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

export function createGeminiAdapter(config: AIModelConfig): GeminiAdapter {
  return new GeminiAdapter(config);
}
