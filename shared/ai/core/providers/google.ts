/**
 * Google (Gemini) Provider Adapter
 * 
 * Implements the AIProviderAdapter interface for Google's Generative AI.
 * 
 * Features:
 * - Native PDF support (multimodal)
 * - Structured JSON output with schema
 * - Streaming support
 * - Image/vision support
 * - Robust error handling
 */

import {
  GoogleGenerativeAI,
  GenerativeModel,
  SchemaType,
  type GenerationConfig,
  type Content,
  type Part,
} from "@google/generative-ai";

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
import type { JsonSchema } from "../../schemas/jsonSchema";

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes for large PDFs
const DEFAULT_MAX_TOKENS = 8192;

const GOOGLE_CAPABILITIES: ProviderCapabilities = {
  streaming: true,
  structuredOutput: true,
  nativePdf: true,
  vision: true,
  functionCalling: true,
  maxContextTokens: 1_000_000, // Gemini 1.5 Pro
  maxOutputTokens: 8192,
};

// =============================================================================
// Schema Conversion
// =============================================================================

/**
 * Convert JSON Schema to Gemini's schema format
 */
function convertToGeminiSchema(schema: JsonSchema): object {
  return convertSchemaNode(schema);
}

function convertSchemaNode(node: JsonSchema | object): object {
  const result: Record<string, unknown> = {};
  
  if ("type" in node) {
    result.type = mapType(node.type as string);
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
      (result.properties as Record<string, object>)[key] = convertSchemaNode(value);
    }
  }
  
  if ("required" in node && node.required) {
    result.required = node.required;
  }
  
  if ("items" in node && node.items) {
    result.items = convertSchemaNode(node.items);
  }
  
  if ("minimum" in node) result.minimum = node.minimum;
  if ("maximum" in node) result.maximum = node.maximum;
  if ("minItems" in node) result.minItems = node.minItems;
  if ("maxItems" in node) result.maxItems = node.maxItems;
  if ("minLength" in node) result.minLength = node.minLength;
  
  return result;
}

function mapType(type: string): SchemaType {
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

// =============================================================================
// Error Handling
// =============================================================================

function handleGoogleError(
  error: unknown,
  config: AIModelConfig,
  durationMs: number
): AIError {
  const context = {
    provider: "google" as const,
    model: config.modelId,
    durationMs,
  };
  
  if (error instanceof AIError) {
    return error.withContext(context);
  }
  
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Rate limit
    if (message.includes("429") || message.includes("rate limit") || message.includes("quota")) {
      return rateLimitError("google", 60000, context);
    }
    
    // Content policy
    if (message.includes("safety") || message.includes("blocked") || message.includes("policy")) {
      return contentPolicyError("google", error.message, context);
    }
    
    // Auth
    if (message.includes("401") || message.includes("403") || message.includes("api key")) {
      return authError("google", error.message, message.includes("403") ? 403 : 401);
    }
    
    // Server
    if (message.includes("500") || message.includes("503") || message.includes("internal")) {
      return serverError("google", message.includes("503") ? 503 : 500, error.message, context);
    }
  }
  
  return fromUnknown(error, context);
}

// =============================================================================
// Google Adapter Class
// =============================================================================

export class GoogleAdapter implements AIProviderAdapter {
  readonly provider = "google" as const;
  readonly capabilities = GOOGLE_CAPABILITIES;
  
  private clientCache = new Map<string, GoogleGenerativeAI>();
  
  /**
   * Get or create a client for the given API key
   */
  private getClient(apiKey: string): GoogleGenerativeAI {
    if (!this.clientCache.has(apiKey)) {
      this.clientCache.set(apiKey, new GoogleGenerativeAI(apiKey));
    }
    return this.clientCache.get(apiKey)!;
  }
  
  /**
   * Get the API key from config or environment
   */
  private getApiKey(config: AIModelConfig): string {
    const apiKey = config.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw configError(
        AIErrorCode.MISSING_API_KEY,
        "Missing GEMINI_API_KEY environment variable or apiKey in config",
        { provider: "google" }
      );
    }
    return apiKey;
  }
  
  /**
   * Create a generative model instance
   */
  private getModel(
    config: AIModelConfig,
    generationConfig?: GenerationConfig
  ): GenerativeModel {
    const apiKey = this.getApiKey(config);
    const client = this.getClient(apiKey);
    
    return client.getGenerativeModel({
      model: config.modelId || "gemini-1.5-flash",
      generationConfig,
    });
  }
  
  /**
   * Build content parts from request
   */
  private buildParts(
    prompt: string,
    pdfAttachments?: Array<{ base64: string; mimeType: string }>,
    imageAttachments?: Array<{ base64: string; mimeType: string }>
  ): Part[] {
    const parts: Part[] = [{ text: prompt }];
    
    // Add PDF attachments (Gemini supports native PDF)
    if (pdfAttachments) {
      for (const pdf of pdfAttachments) {
        parts.push({
          inlineData: {
            mimeType: pdf.mimeType,
            data: pdf.base64,
          },
        });
      }
    }
    
    // Add image attachments
    if (imageAttachments) {
      for (const image of imageAttachments) {
        parts.push({
          inlineData: {
            mimeType: image.mimeType,
            data: image.base64,
          },
        });
      }
    }
    
    return parts;
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
    
    // Link external signal
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
        throw timeoutError("google", timeoutMs, {
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
      const generationConfig: GenerationConfig = {
        temperature: config.temperature ?? 0.7,
        maxOutputTokens: config.maxOutputTokens ?? DEFAULT_MAX_TOKENS,
      };
      
      const model = this.getModel(config, generationConfig);
      
      let contents: Content[];
      
      if (request.type === "chat") {
        // Convert conversation to Gemini format
        contents = request.messages
          .filter(m => m.role !== "system")
          .map(m => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          }));
        
        // Add attachments to the last user message
        if (contents.length > 0) {
          const lastContent = contents[contents.length - 1];
          if (lastContent.role === "user" && request.pdfAttachments) {
            for (const pdf of request.pdfAttachments) {
              lastContent.parts.push({
                inlineData: { mimeType: pdf.mimeType, data: pdf.base64 },
              });
            }
          }
        }
      } else {
        // Text generation
        const parts = this.buildParts(
          request.prompt,
          request.pdfAttachments,
          request.imageAttachments
        );
        contents = [{ role: "user", parts }];
      }
      
      const result = await this.withTimeout(
        model.generateContent({
          systemInstruction: request.systemPrompt,
          contents,
          generationConfig,
        }),
        timeoutMs,
        config,
        options?.signal
      );
      
      const response = result.response;
      const text = response.text();
      const usage = response.usageMetadata;
      
      const durationMs = Date.now() - startTime;
      
      return {
        text,
        usage: {
          promptTokens: usage?.promptTokenCount,
          completionTokens: usage?.candidatesTokenCount,
          totalTokens: usage?.totalTokenCount ?? 0,
        },
        metadata: {
          provider: "google",
          model: config.modelId,
          durationMs,
          wasRetried: false,
          attemptCount: 1,
        },
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      throw handleGoogleError(error, config, durationMs);
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
      const generationConfig: GenerationConfig = {
        temperature: config.temperature ?? 0.7,
        maxOutputTokens: config.maxOutputTokens ?? DEFAULT_MAX_TOKENS,
        responseMimeType: "application/json",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        responseSchema: convertToGeminiSchema(request.responseSchema) as any,
      };
      
      const model = this.getModel(config, generationConfig);
      
      const parts = this.buildParts(
        request.prompt,
        request.pdfAttachments,
        request.imageAttachments
      );
      
      const result = await this.withTimeout(
        model.generateContent({
          systemInstruction: request.systemPrompt,
          contents: [{ role: "user", parts }],
          generationConfig,
        }),
        timeoutMs,
        config,
        options?.signal
      );
      
      const response = result.response;
      const rawText = response.text();
      const usage = response.usageMetadata;
      
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
          promptTokens: usage?.promptTokenCount,
          completionTokens: usage?.candidatesTokenCount,
          totalTokens: usage?.totalTokenCount ?? 0,
        },
        metadata: {
          provider: "google",
          model: config.modelId,
          durationMs,
          wasRetried: false,
          attemptCount: 1,
        },
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      throw handleGoogleError(error, config, durationMs);
    }
  }
  
  /**
   * Generate streaming response
   * @param _options - Reserved for future use (timeout/cancellation)
   */
  async generateStream(
    request: TextGenerationRequest | ChatRequest,
    config: AIModelConfig,
    _options?: AIRequestOptions
  ): Promise<StreamResponse> {
    void _options; // Reserved for future timeout support
    const startTime = Date.now();
    
    try {
      const generationConfig: GenerationConfig = {
        temperature: config.temperature ?? 0.7,
        maxOutputTokens: config.maxOutputTokens ?? DEFAULT_MAX_TOKENS,
      };
      
      const model = this.getModel(config, generationConfig);
      
      let contents: Content[];
      
      if (request.type === "chat") {
        contents = request.messages
          .filter(m => m.role !== "system")
          .map(m => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          }));
      } else {
        const parts = this.buildParts(
          request.prompt,
          request.pdfAttachments,
          request.imageAttachments
        );
        contents = [{ role: "user", parts }];
      }
      
      const streamResult = await model.generateContentStream({
        systemInstruction: request.systemPrompt,
        contents,
        generationConfig,
      });
      
      let fullText = "";
      let totalTokens = 0;
      
      // Create async iterator
      const createStream = async function* (): AsyncIterable<StreamChunk> {
        for await (const chunk of streamResult.stream) {
          const text = chunk.text();
          fullText += text;
          
          if (chunk.usageMetadata?.totalTokenCount) {
            totalTokens = chunk.usageMetadata.totalTokenCount;
          }
          
          yield {
            text,
            done: false,
            tokenCount: totalTokens,
          };
        }
        
        yield {
          text: "",
          done: true,
          tokenCount: totalTokens,
        };
      };
      
      const stream = createStream();
      
      // Create text promise
      const textPromise = (async () => {
        // Consume stream to get full text
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _chunk of stream) {
          // Stream is consumed by caller
        }
        return fullText;
      })();
      
      const durationMs = Date.now() - startTime;
      
      return {
        stream: createStream(),
        text: textPromise,
        usage: {
          totalTokens: 0, // Will be updated during streaming
        },
        metadata: {
          provider: "google",
          model: config.modelId,
          durationMs,
          wasRetried: false,
          attemptCount: 1,
        },
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      throw handleGoogleError(error, config, durationMs);
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

let googleAdapterInstance: GoogleAdapter | null = null;

/**
 * Get the singleton Google adapter instance
 */
export function getGoogleAdapter(): GoogleAdapter {
  if (!googleAdapterInstance) {
    googleAdapterInstance = new GoogleAdapter();
  }
  return googleAdapterInstance;
}
