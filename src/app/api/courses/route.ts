import { NextRequest, NextResponse } from 'next/server';
import { getAllCoursesWithThumbnails } from '@/lib/services/courseServiceConvex';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/security/rateLimit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Apply rate limiting for public API
  const rateLimitResponse = await withRateLimit(request, RATE_LIMIT_PRESETS.PUBLIC_API);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const searchParams = request.nextUrl?.searchParams ?? new URL(request.url, 'http://localhost').searchParams;
    const limit = parseInt(searchParams.get('limit') || '9', 10);
    const cursor = searchParams.get('cursor') || undefined;

    const result = await getAllCoursesWithThumbnails(limit, cursor);

    // Return { courses, nextCursor, hasMore } for pagination support
    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('[GET_COURSES_API]', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}