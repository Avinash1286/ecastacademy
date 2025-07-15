import { NextResponse, type NextRequest } from 'next/server';
import { fetchAndParseTranscript } from '@/lib/services/transcriptService';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('v');

  if (!videoId) {
    return NextResponse.json(
      { error: 'Video ID is required in the query string (e.g., /api/transcript?v=VIDEO_ID).' },
      { status: 400 }
    );
  }

  try {
    const transcript = await fetchAndParseTranscript(videoId);
    
    return NextResponse.json({ transcript });

  } catch (error) {
    console.error(`[TRANSCRIPT_API_ERROR] for video ${videoId}:`, error);
    
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json(
      { error: 'Failed to fetch or process the transcript.', details: errorMessage },
      { status: 500 }
    );
  }
}