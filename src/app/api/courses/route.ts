import { NextResponse } from 'next/server';
import { getAllCoursesWithThumbnails } from '@/lib/services/courseService';

export const revalidate = 0; 

export async function GET() {
  try {
    
    const courses = await getAllCoursesWithThumbnails();

    return NextResponse.json(courses, { status: 200 });

  } catch (error) {
    console.error('[GET_COURSES_API]', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}