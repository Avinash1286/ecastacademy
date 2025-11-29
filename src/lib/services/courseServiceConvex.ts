import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { generateNotes, generateQuiz } from "@/lib/services/aimodel";
import { validateAndCorrectJson } from "@/lib/utils";
import { TCreateCourseSchema, TUpdateCourseSchema } from "@/lib/validators/courseValidator";
import { formatDuration } from "@/lib/youtube";
import { createConvexClient } from "@/lib/convexClient";
import {
  generatedQuizSchema,
  generatedQuizSchemaDescription,
  interactiveNotesSchema,
  interactiveNotesSchemaDescription,
} from "@/lib/validators/generatedContentSchemas";
import { resolveWithConvexClient } from "@shared/ai/modelResolver";

const convex = createConvexClient();

type ProgressCallback = (data: { message: string; progress: number }) => void;

export async function createCourseWithProgress(
  courseData: TCreateCourseSchema,
  onProgress: ProgressCallback
): Promise<string> {
  const { title: courseTitle, description, videos: videoData } = courseData;

  onProgress({ message: "Creating course entry...", progress: 5 });
  const courseId = await convex.mutation(api.courses.createCourse, {
    name: courseTitle,
    description: description,
  });

  const [notesModelConfig, quizModelConfig] = await Promise.all([
    resolveWithConvexClient(convex, "notes_generation"),
    resolveWithConvexClient(convex, "quiz_generation"),
  ]);

  const totalVideos = videoData.length;
  for (const [index, video] of videoData.entries()) {
    const videoProgress = 10 + ((index + 1) / totalVideos) * 85;
    onProgress({
      message: `Processing video ${index + 1}/${totalVideos}: ${video.title}`,
      progress: videoProgress,
    });

    // Check if video already exists
    const existingVideo = await convex.query(api.videos.findVideoByYoutubeId, {
      youtubeVideoId: video.id,
    });

    let videoId: Id<"videos">;

    if (existingVideo) {
      videoId = existingVideo._id;
      onProgress({
        message: `Found existing data for: ${video.title}`,
        progress: videoProgress,
      });
    } else {
      onProgress({ message: `Generating notes for: ${video.title}`, progress: videoProgress });
      let notes = await generateNotes(video.transcript ?? "", {
        videoTitle: video.title,
        modelConfig: notesModelConfig,
      });
      notes = await validateAndCorrectJson(notes, {
        schema: interactiveNotesSchema,
        schemaName: "InteractiveNotes",
        schemaDescription: interactiveNotesSchemaDescription,
        originalInput: video.transcript ?? "",
        format: "interactive-notes",
        modelConfig: notesModelConfig,
      });
      const notesObject = JSON.parse(notes);

      onProgress({
        message: `Generating quiz for: ${video.title}`,
        progress: videoProgress + 5 / totalVideos,
      });
      const notesContext = JSON.stringify(notesObject);
      let quiz = await generateQuiz(notesContext, quizModelConfig);
      quiz = await validateAndCorrectJson(quiz, {
        schema: generatedQuizSchema,
        schemaName: "InteractiveQuiz",
        schemaDescription: generatedQuizSchemaDescription,
        originalInput: notesContext,
        format: "interactive-quiz",
        modelConfig: quizModelConfig,
      });
      const quizObject = JSON.parse(quiz);

      videoId = await convex.mutation(api.videos.createVideo, {
        youtubeVideoId: video.id,
        title: video.title,
        url: video.url,
        thumbnailUrl: video.thumbnail,
        channelTitle: video.channelTitle,
        durationInSeconds: video.durationInSeconds,
        publishedAt: video.publishedAt ? new Date(video.publishedAt).getTime() : Date.now(),
        transcript: video.transcript ?? "",
        notes: notesObject,
        quiz: quizObject,
      });
    }

    await convex.mutation(api.chapters.createChapter, {
      name: video.title,
      order: index + 1,
      courseId: courseId,
      videoId: videoId,
    });
  }

  return courseId;
}

export async function getCourseChapters(courseId: Id<"courses">) {
  const chapters = await convex.query(api.courses.getChaptersWithVideosByCourseId, {
    courseId: courseId,
  });
  return chapters;
}

export async function updateCourse(courseId: Id<"courses">, data: TUpdateCourseSchema) {
  const updatedCourse = await convex.mutation(api.courses.updateCourse, {
    id: courseId,
    ...data,
  });

  if (!updatedCourse) {
    throw new Error("Course not found");
  }

  return updatedCourse;
}

export async function deleteCourse(courseId: Id<"courses">): Promise<void> {
  await convex.mutation(api.courses.deleteCourse, {
    id: courseId,
  });
}

/**
 * Get course ownership information for authorization checks
 * Returns the createdBy field to verify if a user owns a course
 */
export async function getCourseOwnership(courseId: Id<"courses">): Promise<{ createdBy: string | null } | null> {
  const course = await convex.query(api.courses.getCourseOwnership, {
    id: courseId,
  });
  return course;
}

export async function getAllCoursesWithThumbnails(
  limit: number,
  cursor?: string
) {
  const result = await convex.query(api.courses.getAllCourses, {
    limit: limit,
    cursor: cursor,
  });
  
  // Transform Convex _id to id for frontend compatibility
  type ConvexCourse = {
    _id: string;
    _creationTime: number;
    name: string;
    description?: string;
    createdAt: number;
    thumbnailUrl?: string | null;
  };
  
  const courses = result.courses.map((course: ConvexCourse) => ({
    ...course,
    id: course._id,
    createdAt: new Date(course.createdAt).toISOString(),
  }));
  
  return {
    courses,
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
  };
}

interface CourseChapterDetails {
  id: string;
  name: string;
  order: number;
  duration: string;
}

export async function getCourseDetails(courseId: Id<"courses">) {
  const [course, chapterList] = await Promise.all([
    convex.query(api.courses.getCourseWithThumbnail, { id: courseId }),
    convex.query(api.courses.getChaptersForCourse, { courseId: courseId }),
  ]);

  if (!course) {
    return null;
  }

  const formattedChapters: CourseChapterDetails[] = chapterList.map((ch) => {
    const toIsoDuration = (seconds: number | null) => {
      if (seconds === null) return "PT0S";
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      return `PT${h > 0 ? h + "H" : ""}${m > 0 ? m + "M" : ""}${s}S`;
    };

    return {
      id: ch.id as string,
      name: ch.name,
      order: ch.order,
      duration: formatDuration(toIsoDuration(ch.durationInSeconds)),
    };
  });

  return {
    id: course._id, // Transform _id to id for frontend
    name: course.name,
    description: course.description,
    thumbnailUrl: course.thumbnailUrl,
    chapters: formattedChapters,
  };
}
