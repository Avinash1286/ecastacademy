import { NextRequest, NextResponse } from 'next/server';
import { api } from '../../../../../../../convex/_generated/api';
import { Id } from '../../../../../../../convex/_generated/dataModel';
import { createConvexClient } from '@/lib/convexClient';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/security/rateLimit';
import { logger } from '@/lib/logging/logger';

const convex = createConvexClient();

// Helper function to retry with exponential backoff
async function queryWithRetry<T>(
  queryFn: () => Promise<T>,
  maxRetries = 2,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await queryFn();
    } catch (error) {
      lastError = error as Error;
      
      // If it's not a timeout error or it's the last attempt, throw immediately
      if (attempt === maxRetries || !error || typeof error !== 'object' || !('code' in error) || error.code !== 'UND_ERR_CONNECT_TIMEOUT') {
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      const delay = baseDelay * Math.pow(2, attempt);
      logger.debug(`Retry attempt ${attempt + 1}/${maxRetries + 1}, retrying in ${delay}ms`, { attempt, maxRetries, delay });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ courseId: string; chapterId: string }> }
) {
  // Apply rate limiting for public API
  const rateLimitResponse = await withRateLimit(request, RATE_LIMIT_PRESETS.PUBLIC_API);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const params = await context.params;
    const { chapterId } = params;

    const chapterDetails = await queryWithRetry(() => 
      convex.query(api.chapters.getChapterWithDetails, {
        id: chapterId as Id<"chapters">,
      })
    );

    if (!chapterDetails) {
      return new NextResponse('Chapter not found', { status: 404 });
    }

    // If chapter exists but has no video, return empty content
    if (!chapterDetails.video) {
      return NextResponse.json({
        notes: {},
        quiz: {},
        transcript: null,
      });
    }

    logger.debug('Chapter details retrieved', {
      chapterId,
      hasNotes: !!chapterDetails.video.notes,
      hasQuiz: !!chapterDetails.video.quiz,
    });

    const response = NextResponse.json({
      notes: chapterDetails.video.notes || {},
      quiz: chapterDetails.video.quiz || {},
      transcript: chapterDetails.video.transcript || null,
    });
    
    // Cache the response for 5 minutes to reduce redundant requests
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    
    return response;
  } catch (error) {
    logger.error('Failed to get chapter details', { chapterId: (await context.params).chapterId }, error as Error);
    
    // Provide more specific error message
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    const isTimeout = error && typeof error === 'object' && 'code' in error && error.code === 'UND_ERR_CONNECT_TIMEOUT';
    
    return new NextResponse(
      isTimeout ? 'Request timeout - please try again' : errorMessage,
      { status: isTimeout ? 504 : 500 }
    );
  }
}