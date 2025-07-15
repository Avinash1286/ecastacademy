import { z } from "zod";

const VideoSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().url(),
  thumbnail: z.string().url(),
  channelTitle: z.string(),
  durationInSeconds: z.number().int().positive(),
  publishedAt: z.string().datetime().optional(),
  transcript: z.string().optional(),
});

export const CreateCourseSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters long."),
  description: z.string().optional(),
  videos: z.array(VideoSchema).min(1, "At least one video is required."),
});

export type TCreateCourseSchema = z.infer<typeof CreateCourseSchema>;


export const UpdateCourseSchema = z.object({
  name: z.string().min(3, "Title must be at least 3 characters long.").optional(),
  description: z.string().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one field (name or description) must be provided for an update."
});

export type TUpdateCourseSchema = z.infer<typeof UpdateCourseSchema>;