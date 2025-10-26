import { NextResponse } from 'next/server';
import { api } from '../../../../../../../convex/_generated/api';
import { Id } from '../../../../../../../convex/_generated/dataModel';
import { createConvexClient } from '@/lib/convexClient';

const convex = createConvexClient();

/**
 * Execute a provided query function and retry on connection timeouts using exponential backoff.
 *
 * The function invokes `queryFn` and, if it throws an error with `code === 'UND_ERR_CONNECT_TIMEOUT'`, retries up to `maxRetries` times with delays that double each attempt starting from `baseDelay` milliseconds.
 *
 * @param queryFn - Function that performs the query; its resolved value is returned when successful.
 * @param maxRetries - Maximum number of retry attempts after the initial try (default: 2).
 * @param baseDelay - Initial delay in milliseconds used for exponential backoff (default: 1000).
 * @returns The value returned by `queryFn`.
 * @throws The error thrown by `queryFn` if a non-timeout error occurs or if timeout retries are exhausted.
 */
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
      console.log(`[RETRY] Attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ courseId: string; chapterId: string }> }
) {
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

    console.log('Chapter details from Convex:', {
      hasNotes: !!chapterDetails.video.notes,
      hasQuiz: !!chapterDetails.video.quiz,
      notesType: typeof chapterDetails.video.notes,
      quizType: typeof chapterDetails.video.quiz,
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
    console.error('[GET_CHAPTER_DETAILS_API_ERROR]', error);
    
    // Provide more specific error message
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    const isTimeout = error && typeof error === 'object' && 'code' in error && error.code === 'UND_ERR_CONNECT_TIMEOUT';
    
    return new NextResponse(
      isTimeout ? 'Request timeout - please try again' : errorMessage,
      { status: isTimeout ? 504 : 500 }
    );
  }
}