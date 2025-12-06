import { NextRequest, NextResponse } from 'next/server';
import { api } from '../../../../../convex/_generated/api';
import { Id } from '../../../../../convex/_generated/dataModel';
import { createConvexClient } from '@/lib/convexClient';
import { auth } from '@/lib/auth/auth.config';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/security/rateLimit';
import { logger } from '@/lib/logging/logger';

const convex = createConvexClient();

export async function POST(request: NextRequest) {
  // Apply rate limiting for course creation
  const rateLimitResponse = await withRateLimit(request, RATE_LIMIT_PRESETS.COURSE_CREATE);
  if (rateLimitResponse) return rateLimitResponse;

  // Require authentication for course creation
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 }
    );
  }

  try {
    const { courseName, courseDescription, videoIds, isCertification, passingGrade } = body;

    if (!courseName || !videoIds || videoIds.length === 0) {
      return NextResponse.json(
        { error: 'Course name and at least one video are required' },
        { status: 400 }
      );
    }

    const currentUserId = session.user.id as Id<'users'>;

    // Create the course
    const courseId = await convex.mutation(api.courses.createCourse, {
      name: courseName,
      description: courseDescription || '',
      isCertification: isCertification || false,
      passingGrade: passingGrade || 70,
      currentUserId,
    });

    // Create chapters from videos (each video = one chapter)
    for (let index = 0; index < videoIds.length; index++) {
      const videoId = videoIds[index] as Id<'videos'>;
      
      // Get video details to use title as chapter name
      const video = await convex.query(api.videos.getVideoById, { id: videoId });
      
      if (video) {
        // Create chapter
        const chapterId = await convex.mutation(api.chapters.createChapter, {
          name: video.title,
          order: index + 1,
          courseId: courseId,
          videoId: videoId, // Keep for backward compatibility
          currentUserId,
        });

        // Create content item for the video
        await convex.mutation(api.contentItems.createContentItem, {
          chapterId: chapterId,
          type: 'video',
          title: video.title,
          order: 1, // First content item in the chapter
          videoId: videoId,
          currentUserId,
        });
      }
    }

    // Set course thumbnail from first video
    const firstVideo = await convex.query(api.videos.getVideoById, { 
      id: videoIds[0] as Id<'videos'> 
    });
    
    if (firstVideo?.thumbnailUrl) {
      await convex.mutation(api.courses.updateCourse, {
        id: courseId,
        thumbnailUrl: firstVideo.thumbnailUrl,
        currentUserId,
      });
    }

    return NextResponse.json({ 
      courseId,
      message: 'Course created successfully'
    });

  } catch (error) {
    logger.error('Failed to create course from videos', { userId: session.user.id }, error as Error);
    return NextResponse.json(
      { error: 'Failed to create course' },
      { status: 500 }
    );
  }
}
