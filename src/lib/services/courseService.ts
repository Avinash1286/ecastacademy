import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { generateNotes, generateQuiz } from "@/lib/services/aimodel";
import { validateAndCorrectJson } from "@/lib/utils";
import { TCreateCourseSchema } from "@/lib/validators/courseValidator";
import type { TUpdateCourseSchema } from "@/lib/validators/courseValidator";
import { formatDuration } from "@/lib/youtube";
import type { ContentItem } from "@/lib/types";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

type Course = {
  _id: Id<"courses">;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
};

type ProgressCallback = (data: { message: string; progress: number; }) => void;

export async function createCourseWithProgress(
  courseData: TCreateCourseSchema,
  onProgress: ProgressCallback
): Promise<string> {
  const { title: courseTitle, description, videos: videoData } = courseData;

  onProgress({ message: "Creating course entry...", progress: 5 });
  const courseId = await convex.mutation(api.courses.createCourse, {
    name: courseTitle,
    description,
  });

  const totalVideos = videoData.length;
  for (const [index, video] of videoData.entries()) {
    const videoProgress = 10 + ((index + 1) / totalVideos) * 85;
    onProgress({
      message: `Processing video ${index + 1}/${totalVideos}: ${video.title}`,
      progress: videoProgress,
    });

    const existingVideo = await convex.query(api.videos.findVideoByYoutubeId, {
      youtubeVideoId: video.id,
    });

    let videoId: Id<"videos">;

    if (existingVideo) {
      onProgress({
        message: `Found existing data for: ${video.title}`,
        progress: videoProgress,
      });
      videoId = existingVideo._id;
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

      // Parse the JSON strings to objects before saving
      const notesObject = JSON.parse(notes);
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
    
    // Set course thumbnail from first video if not already set
    if (index === 0 && video.thumbnail) {
      await convex.mutation(api.courses.updateCourse, {
        id: courseId,
        thumbnailUrl: video.thumbnail,
      });
    }
  }

  onProgress({ message: "Course created successfully!", progress: 100 });
  return courseId;
}

type ChapterResponse = {
  id: string;
  name: string;
  order: number;
  course: {
    id: string;
    name: string;
    description: string | null;
  };
  contentItems?: ContentItem[];
  video: {
    videoId: string;
    title: string;
    url: string;
    thumbnailUrl?: string;
    durationInSeconds?: number;
  } | null;
};

export async function getCourseChapters(courseId: string): Promise<ChapterResponse[]> {
  // Validate courseId
  if (!courseId || courseId === 'undefined' || courseId === 'null') {
    throw new Error('Invalid course ID');
  }
  
  const chapters = await convex.query(api.courses.getChaptersWithVideosByCourseId, {
    courseId: courseId as Id<"courses">,
  });
  
  // Transform _id to id for frontend compatibility
  return chapters.map((chapter) => ({
    id: chapter.id,
    name: chapter.name,
    order: chapter.order,
    course: {
      id: chapter.course.id,
      name: chapter.course.name,
      description: chapter.course.description ?? null,
    },
    contentItems: chapter.contentItems, // Include content items!
    video: chapter.video,
  }));
}

export async function updateCourse(courseId: string, data: TUpdateCourseSchema): Promise<Course> {
  // Validate courseId
  if (!courseId || courseId === 'undefined' || courseId === 'null') {
    throw new Error('Invalid course ID');
  }
  
  const updatedCourse = await convex.mutation(api.courses.updateCourse, {
    id: courseId as Id<"courses">,
    ...data,
  });

  if (!updatedCourse) {
    throw new Error("Course not found");
  }

  return updatedCourse as Course;
}

export async function deleteCourse(courseId: string): Promise<void> {
  // Validate courseId
  if (!courseId || courseId === 'undefined' || courseId === 'null') {
    throw new Error('Invalid course ID');
  }
  
  const deleted = await convex.mutation(api.courses.deleteCourse, {
    id: courseId as Id<"courses">,
  });

  if (!deleted) {
    throw new Error("Course not found");
  }
}

type ConvexCourse = {
  _id: string;
  _creationTime: number;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  thumbnailUrl?: string | null;
};

export async function getAllCoursesWithThumbnails(page: number, limit: number): Promise<Array<{
  id: string;
  _id: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
  createdAt: string;
  updatedAt: string;
}>> {
  const offset = (page - 1) * limit;
  const courses = await convex.query(api.courses.getAllCourses, {
    limit,
    offset,
  });
  
  // Transform Convex _id to id for frontend compatibility
  return courses.map((course: ConvexCourse) => ({
    id: course._id,
    _id: course._id,
    name: course.name,
    description: course.description,
    thumbnailUrl: course.thumbnailUrl ?? undefined,
    createdAt: new Date(course.createdAt).toISOString(),
    updatedAt: new Date(course.updatedAt).toISOString(),
  }));
}

// Define the shape of the detailed chapter list for the response
interface CourseChapterDetails {
  id: string;
  name: string;
  order: number;
  duration: string;
}

// Add the new service function
export async function getCourseDetails(courseId: string) {
  // Validate courseId
  if (!courseId || courseId === 'undefined' || courseId === 'null') {
    return null;
  }
  
  // Fetch the main course details and the list of chapters
  const [course, chapters] = await Promise.all([
    convex.query(api.courses.getCourseWithThumbnail, {
      id: courseId as Id<"courses">,
    }),
    convex.query(api.courses.getChaptersForCourse, {
      courseId: courseId as Id<"courses">,
    }),
  ]);

  if (!course) {
    return null; // Course not found
  }

  type ChapterWithDuration = {
    _id?: string;
    id?: string;
    name: string;
    order: number;
    durationInSeconds: number | null;
  };

  // Format the duration for each chapter
  const formattedChapters: CourseChapterDetails[] = chapters.map((ch: ChapterWithDuration) => {
    // A little helper to convert seconds back to ISO duration string for formatDuration
    const toIsoDuration = (seconds: number | null) => {
      if (seconds === null) return 'PT0S';
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      return `PT${h > 0 ? h + 'H' : ''}${m > 0 ? m + 'M' : ''}${s}S`;
    }

    return {
      id: ch.id || ch._id || '', // Handle both id and _id
      name: ch.name,
      order: ch.order,
      duration: formatDuration(toIsoDuration(ch.durationInSeconds)),
    }
  });

  return {
    id: course._id, // Transform _id to id
    name: course.name,
    description: course.description,
    thumbnailUrl: course.thumbnailUrl,
    chapters: formattedChapters,
  };
}