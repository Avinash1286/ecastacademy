import { NextRequest, NextResponse } from 'next/server';
import { api } from '../../../../../../../../convex/_generated/api';
import { Id } from '../../../../../../../../convex/_generated/dataModel';
import { createConvexClient } from '@/lib/convexClient';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/security/rateLimit';
import { logger } from '@/lib/logging/logger';

const convex = createConvexClient();

// Validate Convex ID format (basic validation)
function isValidConvexId(id: string): boolean {
  // Convex IDs are typically alphanumeric strings
  return typeof id === 'string' && id.length > 0 && /^[a-zA-Z0-9_]+$/.test(id);
}

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

/**
 * GET endpoint to load chapter content on demand
 * Loads notes and quiz but NOT transcript (transcript is loaded only by AI tutor)
 * 
 * Security:
 * - Rate limited with PUBLIC_API preset
 * - Input validation for IDs
 * - Validates chapter belongs to the specified course
 * - Does not expose transcript (loaded on-demand by AI tutor only)
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ courseId: string; chapterId: string }> }
) {
  // Apply rate limiting for public API
  const rateLimitResponse = await withRateLimit(request, RATE_LIMIT_PRESETS.PUBLIC_API);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const params = await context.params;
    const { courseId, chapterId } = params;

    // Input validation
    if (!courseId || !chapterId) {
      return new NextResponse('Bad Request: Course ID and Chapter ID are required', { status: 400 });
    }

    if (!isValidConvexId(courseId) || !isValidConvexId(chapterId)) {
      return new NextResponse('Bad Request: Invalid ID format', { status: 400 });
    }

    const chapterContent = await queryWithRetry(() => 
      convex.query(api.chapters.getChapterContentOnDemand, {
        chapterId: chapterId as Id<"chapters">,
      })
    );

    if (!chapterContent) {
      return new NextResponse('Chapter not found', { status: 404 });
    }

    // Validate that the chapter belongs to the specified course
    if (chapterContent.course?.id !== courseId) {
      logger.warn('Chapter-course mismatch attempt', { 
        requestedCourseId: courseId, 
        actualCourseId: chapterContent.course?.id,
        chapterId 
      });
      return new NextResponse('Chapter not found in this course', { status: 404 });
    }

    logger.debug('Chapter content retrieved on demand', {
      chapterId,
      courseId,
      hasVideo: !!chapterContent.video,
      contentItemsCount: chapterContent.contentItems?.length ?? 0,
    });

    const response = NextResponse.json(chapterContent);
    
    // Cache the response for 5 minutes to reduce redundant requests
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    
    return response;
  } catch (error) {
    const params = await context.params;
    logger.error('Failed to get chapter content', { 
      chapterId: params.chapterId,
      courseId: params.courseId 
    }, error as Error);
    
    // Don't expose internal error details
    const isTimeout = error && typeof error === 'object' && 'code' in error && error.code === 'UND_ERR_CONNECT_TIMEOUT';
    
    return new NextResponse(
      isTimeout ? 'Request timeout - please try again' : 'Internal Server Error',
      { status: isTimeout ? 504 : 500 }
    );
  }
}
