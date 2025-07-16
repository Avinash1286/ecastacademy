import { db } from "@/db";
import { generateNotes, generateQuiz } from "@/lib/services/aimodel";
import * as courseQueries from "@/db/queries/courseQueries";
import { validateAndCorrectJson } from "@/lib/utils";
import { TCreateCourseSchema } from "@/lib/validators/courseValidator";
import type { ChapterWithVideo } from "@/lib/types";
import type { TUpdateCourseSchema } from "@/lib/validators/courseValidator";
import type { Course } from "@/db/queries/courseQueries";
import type { CourseWithThumbnail } from "@/db/queries/courseQueries";

type ProgressCallback = (data: { message: string; progress: number; }) => void;

export async function createCourseWithProgress(
  courseData: TCreateCourseSchema,
  onProgress: ProgressCallback
): Promise<string> {
  const { title: courseTitle, description, videos: videoData } = courseData;

  onProgress({ message: "Creating course entry...", progress: 5 });
  const courseId = await courseQueries.createCourse(db, courseTitle, description);

  const totalVideos = videoData.length;
  for (const [index, video] of videoData.entries()) {
    const videoProgress = 10 + ((index + 1) / totalVideos) * 85;
    onProgress({
      message: `Processing video ${index + 1}/${totalVideos}: ${video.title}`,
      progress: videoProgress,
    });

    let videoId = await courseQueries.findVideoIdByYoutubeId(db, video.id);

    if (videoId) {
      onProgress({
        message: `Found existing data for: ${video.title}`,
        progress: videoProgress,
      });
    } else {
      onProgress({ message: `Generating notes for: ${video.title}`, progress: videoProgress });
      let notes = await generateNotes(video.transcript ?? "");
      notes = await validateAndCorrectJson(notes);

      onProgress({
        message: `Generating quiz for: ${video.title}`,
        progress: videoProgress + (5 / totalVideos),
      });
      let quiz = await generateQuiz(JSON.stringify(notes));
      quiz = await validateAndCorrectJson(quiz);

      videoId = await courseQueries.createVideo(db, {
        youtubeVideoId: video.id,
        title: video.title,
        url: video.url,
        thumbnailUrl: video.thumbnail,
        channelTitle: video.channelTitle,
        durationInSeconds: video.durationInSeconds,
        publishedAt: video.publishedAt ? new Date(video.publishedAt) : new Date(),
        transcript: video.transcript ?? "",
        notes: notes,
        quiz: quiz,
      });
    }

    await courseQueries.createChapter(db, {
      name: video.title,
      order: index + 1,
      courseId: courseId,
      videoId: videoId,
    });
  }

  return courseId;
}

export async function getCourseChapters(courseId: string): Promise<ChapterWithVideo[]> {
  const chapters = await courseQueries.getChaptersWithVideosByCourseId(courseId);
  return chapters;
}

export async function updateCourse(courseId: string, data: TUpdateCourseSchema): Promise<Course> {
  const updatedCourse = await courseQueries.updateCourseById(courseId, data);

  if (!updatedCourse) {
    throw new Error("Course not found");
  }

  return updatedCourse;
}

export async function deleteCourse(courseId: string): Promise<void> {
  const deleted = await courseQueries.deleteCourseById(courseId);

  if (!deleted) {
    throw new Error("Course not found");
  }
}

export async function getAllCoursesWithThumbnails(page: number, limit: number): Promise<CourseWithThumbnail[]> {
  const offset = (page - 1) * limit;
  const courses = await courseQueries.findAllCoursesWithFirstChapterThumbnail(limit, offset);
  return courses;
}