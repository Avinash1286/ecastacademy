import { NextRequest, NextResponse } from 'next/server';
import { getCourseDetails } from '@/lib/services/courseServiceConvex';
import type { Id } from '../../../../../../convex/_generated/dataModel';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/security/rateLimit';
import { logger } from '@/lib/logging/logger';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ courseId: string }> }
) {
  // Apply rate limiting for public API
  const rateLimitResponse = await withRateLimit(request, RATE_LIMIT_PRESETS.PUBLIC_API);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const params=await context.params;
    const { courseId } = params;
    const courseDetails = await getCourseDetails(courseId as Id<"courses">);

    if (!courseDetails) {
      return new NextResponse('Course not found', { status: 404 });
    }

    // MEDIUM-6 FIX: Add caching headers to reduce database load and improve DDoS resilience
    const response = NextResponse.json(courseDetails);
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    return response;
  } catch (error) {
    logger.error('Failed to get course details', { endpoint: '/api/courses/[courseId]/single' }, error as Error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}