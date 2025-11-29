import { NextRequest, NextResponse } from 'next/server';
import { getCourseDetails } from '@/lib/services/courseServiceConvex';
import type { Id } from '../../../../../../convex/_generated/dataModel';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/security/rateLimit';

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

    return NextResponse.json(courseDetails);
  } catch (error) {
    console.error('[GET_COURSE_DETAILS_API]', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}