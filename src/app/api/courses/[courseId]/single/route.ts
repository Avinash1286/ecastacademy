import { NextResponse } from 'next/server';
import { getCourseDetails } from '@/lib/services/courseService';

export async function GET(
  request: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    const { courseId } = params;
    const courseDetails = await getCourseDetails(courseId);

    if (!courseDetails) {
      return new NextResponse('Course not found', { status: 404 });
    }

    return NextResponse.json(courseDetails);
  } catch (error) {
    console.error('[GET_COURSE_DETAILS_API]', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}