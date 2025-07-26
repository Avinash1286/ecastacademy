import { NextResponse } from 'next/server';
import { db } from '@/db';
import { chapters, videos } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: Request,
  context: { params: Promise<{ courseId: string; chapterId: string }> }
) {
  try {
    const params = await context.params;
    const { chapterId } = params;

    const result = await db
      .select({
        notes: videos.notes,
        quiz: videos.quiz,
        transcript: videos.transcript,
      })
      .from(chapters)
      .innerJoin(videos, eq(chapters.videoId, videos.id))
      .where(eq(chapters.id, chapterId))
      .limit(1);

    if (result.length === 0) {
      return new NextResponse('Chapter not found', { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('[GET_CHAPTER_DETAILS_API_ERROR]', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}