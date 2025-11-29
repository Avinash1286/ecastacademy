import { NextResponse, type NextRequest } from 'next/server';
import { 
  fetchAndParseTranscriptEnhanced, 
  TranscriptFetchError,
  getTranscriptProviderStatus 
} from '@/lib/services/transcriptServiceEnhanced';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/security/rateLimit';
import { logger } from '@/lib/logging/logger';

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await withRateLimit(request, RATE_LIMIT_PRESETS.TRANSCRIPT);
  if (rateLimitResponse) return rateLimitResponse;

  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('v');

  if (!videoId) {
    return NextResponse.json(
      { error: 'Video ID is required in the query string (e.g., /api/transcript?v=VIDEO_ID).' },
      { status: 400 }
    );
  }

  // Validate video ID format (11 characters, alphanumeric with - and _)
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return NextResponse.json(
      { error: 'Invalid video ID format.' },
      { status: 400 }
    );
  }

  try {
    const result = await fetchAndParseTranscriptEnhanced(videoId);
    
    // Return extended response with provider info
    return NextResponse.json({ 
      transcript: result.transcript,
      provider: result.provider,
      fromCache: result.fromCache,
    });

  } catch (error) {
    logger.error(`[TRANSCRIPT_API] Failed for video ${videoId}`, { videoId }, error as Error);
    
    // Handle circuit breaker / multi-provider errors
    if (error instanceof TranscriptFetchError) {
      return NextResponse.json(
        { 
          error: 'Failed to fetch transcript from all available providers.', 
          details: error.message,
          providerErrors: error.errors,
          providerStatus: getTranscriptProviderStatus(),
        },
        { status: 503 } // Service Unavailable
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json(
      { error: 'Failed to fetch or process the transcript.', details: errorMessage },
      { status: 500 }
    );
  }
}