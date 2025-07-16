import { db } from "@/db";
import { courses, videos, chapters, NewVideo, NewChapter } from "@/db/schema";
import { ChapterWithVideo } from "@/lib/types";
import { sql, eq, and, desc, asc } from 'drizzle-orm';
import { getTableColumns, type InferSelectModel } from 'drizzle-orm';


import type { TUpdateCourseSchema } from "@/lib/validators/courseValidator";
type Transaction = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export type Course = {
  id: string;
  name: string;
  description: string | null;
}
export async function createCourse(tx: Transaction, name: string, description?: string): Promise<string> {
  const [newCourse] = await tx
    .insert(courses)
    .values({ name, description })
    .returning({ id: courses.id });
  return newCourse.id;
}

export async function findVideoIdByYoutubeId(tx: Transaction, youtubeVideoId: string): Promise<string | null> {
  const [existingVideo] = await tx
    .select({ id: videos.id })
    .from(videos)
    .where(eq(videos.youtubeVideoId, youtubeVideoId))
    .limit(1);
  return existingVideo?.id ?? null;
}

export async function createVideo(tx: Transaction, videoData: NewVideo): Promise<string> {
  const [newVideo] = await tx
    .insert(videos)
    .values(videoData)
    .returning({ id: videos.id });
  return newVideo.id;
}

export async function createChapter(tx: Transaction, chapterData: NewChapter): Promise<void> {
  await tx.insert(chapters).values(chapterData);
}


export async function getFullCourseChapters(courseId: string): Promise<ChapterWithVideo[]> {
  const courseChapters = await db
    .select({
      id: chapters.id,
      name: chapters.name,
      order: chapters.order,
      course: { 
        id: courses.id,
        name: courses.name,
        description: courses.description,
      },
      video: {
        videoId: videos.youtubeVideoId,
        title: videos.title,
        url: videos.url,
        thumbnailUrl: videos.thumbnailUrl,
        durationInSeconds: videos.durationInSeconds,
        notes: videos.notes, 
        quiz: videos.quiz,   
        transcript: videos.transcript
      },
    })
    .from(chapters)
    .where(eq(chapters.courseId, courseId))
    .innerJoin(videos, eq(chapters.videoId, videos.id))
    .innerJoin(courses, eq(chapters.courseId, courses.id)) 
    .orderBy(chapters.order);

  return courseChapters as ChapterWithVideo[];
}

export async function getChaptersWithVideosByCourseId(courseId: string): Promise<ChapterWithVideo[]> {
  const courseChapters = await db
    .select({
      id: chapters.id,
      name: chapters.name,
      order: chapters.order,
      course: { 
        id: courses.id,
        name: courses.name,
        description: courses.description,
      },
      video: { 
        videoId: videos.youtubeVideoId,
        title: videos.title,
        url: videos.url,
        thumbnailUrl: videos.thumbnailUrl,
        durationInSeconds: videos.durationInSeconds,
        notes: sql`'{}'::json`, 
        quiz: sql`'{}'::json`,   
        transcript: sql`''`      
      },
    })
    .from(chapters)
    .where(eq(chapters.courseId, courseId))
    .innerJoin(videos, eq(chapters.videoId, videos.id))
    .innerJoin(courses, eq(chapters.courseId, courses.id)) 
    .orderBy(chapters.order);

  return courseChapters as ChapterWithVideo[];
}




export async function updateCourseById(courseId: string, data: TUpdateCourseSchema): Promise<Course | null> {
  const [updatedCourse] = await db
    .update(courses)
    .set(data)
    .where(eq(courses.id, courseId))
    .returning({
      id: courses.id,
      name: courses.name,
      description: courses.description,
    });

  return updatedCourse || null;
}

export async function deleteCourseById(courseId: string): Promise<{ id: string } | null> {
  const [deletedCourse] = await db
    .delete(courses)
    .where(eq(courses.id, courseId))
    .returning({ id: courses.id });
    
  return deletedCourse || null;
}

export type CourseWithThumbnail = InferSelectModel<typeof courses> & {
  thumbnailUrl: string | null;
};

export async function findAllCoursesWithFirstChapterThumbnail(
  limit: number,
  offset: number
): Promise<CourseWithThumbnail[]> {
  const rankedChaptersSq = db
    .select({
      courseId: chapters.courseId,
      thumbnailUrl: videos.thumbnailUrl,
      rowNumber: sql<number>`row_number() over (partition by ${chapters.courseId} order by ${chapters.order} asc)`.as('rn'),
    })
    .from(chapters)
    .innerJoin(videos, eq(chapters.videoId, videos.id))
    .as('rankedChaptersSq'); 

  const coursesWithThumbnails = await db
    .select({
      ...getTableColumns(courses), 
      thumbnailUrl: rankedChaptersSq.thumbnailUrl,
    })
    .from(courses)
    .leftJoin(
      rankedChaptersSq,
      and(eq(courses.id, rankedChaptersSq.courseId), eq(rankedChaptersSq.rowNumber, 1)),
    )
    .orderBy(desc(courses.createdAt))
    .limit(limit)       
    .offset(offset);    

  return coursesWithThumbnails;
}

// Add this new function to find a single course with its thumbnail
export async function findCourseWithThumbnail(courseId: string) {
  const firstChapterSq = db
    .select({
      courseId: chapters.courseId,
      thumbnailUrl: videos.thumbnailUrl,
    })
    .from(chapters)
    .innerJoin(videos, eq(chapters.videoId, videos.id))
    .where(eq(chapters.courseId, courseId))
    .orderBy(asc(chapters.order))
    .limit(1)
    .as('firstChapterSq');

  const courseDetails = await db
    .select({
      id: courses.id,
      name: courses.name,
      description: courses.description,
      thumbnailUrl: firstChapterSq.thumbnailUrl,
    })
    .from(courses)
    .where(eq(courses.id, courseId))
    .leftJoin(firstChapterSq, eq(courses.id, firstChapterSq.courseId));
    
  return courseDetails[0] || null;
}

// Add this new function to get a list of chapters for a course
export async function findChaptersForCourse(courseId: string) {
  const chapterList = await db
    .select({
      id: chapters.id,
      name: chapters.name,
      order: chapters.order,
      durationInSeconds: videos.durationInSeconds,
    })
    .from(chapters)
    .innerJoin(videos, eq(chapters.videoId, videos.id))
    .where(eq(chapters.courseId, courseId))
    .orderBy(asc(chapters.order));
    
  return chapterList;
}