import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users table for authentication
  users: defineTable({
    name: v.optional(v.string()),
    email: v.string(),
    emailVerified: v.optional(v.number()),
    image: v.optional(v.string()),
    password: v.optional(v.string()), // hashed password for email/password auth
    role: v.union(v.literal("user"), v.literal("admin")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"]),

  // Accounts table for OAuth linking
  accounts: defineTable({
    userId: v.id("users"),
    type: v.string(), // oauth, email, credentials
    provider: v.string(), // google, github, credentials
    providerAccountId: v.string(),
    refresh_token: v.optional(v.string()),
    access_token: v.optional(v.string()),
    expires_at: v.optional(v.number()),
    token_type: v.optional(v.string()),
    scope: v.optional(v.string()),
    id_token: v.optional(v.string()),
    session_state: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_provider_providerAccountId", ["provider", "providerAccountId"]),

  // Sessions table
  sessions: defineTable({
    sessionToken: v.string(),
    userId: v.id("users"),
    expires: v.number(),
  })
    .index("by_sessionToken", ["sessionToken"])
    .index("by_userId", ["userId"]),

  // Verification tokens for password reset and email verification
  verificationTokens: defineTable({
    identifier: v.string(), // email for password reset
    token: v.string(),
    expires: v.number(),
    type: v.union(v.literal("passwordReset"), v.literal("emailVerification")),
  })
    .index("by_identifier", ["identifier"])
    .index("by_token", ["token"]),

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
    
    // Certification and grading fields
    isCertification: v.optional(v.boolean()), // Is this a certification course?
    passingGrade: v.optional(v.number()), // Minimum grade to pass (default: 70)
    certificateTemplate: v.optional(v.string()), // Template for certificate
    
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
    
    // Grading fields
    isGraded: v.optional(v.boolean()), // Is this item graded?
    maxPoints: v.optional(v.number()), // Maximum points for graded items
    passingScore: v.optional(v.number()), // Minimum score to pass (percentage)
    allowRetakes: v.optional(v.boolean()), // Allow multiple attempts
    
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
    userId: v.id("users"), // Updated to reference users table
    courseId: v.id("courses"),
    chapterId: v.optional(v.id("chapters")),
    contentItemId: v.optional(v.id("contentItems")),
    completed: v.boolean(),
    completedAt: v.optional(v.number()),
    progressPercentage: v.optional(v.number()),
    
    // Grading and scoring fields
    isGradedItem: v.optional(v.boolean()), // Is this a graded item?
    score: v.optional(v.number()), // Score achieved (points)
    maxScore: v.optional(v.number()), // Maximum possible score
    percentage: v.optional(v.number()), // Score as percentage
    passed: v.optional(v.boolean()), // Did user pass this item?
    attempts: v.optional(v.number()), // Number of attempts
    bestScore: v.optional(v.number()), // Best score achieved across attempts
    lastAttemptAt: v.optional(v.number()), // Timestamp of last attempt
  })
    .index("by_userId_courseId", ["userId", "courseId"])
    .index("by_userId_contentItemId", ["userId", "contentItemId"])
    .index("by_userId_courseId_contentItemId", ["userId", "courseId", "contentItemId"]),

  // Certificates table
  certificates: defineTable({
    userId: v.id("users"),
    courseId: v.id("courses"),
    certificateId: v.string(), // Unique certificate ID
    
    // Certificate details
    courseName: v.string(),
    userName: v.string(),
    completionDate: v.number(),
    overallGrade: v.number(), // Overall grade percentage
    
    // Certificate data
    certificateUrl: v.optional(v.string()), // Generated certificate PDF/image
    issuedAt: v.number(),
    
    // Metadata
    totalGradedItems: v.number(),
    passedItems: v.number(),
    averageScore: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_courseId", ["courseId"])
    .index("by_certificateId", ["certificateId"])
    .index("by_userId_courseId", ["userId", "courseId"]),

  // Quiz attempts tracking
  quizAttempts: defineTable({
    userId: v.id("users"),
    contentItemId: v.id("contentItems"),
    courseId: v.id("courses"),
    
    // Attempt details
    attemptNumber: v.number(),
    answers: v.any(), // User's answers
    score: v.number(), // Points scored
    maxScore: v.number(), // Maximum possible score
    percentage: v.number(), // Score as percentage
    passed: v.boolean(), // Did this attempt pass?
    
    // Timing
    startedAt: v.number(),
    completedAt: v.number(),
    timeSpent: v.number(), // Seconds spent on quiz
  })
    .index("by_userId_contentItemId", ["userId", "contentItemId"])
    .index("by_userId_courseId", ["userId", "courseId"])
    .index("by_contentItemId", ["contentItemId"]),

  // Enrollments table - tracks which users are enrolled in which courses
  enrollments: defineTable({
    userId: v.id("users"),
    courseId: v.id("courses"),
    enrolledAt: v.number(),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("dropped")
    ),
    completedAt: v.optional(v.number()),
    lastAccessedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_courseId", ["courseId"])
    .index("by_userId_courseId", ["userId", "courseId"])
    .index("by_status", ["status"]),
});
