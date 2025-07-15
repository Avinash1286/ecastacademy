import { relations, sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  json,
  uuid,
} from 'drizzle-orm/pg-core';

import { InferInsertModel } from 'drizzle-orm';

export type NewVideo = InferInsertModel<typeof videos>;
export type NewChapter = InferInsertModel<typeof chapters>;

export const videos = pgTable('videos', {

  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

  youtubeVideoId: varchar('youtube_video_id', { length: 255 }).notNull().unique(),

  title: varchar('title').notNull(),
  url: varchar('url').notNull(),
  thumbnailUrl: varchar('thumbnail_url', { length: 2048 }),
  channelTitle: varchar('channel_title', { length: 255 }),
  durationInSeconds: integer('duration_in_seconds'),
  publishedAt: timestamp('published_at'),
  
  transcript: text('transcript'),

  notes: json('notes').notNull(),
  quiz: json('quiz').notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const videosRelations = relations(videos, ({ many }) => ({
  chapters: many(chapters),
}));


export const courses = pgTable('courses', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const coursesRelations = relations(courses, ({ many }) => ({
  chapters: many(chapters),
}));

export const chapters = pgTable('chapters', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name').notNull(),
  order: integer('order').notNull(),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  videoId: uuid('video_id').notNull().references(() => videos.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const chaptersRelations = relations(chapters, ({ one }) => ({
  course: one(courses, {
    fields: [chapters.courseId],
    references: [courses.id],
  }),
  video: one(videos, {
    fields: [chapters.videoId],
    references: [videos.id],
  }),
}));