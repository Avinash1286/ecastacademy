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
    attempted: v.optional(v.boolean()),
    attemptedAt: v.optional(v.number()),

    // Grading and scoring fields
    isGradedItem: v.optional(v.boolean()), // Is this a graded item?
    score: v.optional(v.number()), // Score achieved (points)
    maxScore: v.optional(v.number()), // Maximum possible score
    percentage: v.optional(v.number()), // Score as percentage
    passed: v.optional(v.boolean()), // Did user pass this item?
    latestPassed: v.optional(v.boolean()), // Did the latest attempt pass?
    attempts: v.optional(v.number()), // Number of attempts
    bestScore: v.optional(v.number()), // Best score achieved across attempts
    lastAttemptAt: v.optional(v.number()), // Timestamp of last attempt
  })
    .index("by_userId_courseId", ["userId", "courseId"])
    .index("by_userId_contentItemId", ["userId", "contentItemId"])
    .index("by_userId_courseId_contentItemId", ["userId", "courseId", "contentItemId"])
    .index("by_courseId", ["courseId"]),

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

  chatSessions: defineTable({
    userId: v.id("users"),
    chatId: v.string(),
    chapterId: v.optional(v.string()),
    contentItemId: v.optional(v.string()),
    courseId: v.optional(v.string()),
    title: v.optional(v.string()),
    messages: v.optional(v.any()), // Deprecated: moving to messages table
    createdAt: v.number(),
    lastMessageAt: v.number(),
  })
    .index("by_userId_chatId", ["userId", "chatId"])
    .index("by_userId_lastMessageAt", ["userId", "lastMessageAt"]),

  messages: defineTable({
    sessionId: v.id("chatSessions"),
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    createdAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionId_createdAt", ["sessionId", "createdAt"]),

  // Capsule - AI-generated mini-courses from PDFs or topics
  capsules: defineTable({
    userId: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    userPrompt: v.optional(v.string()),

    // Source information
    sourceType: v.union(v.literal("pdf"), v.literal("topic")),
    sourcePdfStorageId: v.optional(v.id("_storage")), // Convex file storage ID for large PDFs
    sourcePdfData: v.optional(v.string()), // Legacy: Base64 PDF data (for small files < 1MB)
    sourcePdfName: v.optional(v.string()),
    sourcePdfMime: v.optional(v.string()),
    sourcePdfSize: v.optional(v.number()),
    sourceTopic: v.optional(v.string()), // User-entered topic

    // Generation status
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    errorMessage: v.optional(v.string()),

    // Metadata
    thumbnailUrl: v.optional(v.string()),
    estimatedDuration: v.optional(v.number()), // in minutes
    moduleCount: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_status", ["userId", "status"])
    .index("by_status", ["status"]),

  // Capsule modules - main sections of a capsule
  capsuleModules: defineTable({
    capsuleId: v.id("capsules"),
    title: v.string(),
    description: v.optional(v.string()),
    order: v.number(),

    createdAt: v.number(),
  })
    .index("by_capsuleId", ["capsuleId"])
    .index("by_capsuleId_order", ["capsuleId", "order"]),

  // Capsule lessons - individual interactive lessons
  capsuleLessons: defineTable({
    moduleId: v.id("capsuleModules"),
    capsuleId: v.id("capsules"),
    title: v.string(),
    description: v.optional(v.string()),
    order: v.number(),

    // Lesson type and content
    type: v.union(
      v.literal("concept"), // Concept explanation
      v.literal("mcq"), // Multiple choice quiz
      v.literal("dragDrop"), // Drag and drop activity
      v.literal("fillBlanks"), // Fill in the blanks
      v.literal("simulation"), // Interactive simulation (HTML/CSS/JS/p5.js)
      v.literal("mixed") // Mixed content with multiple types
    ),

    // Content structure (stored as JSON)
    content: v.any(), // Flexible JSON structure for different lesson types

    // Grading
    isGraded: v.optional(v.boolean()),
    maxPoints: v.optional(v.number()),

    createdAt: v.number(),
  })
    .index("by_moduleId", ["moduleId"])
    .index("by_moduleId_order", ["moduleId", "order"])
    .index("by_capsuleId", ["capsuleId"]),

  // Capsule progress tracking (includes quiz answer history)
  capsuleProgress: defineTable({
    userId: v.id("users"),
    capsuleId: v.id("capsules"),
    moduleId: v.optional(v.id("capsuleModules")),
    lessonId: v.optional(v.id("capsuleLessons")),

    completed: v.boolean(),
    completedAt: v.optional(v.number()),

    // For graded lessons
    score: v.optional(v.number()),
    maxScore: v.optional(v.number()),
    percentage: v.optional(v.number()),

    // Interaction data
    attempts: v.optional(v.number()),
    timeSpent: v.optional(v.number()), // seconds
    hintsUsed: v.optional(v.number()),

    // Quiz answer tracking - stores history of all attempts
    quizAnswers: v.optional(v.array(v.object({
      attemptNumber: v.number(),
      selectedAnswer: v.string(),
      selectedIndex: v.optional(v.number()),
      isCorrect: v.boolean(),
      timestamp: v.number(),
    }))),

    // Last quiz answer details (for quick access)
    lastAnswer: v.optional(v.object({
      selectedAnswer: v.string(),
      selectedIndex: v.optional(v.number()),
      correctAnswer: v.optional(v.string()),
      correctIndex: v.optional(v.number()),
      isCorrect: v.boolean(),
      options: v.optional(v.array(v.string())),
    })),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId_capsuleId", ["userId", "capsuleId"])
    .index("by_userId_lessonId", ["userId", "lessonId"])
    .index("by_capsuleId", ["capsuleId"]),

  capsuleGenerationRuns: defineTable({
    capsuleId: v.id("capsules"),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    stage: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    reviewJson: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_capsuleId", ["capsuleId"]),

  // AI Model Management
  aiModels: defineTable({
    name: v.string(), // Display name, e.g., "Gemini 1.5 Pro"
    provider: v.union(v.literal("google"), v.literal("openai")),
    modelId: v.string(), // The actual model string, e.g., "gemini-1.5-pro", "gpt-4o"
    isEnabled: v.boolean(),
    // Note: API Keys are stored in environment variables (GEMINI_API_KEY, OPENAI_API_KEY)
  })
    .index("by_provider", ["provider"])
    .index("by_isEnabled", ["isEnabled"]),

  aiFeatures: defineTable({
    key: v.string(), // Unique identifier, e.g., "tutor_chat", "capsule_generation"
    name: v.string(), // Display name
    description: v.optional(v.string()),
    currentModelId: v.id("aiModels"), // Reference to the active model
  })
    .index("by_key", ["key"]),

  // Rate limit buckets for DB-backed rate limiting
  rateLimitBuckets: defineTable({
    bucketKey: v.string(), // Unique identifier (e.g., "user:123", "global:api")
    maxRequests: v.number(), // Maximum requests allowed
    windowMs: v.number(), // Time window in milliseconds
    requests: v.array(v.number()), // Timestamps of recent requests
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_bucketKey", ["bucketKey"]),

  // Generation jobs for tracking capsule generation progress
  generationJobs: defineTable({
    capsuleId: v.id("capsules"),
    generationId: v.string(), // Unique generation ID
    
    // State machine state
    state: v.union(
      v.literal("idle"),
      v.literal("generating_outline"),
      v.literal("outline_complete"),
      v.literal("generating_lesson_plans"),
      v.literal("lesson_plans_complete"),
      v.literal("generating_content"),
      v.literal("content_complete"),
      v.literal("completed"),
      v.literal("failed")
    ),
    
    // Progress tracking
    outlineGenerated: v.boolean(),
    lessonPlansGenerated: v.number(),
    lessonsGenerated: v.number(),
    totalModules: v.number(),
    totalLessons: v.number(),
    currentModuleIndex: v.number(),
    currentLessonIndex: v.number(),
    
    // Timing
    startedAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
    
    // Error tracking
    lastError: v.optional(v.string()),
    lastErrorCode: v.optional(v.string()),
    retryCount: v.number(),
    
    // Token usage
    totalTokensUsed: v.number(),
    
    // Intermediate results (JSON stringified)
    outlineJson: v.optional(v.string()),
    lessonPlansJson: v.optional(v.string()),
    generatedContentJson: v.optional(v.string()), // Stores partially generated content for resumption
  })
    .index("by_capsuleId", ["capsuleId"])
    .index("by_generationId", ["generationId"])
    .index("by_state", ["state"]),

  // Generation metrics for observability
  generationMetrics: defineTable({
    generationId: v.string(),
    capsuleId: v.id("capsules"),
    
    // Stage metrics
    stage: v.string(),
    stageDurationMs: v.number(),
    stageTokensUsed: v.number(),
    stageSuccess: v.boolean(),
    stageError: v.optional(v.string()),
    
    // Request details
    provider: v.string(),
    model: v.string(),
    attempt: v.number(),
    
    // Timestamps
    startedAt: v.number(),
    completedAt: v.number(),
  })
    .index("by_generationId", ["generationId"])
    .index("by_capsuleId", ["capsuleId"])
    .index("by_stage", ["stage"])
    .index("by_provider", ["provider"]),
});
