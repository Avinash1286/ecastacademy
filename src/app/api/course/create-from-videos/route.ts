import { NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../convex/_generated/api';
import { Id } from '../../../../../convex/_generated/dataModel';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: Request) {
  try {
    const { courseName, courseDescription, videoIds, isCertification, passingGrade } = await request.json();

    if (!courseName || !videoIds || videoIds.length === 0) {
      return NextResponse.json(
        { error: 'Course name and at least one video are required' },
        { status: 400 }
      );
    }

    // Create the course
    const courseId = await convex.mutation(api.courses.createCourse, {
      name: courseName,
      description: courseDescription || '',
      isCertification: isCertification || false,
      passingGrade: passingGrade || 70,
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
        });

        // Create content item for the video
        await convex.mutation(api.contentItems.createContentItem, {
          chapterId: chapterId,
          type: 'video',
          title: video.title,
          order: 1, // First content item in the chapter
          videoId: videoId,
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
      });
    }

    return NextResponse.json({ 
      courseId,
      message: 'Course created successfully'
    });

  } catch (error) {
    console.error('[CREATE_COURSE_FROM_VIDEOS]', error);
    return NextResponse.json(
      { error: 'Failed to create course' },
      { status: 500 }
    );
  }
}
