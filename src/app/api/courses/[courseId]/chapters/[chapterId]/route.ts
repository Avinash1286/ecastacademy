import { NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../../../convex/_generated/api';
import { Id } from '../../../../../../../convex/_generated/dataModel';

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;
const convex = new ConvexHttpClient(convexUrl);

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