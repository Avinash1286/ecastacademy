import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// =============================================================================
// TYPED QUIZ ANSWER SCHEMAS (Phase 1 - State Management Improvement)
// =============================================================================

/**
 * Schema for MCQ (Multiple Choice Question) answers
 * Stores both index and text for resilience against option order changes
 */
const mcqAnswerSchema = v.object({
  type: v.literal("mcq"),
  questionId: v.string(),
  selectedIndex: v.number(),
  selectedText: v.string(),
  correctIndex: v.number(),
  correctText: v.string(),
  isCorrect: v.boolean(),
  options: v.array(v.string()),
  timestamp: v.number(),
  timeSpentMs: v.optional(v.number()),
  hintUsed: v.optional(v.boolean()),
});

/**
 * Schema for individual blank answers within fill-in-the-blanks questions
 */
const blankAnswerSchema = v.object({
  blankId: v.string(),
  userAnswer: v.string(),
  correctAnswer: v.string(),
  alternatives: v.array(v.string()),
  isCorrect: v.boolean(),
  hintUsed: v.optional(v.boolean()),
});

/**
 * Schema for Fill-in-the-Blanks answers
 * Tracks each blank separately for detailed feedback
 */
const fillBlanksAnswerSchema = v.object({
  type: v.literal("fillBlanks"),
  questionId: v.string(),
  blanks: v.array(blankAnswerSchema),
  overallCorrect: v.boolean(),
  score: v.number(),
  timestamp: v.number(),
  timeSpentMs: v.optional(v.number()),
});

/**
 * Schema for individual placement results in drag-and-drop questions
 */
const placementResultSchema = v.object({
  itemId: v.string(),
  itemContent: v.string(),
  targetId: v.string(),
  targetLabel: v.string(),
  isCorrect: v.boolean(),
});

/**
 * Schema for Drag-and-Drop answers
 * Tracks each placement for detailed feedback
 */
const dragDropAnswerSchema = v.object({
  type: v.literal("dragDrop"),
  questionId: v.string(),
  placements: v.array(placementResultSchema),
  overallCorrect: v.boolean(),
  score: v.number(),
  timestamp: v.number(),
  timeSpentMs: v.optional(v.number()),
  shuffleSeed: v.optional(v.number()),
});

/**
 * Union schema for all quiz answer types
 * Use the `type` field as discriminator
 */
const typedQuizAnswerSchema = v.union(
  mcqAnswerSchema,
  fillBlanksAnswerSchema,
  dragDropAnswerSchema,
);

/**
 * Schema for attempt records in typed answer history
 */
const typedAttemptRecordSchema = v.object({
  attemptNumber: v.number(),
  answer: typedQuizAnswerSchema,
  timestamp: v.number(),
  timeSpentMs: v.number(),
});

/**
 * Schema for question state within mixed lessons
 */
const questionStateSchema = v.object({
  questionIndex: v.number(),
  questionType: v.union(
    v.literal("mcq"),
    v.literal("fillBlanks"),
    v.literal("dragDrop")
  ),
  answered: v.boolean(),
  answer: v.optional(typedQuizAnswerSchema),
});

/**
 * Schema for mixed lesson progress tracking
 */
const mixedLessonProgressSchema = v.object({
  currentQuestionIndex: v.number(),
  questionStates: v.array(questionStateSchema),
  allQuestionsAnswered: v.boolean(),
});

// =============================================================================
// DATABASE SCHEMA
// =============================================================================

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

    // Optimistic locking version field
    version: v.optional(v.number()), // Incremented on each update for conflict detection
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
    sourcePdfStorageId: v.optional(v.id("_storage")), // Convex file storage ID for PDFs
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
  // Capsule progress tracking (includes quiz answer history)
  capsuleProgress: defineTable({
    userId: v.id("users"),
    capsuleId: v.id("capsules"),
    moduleId: v.optional(v.id("capsuleModules")),
    lessonId: v.optional(v.id("capsuleLessons")),

    // Optimistic locking version for concurrent update protection
    version: v.optional(v.number()),

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

    // ==========================================================================
    // NEW: Typed Answer Storage (Phase 1 - State Management Improvement)
    // These fields use discriminated unions for type-safe answer storage
    // ==========================================================================
    
    /**
     * Type-safe last answer using discriminated union schema.
     * This replaces the legacy lastAnswer field with proper typing.
     * During migration, both fields are populated (dual-write).
     */
    typedLastAnswer: v.optional(typedQuizAnswerSchema),
    
    /**
     * Full attempt history with typed answers.
     * Each attempt stores the complete answer data for replay/analysis.
     */
    typedAttemptHistory: v.optional(v.array(typedAttemptRecordSchema)),
    
    /**
     * Progress state for mixed lessons.
     * Tracks per-question progress for lessons with multiple questions.
     */
    mixedLessonProgress: v.optional(mixedLessonProgressSchema),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId_capsuleId", ["userId", "capsuleId"])
    .index("by_userId_lessonId", ["userId", "lessonId"])
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
  // Module-wise pipeline: outline (1 call) + module content (1 call per module)
  generationJobs: defineTable({
    capsuleId: v.id("capsules"),
    generationId: v.string(), // Unique generation ID
    
    // Optimistic locking version for concurrent update protection
    // Optional to support existing documents created before this field was added
    version: v.optional(v.number()),
    
    // State machine state - uses string to allow dynamic states like "module_1_complete"
    // Stages: idle → generating_outline → outline_complete 
    //         → generating_module_content → module_X_complete → completed / failed
    state: v.string(),
    
    // For backwards compatibility, keep currentStage field as string
    currentStage: v.optional(v.string()),
    
    // Progress tracking
    outlineGenerated: v.boolean(),
    modulesGenerated: v.optional(v.number()), // Number of modules with content generated
    totalModules: v.number(),
    totalLessons: v.number(),
    currentModuleIndex: v.number(),
    
    // Legacy fields for backwards compatibility
    lessonPlansGenerated: v.number(),
    lessonsGenerated: v.number(),
    currentLessonIndex: v.number(),
    
    // Timing
    startedAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
    
    // Error tracking
    lastError: v.optional(v.string()),
    lastErrorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()), // Used by markGenerationFailed
    retryCount: v.number(),
    
    // Token usage
    totalTokensUsed: v.number(),
    
    // Intermediate results (JSON stringified)
    outlineJson: v.optional(v.string()),
    lessonPlansJson: v.optional(v.string()), // Legacy - module-wise doesn't use separate lesson plans
    modulesContentJson: v.optional(v.string()), // Stores module content as it's generated
    generatedContentJson: v.optional(v.string()), // Legacy - for backwards compatibility
    
    // Failed lesson tracking (P2 - Reliability)
    failedLessonIds: v.optional(v.array(v.string())),
    failedLessonCount: v.optional(v.number()),
    stallCount: v.optional(v.number()), // For health check tracking
  })
    .index("by_capsuleId", ["capsuleId"])
    .index("by_generationId", ["generationId"])
    .index("by_state", ["state"])
    .index("by_updatedAt", ["updatedAt"]), // For efficient stale job lookup

  // Dead letter queue for failed generations (retained for analysis)
  generationFailures: defineTable({
    generationId: v.string(),
    capsuleId: v.id("capsules"),
    userId: v.optional(v.id("users")),
    
    // Error details
    errorCode: v.string(),
    errorMessage: v.string(),
    
    // Context at failure time
    failedStage: v.string(),
    totalTokensUsed: v.number(),
    retryCount: v.number(),
    
    // Input snapshot (for debugging)
    inputSnapshot: v.optional(v.string()), // JSON stringified input (sanitized)
    
    // Resolution tracking
    resolved: v.boolean(),
    resolvedAt: v.optional(v.number()),
    resolution: v.optional(v.string()), // Notes about how it was resolved
    
    // Timestamps
    createdAt: v.number(),
  })
    .index("by_generationId", ["generationId"])
    .index("by_capsuleId", ["capsuleId"])
    .index("by_userId", ["userId"])
    .index("by_errorCode", ["errorCode"])
    .index("by_resolved", ["resolved"])
    .index("by_createdAt", ["createdAt"]),

  // =============================================================================
  // Audit Logs - Security and compliance tracking
  // =============================================================================
  auditLogs: defineTable({
    userId: v.id("users"),
    action: v.string(), // "capsule_generation_started", "capsule_generation_completed", etc.
    resourceType: v.string(), // "capsule", "lesson", "user"
    resourceId: v.string(), // ID of the affected resource
    
    // Additional context
    metadata: v.optional(v.any()), // Action-specific data (sanitized)
    
    // Request context (if available)
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    
    // Result
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
    
    // Timestamps
    timestamp: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_action", ["action"])
    .index("by_resourceType", ["resourceType"])
    .index("by_resourceId", ["resourceId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_userId_timestamp", ["userId", "timestamp"]),
});
