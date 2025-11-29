import { NextRequest, NextResponse } from 'next/server';
import { getAllCoursesWithThumbnails } from '@/lib/services/courseServiceConvex';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/security/rateLimit';
import { logger } from '@/lib/logging/logger';

export const dynamic = 'force-dynamic';

// Pagination bounds
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 9;

export async function GET(request: NextRequest) {
  // Apply rate limiting for public API
  const rateLimitResponse = await withRateLimit(request, RATE_LIMIT_PRESETS.PUBLIC_API);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const searchParams = request.nextUrl?.searchParams ?? new URL(request.url, 'http://localhost').searchParams;
    // Enforce pagination bounds to prevent resource exhaustion
    const requestedLimit = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10);
    const limit = Math.min(Math.max(isNaN(requestedLimit) ? DEFAULT_LIMIT : requestedLimit, MIN_LIMIT), MAX_LIMIT);
    const cursor = searchParams.get('cursor') || undefined;

    const result = await getAllCoursesWithThumbnails(limit, cursor);

    // Return { courses, nextCursor, hasMore } for pagination support
    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    logger.error('Failed to get courses', { endpoint: '/api/courses' }, error as Error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}