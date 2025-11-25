/**
 * Provider Registry
 * 
 * Central registry for all AI provider adapters.
 * Provides provider selection and capability checking.
 */

import type { AIProvider, AIProviderAdapter, ProviderCapabilities } from "./types";
import { getGoogleAdapter } from "./providers/google";
import { getOpenAIAdapter } from "./providers/openai";
import { AIErrorCode, configError } from "./errors";

// =============================================================================
// Registry
// =============================================================================

/**
 * Get the adapter for a specific provider
 */
export function getProviderAdapter(provider: AIProvider): AIProviderAdapter {
  switch (provider) {
    case "google":
      return getGoogleAdapter();
    case "openai":
      return getOpenAIAdapter();
    default:
      throw configError(
        AIErrorCode.UNSUPPORTED_PROVIDER,
        `Unsupported AI provider: ${provider}. Supported: google, openai`,
        { provider }
      );
  }
}

/**
 * Get capabilities for a provider
 */
export function getProviderCapabilities(provider: AIProvider): ProviderCapabilities {
  return getProviderAdapter(provider).capabilities;
}

/**
 * Check if a provider supports a capability
 */
export function hasCapability(
  provider: AIProvider,
  capability: keyof ProviderCapabilities
): boolean {
  const capabilities = getProviderCapabilities(provider);
  const value = capabilities[capability];
  return typeof value === "boolean" ? value : value > 0;
}

/**
 * Get the best provider for a set of requirements
 */
export function selectBestProvider(requirements: {
  needsPdf?: boolean;
  needsStreaming?: boolean;
  needsStructured?: boolean;
  needsVision?: boolean;
  preferFast?: boolean;
}): AIProvider {
  const providers: AIProvider[] = ["google", "openai"];
  
  // Filter by hard requirements
  const candidates = providers.filter(provider => {
    const caps = getProviderCapabilities(provider);
    
    if (requirements.needsPdf && !caps.nativePdf) return false;
    if (requirements.needsStreaming && !caps.streaming) return false;
    if (requirements.needsStructured && !caps.structuredOutput) return false;
    if (requirements.needsVision && !caps.vision) return false;
    
    return true;
  });
  
  if (candidates.length === 0) {
    // Fall back to Google as it has the most capabilities
    return "google";
  }
  
  // Prefer Google for PDF (native support)
  if (requirements.needsPdf) {
    return "google";
  }
  
  // Prefer Google for speed
  if (requirements.preferFast) {
    return "google";
  }
  
  // Default to first candidate
  return candidates[0];
}

/**
 * Get all available providers
 */
export function getAvailableProviders(): AIProvider[] {
  return ["google", "openai"];
}

/**
 * Check if a provider is available (has API key configured)
 */
export function isProviderAvailable(provider: AIProvider): boolean {
  switch (provider) {
    case "google":
      return !!process.env.GEMINI_API_KEY;
    case "openai":
      return !!process.env.OPENAI_API_KEY;
    default:
      return false;
  }
}

/**
 * Get the recommended model for a provider
 */
export function getDefaultModel(provider: AIProvider): string {
  switch (provider) {
    case "google":
      return "gemini-1.5-flash";
    case "openai":
      return "gpt-4o";
    default:
      return "gemini-1.5-flash";
  }
}

// Re-export types
export type { AIProviderAdapter, ProviderCapabilities };
