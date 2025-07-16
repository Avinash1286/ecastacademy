import { NextRequest, NextResponse } from 'next/server';
import { getAllCoursesWithThumbnails } from '@/lib/services/courseService';

export const revalidate = 0; 

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '9', 10);

    const courses = await getAllCoursesWithThumbnails(page, limit);

    return NextResponse.json(courses, { status: 200 });

  } catch (error) {
    console.error('[GET_COURSES_API]', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}