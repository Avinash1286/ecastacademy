/**
 * Centralized AI Client (Legacy)
 * 
 * @deprecated This module is maintained for backward compatibility.
 * Use `@shared/ai/core` for new code:
 * 
 * ```typescript
 * import { ai } from "@shared/ai/core";
 * const response = await ai.generateText({ ... });
 * ```
 */

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { LanguageModel } from "ai";

// Define a type for the configuration we expect from the backend
export type AIModelConfig = {
    provider: "google" | "openai";
    modelId: string;
    apiKey?: string; // Optional, usually loaded from env
};

/**
 * Get an AI client for the Vercel AI SDK
 * 
 * @deprecated Use `ai.generateText()` or `ai.generateStream()` from `@shared/ai/core`
 */
export const getAIClient = (config: AIModelConfig): LanguageModel => {
    if (config.provider === "google") {
        const google = createGoogleGenerativeAI({
            apiKey: config.apiKey ?? process.env.GEMINI_API_KEY,
        });
        return google(config.modelId);
    } else if (config.provider === "openai") {
        const openai = createOpenAI({
            apiKey: config.apiKey ?? process.env.OPENAI_API_KEY,
        });
        return openai(config.modelId);
    }

    throw new Error(`Unsupported AI provider: ${config.provider}`);
};
