import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    role: v.optional(v.union(v.literal("admin"), v.literal("user"))),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),
  authSessions: authTables.authSessions,
  authAccounts: authTables.authAccounts,
  authRefreshTokens: authTables.authRefreshTokens,
  authVerificationCodes: authTables.authVerificationCodes,
  authVerifiers: authTables.authVerifiers,
  authRateLimits: authTables.authRateLimits,

  // Videos table with processing status
  videos: defineTable({
    youtubeVideoId: v.string(),
    title: v.string(),
    url: v.string(),
    thumbnailUrl: v.optional(v.string()),
    channelTitle: v.optional(v.string()),
    durationInSeconds: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
    transcript: v.optional(v.string()),
    notes: v.any(), // JSON field for notes
    quiz: v.any(), // JSON field for quiz
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    )),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_youtubeVideoId", ["youtubeVideoId"])
    .index("by_status", ["status"]),

  // Courses table with flexible structure and status
  courses: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("draft"),
      v.literal("generating"),
      v.literal("ready"),
      v.literal("failed")
    )),
    createdBy: v.optional(v.string()), // User ID who created the course
    isPublished: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_createdBy", ["createdBy"]),

  // Chapters table
  chapters: defineTable({
    courseId: v.id("courses"),
    videoId: v.optional(v.id("videos")), // Backward compatibility - old system
    name: v.string(),
    description: v.optional(v.string()),
    order: v.number(),
    createdAt: v.number(),
  })
    .index("by_courseId", ["courseId"])
    .index("by_courseId_order", ["courseId", "order"])
    .index("by_videoId", ["videoId"]),

  // Content items - flexible content for chapters
  contentItems: defineTable({
    chapterId: v.id("chapters"),
    type: v.union(
      v.literal("video"),
      v.literal("text"),
      v.literal("quiz"),
      v.literal("assignment"),
      v.literal("resource")
    ),
    title: v.string(),
    order: v.number(),
    
    // For video type
    videoId: v.optional(v.id("videos")),
    
    // For text type
    textContent: v.optional(v.string()),
    textQuiz: v.optional(v.any()), // Quiz generated from text content
    textQuizStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    )),
    textQuizError: v.optional(v.string()),
    
    // For quiz type
    quizData: v.optional(v.any()),
    
    // For assignment type
    assignmentData: v.optional(v.any()),
    
    // For resource type
    resourceUrl: v.optional(v.string()),
    resourceTitle: v.optional(v.string()),
    
    createdAt: v.number(),
  })
    .index("by_chapterId", ["chapterId"])
    .index("by_chapterId_order", ["chapterId", "order"]),

  // User progress tracking
  progress: defineTable({
    userId: v.string(),
    courseId: v.id("courses"),
    chapterId: v.optional(v.id("chapters")),
    contentItemId: v.optional(v.id("contentItems")),
    completed: v.boolean(),
    completedAt: v.optional(v.number()),
    progressPercentage: v.optional(v.number()),
  })
    .index("by_userId_courseId", ["userId", "courseId"])
    .index("by_userId_contentItemId", ["userId", "contentItemId"]),
});
