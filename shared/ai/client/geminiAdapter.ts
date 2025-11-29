/**
 * Gemini Adapter
 * 
 * Implementation for Google Gemini API with:
 * - Direct PDF support (multimodal)
 * - JSON output via prompt engineering (structured output disabled to avoid schema complexity limits)
 * - Timeout handling
 * 
 * NOTE: Gemini's native structured output (responseSchema) is disabled because complex schemas
 * exceed Google's state limit. Instead, we use prompt engineering to request JSON and rely on
 * the extractJson function to parse responses.
 */

import { 
  GoogleGenerativeAI, 
  GenerativeModel,
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

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes for large PDFs
const DEFAULT_MAX_TOKENS = 8192;

// JSON instruction appended to prompts when responseSchema is provided
const JSON_OUTPUT_INSTRUCTION = `

CRITICAL: You MUST respond with ONLY valid JSON. No markdown code fences, no explanatory text, no prefixes or suffixes. Just the raw JSON object.`;

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
    
    if (!config.modelId) {
      throw new CapsuleError(
        ErrorCode.CONFIG_ERROR,
        "Model ID is required. Please configure the AI model in the admin panel.",
        { provider: "google" }
      );
    }
    
    this.config = config;
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = this.client.getGenerativeModel({
      model: config.modelId,
    });
  }
  
  /**
   * Make a structured output request to Gemini
   * 
   * NOTE: We do NOT use Gemini's native responseSchema because complex schemas
   * exceed Google's state limit. Instead, we:
   * 1. Request JSON output via responseMimeType
   * 2. Add explicit JSON instructions to the system prompt
   * 3. Parse the response using extractJson (with repair logic)
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
      // Build generation config - use JSON mode but WITHOUT schema constraints
      const generationConfig: GenerationConfig = {
        temperature: this.config.temperature ?? 0.7,
        maxOutputTokens: this.config.maxOutputTokens ?? DEFAULT_MAX_TOKENS,
        responseMimeType: "application/json", // Request JSON output format
        // NOTE: responseSchema is intentionally NOT set to avoid schema complexity limits
      };
      
      // Enhance system prompt with JSON instruction when schema is expected
      let systemPrompt = request.systemPrompt;
      if (request.responseSchema) {
        systemPrompt = systemPrompt + JSON_OUTPUT_INSTRUCTION;
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
        systemInstruction: systemPrompt,
        contents: [{ role: "user", parts }],
        generationConfig,
      });
      
      clearTimeout(timeoutId);
      
      // Extract response
      const response = result.response;
      const rawText = response.text();
      const usage = response.usageMetadata;
      
      // Parse JSON response (extractJson has repair logic for malformed JSON)
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
