/**
 * Enhanced Transcript Service with Circuit Breaker and Fallback
 * 
 * Features:
 * - Multiple transcript provider support
 * - Circuit breaker for each provider
 * - Automatic fallback to next provider on failure
 * - Caching for successful fetches
 * - Configurable timeouts
 */

import * as cheerio from 'cheerio';

// =============================================================================
// Types
// =============================================================================

interface TranscriptProvider {
  name: string;
  fetchTranscript: (videoId: string) => Promise<string>;
  parseResponse?: (html: string) => string;
}

interface CircuitState {
  failures: number;
  lastFailure: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

interface TranscriptResult {
  transcript: string;
  provider: string;
  fromCache: boolean;
}

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
  /** Number of failures before opening circuit */
  failureThreshold: 3,
  /** Time in ms before retrying after circuit opens (5 minutes) */
  resetTimeout: 5 * 60 * 1000,
  /** Request timeout in ms */
  requestTimeout: 30000,
  /** Cache TTL in ms (1 hour) */
  cacheTtl: 60 * 60 * 1000,
};

// =============================================================================
// Circuit Breaker State
// =============================================================================

const circuitStates = new Map<string, CircuitState>();
const transcriptCache = new Map<string, { transcript: string; timestamp: number; provider: string }>();

function getCircuitState(provider: string): CircuitState {
  if (!circuitStates.has(provider)) {
    circuitStates.set(provider, {
      failures: 0,
      lastFailure: 0,
      state: 'CLOSED',
    });
  }
  return circuitStates.get(provider)!;
}

function isCircuitOpen(provider: string): boolean {
  const state = getCircuitState(provider);
  
  if (state.state === 'CLOSED') {
    return false;
  }
  
  if (state.state === 'OPEN') {
    // Check if we should transition to HALF_OPEN
    const timeSinceFailure = Date.now() - state.lastFailure;
    if (timeSinceFailure >= CONFIG.resetTimeout) {
      state.state = 'HALF_OPEN';
      console.log(`[TranscriptCircuit] ${provider}: OPEN -> HALF_OPEN`);
      return false;
    }
    return true;
  }
  
  // HALF_OPEN - allow request
  return false;
}

function recordSuccess(provider: string): void {
  const state = getCircuitState(provider);
  
  if (state.state === 'HALF_OPEN') {
    state.state = 'CLOSED';
    state.failures = 0;
    console.log(`[TranscriptCircuit] ${provider}: HALF_OPEN -> CLOSED (recovered)`);
  } else {
    state.failures = 0;
  }
}

function recordFailure(provider: string): void {
  const state = getCircuitState(provider);
  state.failures++;
  state.lastFailure = Date.now();
  
  if (state.state === 'HALF_OPEN') {
    state.state = 'OPEN';
    console.log(`[TranscriptCircuit] ${provider}: HALF_OPEN -> OPEN (still failing)`);
  } else if (state.failures >= CONFIG.failureThreshold) {
    state.state = 'OPEN';
    console.log(`[TranscriptCircuit] ${provider}: CLOSED -> OPEN (${state.failures} failures)`);
  }
}

// =============================================================================
// Provider Implementations
// =============================================================================

const PROVIDERS: TranscriptProvider[] = [
  {
    name: 'youtubetotranscript',
    fetchTranscript: async (videoId: string) => {
      const url = `https://youtubetotranscript.com/transcript?v=${videoId}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.requestTimeout);
      
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
          },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const html = await response.text();
        return parseYouTubeToTranscript(html);
      } finally {
        clearTimeout(timeoutId);
      }
    },
  },
  // Additional providers can be added here
  // Example: YouTube's official API (requires API key and captions.download scope)
  // {
  //   name: 'youtube-api',
  //   fetchTranscript: async (videoId: string) => {
  //     // Implementation using YouTube Data API v3
  //   },
  // },
];

/**
 * Parse transcript from youtubetotranscript.com HTML response
 */
function parseYouTubeToTranscript(html: string): string {
  const $ = cheerio.load(html);
  
  const paragraphs: string[] = [];
  $('#transcript > p').each((_, pElement) => {
    let currentParagraph = '';
    $(pElement).contents().each((_, contentElement) => {
      if (contentElement.type === 'tag' && contentElement.name === 'span') {
        const text = $(contentElement).text().replace(/\s+/g, ' ').trim();
        if (text) currentParagraph += text + ' ';
      } else if (contentElement.type === 'tag' && contentElement.name === 'br') {
        if (currentParagraph.trim()) paragraphs.push(currentParagraph.trim());
        currentParagraph = '';
      }
    });
    if (currentParagraph.trim()) paragraphs.push(currentParagraph.trim());
  });
  
  const transcript = paragraphs.join('\n\n');
  
  if (!transcript || transcript.length < 10) {
    throw new Error('No transcript content found in response');
  }
  
  return transcript;
}

// =============================================================================
// Main Service
// =============================================================================

/**
 * Fetch transcript with circuit breaker protection and automatic fallback
 */
export async function fetchAndParseTranscriptEnhanced(
  videoId: string,
  options: { skipCache?: boolean } = {}
): Promise<TranscriptResult> {
  // Check cache first
  if (!options.skipCache) {
    const cached = transcriptCache.get(videoId);
    if (cached && Date.now() - cached.timestamp < CONFIG.cacheTtl) {
      console.log(`[Transcript] Cache hit for ${videoId} (provider: ${cached.provider})`);
      return {
        transcript: cached.transcript,
        provider: cached.provider,
        fromCache: true,
      };
    }
  }
  
  const errors: Array<{ provider: string; error: string }> = [];
  
  // Try each provider in order
  for (const provider of PROVIDERS) {
    // Skip if circuit is open
    if (isCircuitOpen(provider.name)) {
      console.log(`[Transcript] Skipping ${provider.name} (circuit OPEN)`);
      errors.push({
        provider: provider.name,
        error: 'Circuit breaker is open',
      });
      continue;
    }
    
    try {
      console.log(`[Transcript] Trying ${provider.name} for ${videoId}`);
      const transcript = await provider.fetchTranscript(videoId);
      
      // Success!
      recordSuccess(provider.name);
      
      // Cache the result
      transcriptCache.set(videoId, {
        transcript,
        timestamp: Date.now(),
        provider: provider.name,
      });
      
      console.log(`[Transcript] Success with ${provider.name} for ${videoId} (${transcript.length} chars)`);
      
      return {
        transcript,
        provider: provider.name,
        fromCache: false,
      };
    } catch (error) {
      recordFailure(provider.name);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Transcript] ${provider.name} failed for ${videoId}: ${errorMessage}`);
      
      errors.push({
        provider: provider.name,
        error: errorMessage,
      });
    }
  }
  
  // All providers failed
  throw new TranscriptFetchError(
    `Failed to fetch transcript for video ${videoId}`,
    errors
  );
}

/**
 * Get circuit breaker status for all providers (for monitoring)
 */
export function getTranscriptProviderStatus(): Record<string, CircuitState> {
  const status: Record<string, CircuitState> = {};
  for (const provider of PROVIDERS) {
    status[provider.name] = getCircuitState(provider.name);
  }
  return status;
}

/**
 * Reset circuit breaker for a provider (admin function)
 */
export function resetProviderCircuit(providerName: string): void {
  circuitStates.delete(providerName);
  console.log(`[TranscriptCircuit] ${providerName}: Reset`);
}

/**
 * Clear transcript cache (admin function)
 */
export function clearTranscriptCache(): number {
  const count = transcriptCache.size;
  transcriptCache.clear();
  console.log(`[Transcript] Cache cleared (${count} entries)`);
  return count;
}

// =============================================================================
// Custom Error
// =============================================================================

export class TranscriptFetchError extends Error {
  public readonly errors: Array<{ provider: string; error: string }>;
  public readonly code = 'TRANSCRIPT_FETCH_FAILED';
  
  constructor(message: string, errors: Array<{ provider: string; error: string }>) {
    super(message);
    this.name = 'TranscriptFetchError';
    this.errors = errors;
  }
}

// =============================================================================
// Backward Compatible Export
// =============================================================================

/**
 * Drop-in replacement for original fetchAndParseTranscript
 * Returns just the transcript string for backward compatibility
 */
export async function fetchAndParseTranscript(videoId: string): Promise<string> {
  const result = await fetchAndParseTranscriptEnhanced(videoId);
  return result.transcript;
}
