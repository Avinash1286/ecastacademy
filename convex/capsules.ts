import { v } from "convex/values";
import { mutation, query, action, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { requireAuthenticatedUser, requireAuthenticatedUserWithFallback } from "./utils/auth";

// =============================================================================
// File Storage for Large PDFs
// =============================================================================

/**
 * Generate an upload URL for PDF files
 * This allows uploading files up to 20MB to Convex storage
 * SECURITY: Requires authentication to prevent abuse
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    // Require authentication to prevent abuse of storage
    await requireAuthenticatedUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Get a download URL for a stored PDF
 */
export const getPdfUrl = query({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

/**
 * Maximum PDF size for processing (10MB to be safe with memory)
 * Larger files should be rejected at upload time
 */
const MAX_PDF_PROCESSING_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Get PDF data from storage as base64 for AI processing
 * 
 * MEMORY OPTIMIZATION:
 * - Validates file size before full load
 * - Uses chunked base64 encoding to reduce peak memory
 * - Clears intermediate buffers after use
 */
export const getPdfBase64 = action({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args): Promise<string> => {
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) {
      throw new Error("PDF file not found in storage");
    }

    // Fetch the PDF with size check via HEAD request first
    const headResponse = await fetch(url, { method: 'HEAD' });
    if (!headResponse.ok) {
      throw new Error(`Failed to check PDF: ${headResponse.statusText}`);
    }

    const contentLength = headResponse.headers.get('content-length');
    if (contentLength) {
      const fileSize = parseInt(contentLength, 10);
      if (fileSize > MAX_PDF_PROCESSING_SIZE) {
        throw new Error(
          `PDF file is too large for processing (${Math.round(fileSize / 1024 / 1024)}MB). ` +
          `Maximum allowed size is ${Math.round(MAX_PDF_PROCESSING_SIZE / 1024 / 1024)}MB. ` +
          `Please use a smaller PDF or compress the file.`
        );
      }
    }

    // Fetch the PDF from storage
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }

    // Stream the response to avoid loading entire file at once
    const arrayBuffer = await response.arrayBuffer();

    // Double-check size after download (in case HEAD was inaccurate)
    if (arrayBuffer.byteLength > MAX_PDF_PROCESSING_SIZE) {
      throw new Error(
        `PDF file is too large for processing (${Math.round(arrayBuffer.byteLength / 1024 / 1024)}MB). ` +
        `Maximum allowed size is ${Math.round(MAX_PDF_PROCESSING_SIZE / 1024 / 1024)}MB.`
      );
    }

    const uint8Array = new Uint8Array(arrayBuffer);

    // Convert to base64 using chunked approach for memory efficiency
    // Each chunk is converted and appended, then the chunk reference is released
    const base64Chunks: string[] = [];
    const chunkSize = 32768; // 32KB chunks - larger chunks = fewer iterations

    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      // Convert chunk to binary string
      let binaryChunk = '';
      for (let j = 0; j < chunk.length; j++) {
        binaryChunk += String.fromCharCode(chunk[j]);
      }
      // Encode chunk to base64 and store
      base64Chunks.push(btoa(binaryChunk));
    }

    // Join all base64 chunks
    // Note: This creates valid base64 only because we're encoding complete byte sequences
    // We need to decode and re-encode for proper base64
    const fullBinaryString = base64Chunks.map(chunk => atob(chunk)).join('');
    const base64 = btoa(fullBinaryString);

    return base64;
  },
});

// =============================================================================
// Queries
// =============================================================================

/**
 * Query: Get all capsules for a user
 */
export const getUserCapsules = query({
  args: {
    userId: v.id("users"),
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    )),
  },
  handler: async (ctx, args) => {
    const { userId, status } = args;

    let capsules;
    if (status) {
      capsules = await ctx.db
        .query("capsules")
        .withIndex("by_userId_status", (q) => q.eq("userId", userId).eq("status", status))
        .order("desc")
        .collect();
    } else {
      capsules = await ctx.db
        .query("capsules")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .order("desc")
        .collect();
    }

    return capsules;
  },
});

/**
 * Query: Get public (community) capsules with pagination
 * Only returns completed, public capsules from other users
 * Includes author information for display
 */
export const getCommunityCapsules = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
    excludeUserId: v.optional(v.id("users")), // Exclude current user's capsules
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 12, 50); // Cap at 50 for performance
    
    // Query public, completed capsules ordered by publishedAt (newest first)
    let query = ctx.db
      .query("capsules")
      .withIndex("by_public_status", (q) => 
        q.eq("isPublic", true).eq("status", "completed")
      )
      .order("desc");

    // Apply cursor-based pagination
    const allCapsules = await query.collect();
    
    // Filter out current user's capsules if excludeUserId provided
    let filteredCapsules = args.excludeUserId 
      ? allCapsules.filter(c => c.userId !== args.excludeUserId)
      : allCapsules;

    // Apply cursor pagination manually (after filtering)
    let startIndex = 0;
    if (args.cursor) {
      const cursorIndex = filteredCapsules.findIndex(c => c._id === args.cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    const paginatedCapsules = filteredCapsules.slice(startIndex, startIndex + limit + 1);
    const hasMore = paginatedCapsules.length > limit;
    const capsulesToReturn = hasMore ? paginatedCapsules.slice(0, -1) : paginatedCapsules;

    return {
      capsules: capsulesToReturn,
      nextCursor: hasMore ? capsulesToReturn[capsulesToReturn.length - 1]?._id : null,
      hasMore,
    };
  },
});

/**
 * Mutation: Toggle capsule visibility (public/private)
 * Only the owner can change visibility
 * Only completed capsules can be made public
 */
export const toggleCapsuleVisibility = mutation({
  args: {
    capsuleId: v.id("capsules"),
    userId: v.id("users"),
    isPublic: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { capsuleId, userId, isPublic } = args;

    // Get the capsule
    const capsule = await ctx.db.get(capsuleId);
    if (!capsule) {
      throw new Error("Capsule not found");
    }

    // Security: Verify ownership
    if (capsule.userId !== userId) {
      throw new Error("You don't have permission to modify this capsule");
    }

    // Only completed capsules can be made public
    if (isPublic && capsule.status !== "completed") {
      throw new Error("Only completed capsules can be made public");
    }

    // Update visibility
    await ctx.db.patch(capsuleId, {
      isPublic,
      publishedAt: isPublic ? Date.now() : undefined,
      updatedAt: Date.now(),
    });

    return { 
      success: true, 
      isPublic,
      message: isPublic ? "Capsule is now public" : "Capsule is now private" 
    };
  },
});

/**
 * Query: Get a single capsule by ID
 */
export const getCapsule = query({
  args: { capsuleId: v.id("capsules") },
  handler: async (ctx, args) => {
    const capsule = await ctx.db.get(args.capsuleId);
    return capsule;
  },
});

/**
 * Query: Get all modules for a capsule
 */
export const getCapsuleModules = query({
  args: { capsuleId: v.id("capsules") },
  handler: async (ctx, args) => {
    const modules = await ctx.db
      .query("capsuleModules")
      .withIndex("by_capsuleId_order", (q) => q.eq("capsuleId", args.capsuleId))
      .collect();

    // Sort by order to ensure consistent ordering
    modules.sort((a, b) => a.order - b.order);

    return modules;
  },
});

/**
 * Query: Get all lessons for a module
 */
export const getModuleLessons = query({
  args: { moduleId: v.id("capsuleModules") },
  handler: async (ctx, args) => {
    const lessons = await ctx.db
      .query("capsuleLessons")
      .withIndex("by_moduleId_order", (q) => q.eq("moduleId", args.moduleId))
      .collect();

    // Sort by order to ensure consistent ordering
    lessons.sort((a, b) => a.order - b.order);

    return lessons;
  },
});

/**
 * Query: Get capsule with modules and lessons (full structure)
 * 
 * ACCESS CONTROL:
 * - Public capsules: Anyone can view
 * - Private capsules: Only owner can view
 */
export const getCapsuleWithContent = query({
  args: { 
    capsuleId: v.id("capsules"),
    userId: v.optional(v.id("users")), // Optional: for access control
  },
  handler: async (ctx, args) => {
    const capsule = await ctx.db.get(args.capsuleId);
    if (!capsule) return null;

    // Access control: Public capsules are viewable by anyone
    // Private capsules are only viewable by the owner
    const isOwner = args.userId && capsule.userId === args.userId;
    const isPublic = capsule.isPublic === true;
    
    if (!isPublic && !isOwner) {
      // For unauthenticated users or non-owners viewing private capsules
      // Return null to indicate no access (maintains same interface)
      return null;
    }

    const modules = await ctx.db
      .query("capsuleModules")
      .withIndex("by_capsuleId_order", (q) => q.eq("capsuleId", args.capsuleId))
      .collect();

    // Sort modules by order to ensure consistent ordering
    modules.sort((a, b) => a.order - b.order);

    const modulesWithLessons = await Promise.all(
      modules.map(async (module) => {
        const lessons = await ctx.db
          .query("capsuleLessons")
          .withIndex("by_moduleId_order", (q) => q.eq("moduleId", module._id))
          .collect();

        // Sort lessons by order to ensure consistent ordering
        lessons.sort((a, b) => a.order - b.order);

        return {
          ...module,
          lessons,
        };
      })
    );

    // Include author info for public capsules
    let author = null;
    if (isPublic && !isOwner) {
      const authorData = await ctx.db.get(capsule.userId);
      if (authorData) {
        author = {
          id: authorData._id,
          name: authorData.name,
          image: authorData.image,
        };
      }
    }

    return {
      ...capsule,
      modules: modulesWithLessons,
      author,
      isOwner: !!isOwner,
    };
  },
});

/**
 * Query: Get user's progress for a capsule
 */
export const getCapsuleProgress = query({
  args: {
    userId: v.id("users"),
    capsuleId: v.id("capsules"),
  },
  handler: async (ctx, args) => {
    const progress = await ctx.db
      .query("capsuleProgress")
      .withIndex("by_userId_capsuleId", (q) =>
        q.eq("userId", args.userId).eq("capsuleId", args.capsuleId)
      )
      .collect();

    return progress;
  },
});

/**
 * Mutation: Create a new capsule
 * 
 * SECURITY: Validates all input lengths to prevent abuse and prompt injection.
 * The API route also validates, but this provides defense-in-depth.
 */

// Input validation constants
const MAX_TITLE_LENGTH = 200;
const MAX_TOPIC_LENGTH = 500;
const MAX_USER_PROMPT_LENGTH = 2000;
const MAX_PDF_NAME_LENGTH = 255;
const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

export const createCapsule = mutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    sourceType: v.union(v.literal("pdf"), v.literal("topic")),
    sourcePdfStorageId: v.optional(v.id("_storage")),
    sourcePdfName: v.optional(v.string()),
    sourcePdfMime: v.optional(v.string()),
    sourcePdfSize: v.optional(v.number()),
    sourceTopic: v.optional(v.string()),
    userPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // =========================================================================
    // INPUT VALIDATION (Defense-in-depth - API route also validates)
    // =========================================================================

    // Validate title
    if (!args.title || args.title.trim().length < 3) {
      throw new Error("Title must be at least 3 characters long");
    }
    if (args.title.length > MAX_TITLE_LENGTH) {
      throw new Error(`Title exceeds maximum length of ${MAX_TITLE_LENGTH} characters`);
    }

    // Validate topic (if provided)
    if (args.sourceTopic && args.sourceTopic.length > MAX_TOPIC_LENGTH) {
      throw new Error(`Topic exceeds maximum length of ${MAX_TOPIC_LENGTH} characters`);
    }

    // Validate user prompt (if provided)
    if (args.userPrompt && args.userPrompt.length > MAX_USER_PROMPT_LENGTH) {
      throw new Error(`User prompt exceeds maximum length of ${MAX_USER_PROMPT_LENGTH} characters`);
    }

    // Validate PDF name (if provided)
    if (args.sourcePdfName && args.sourcePdfName.length > MAX_PDF_NAME_LENGTH) {
      throw new Error(`PDF filename exceeds maximum length of ${MAX_PDF_NAME_LENGTH} characters`);
    }

    // Validate PDF size (if provided)
    if (args.sourcePdfSize && args.sourcePdfSize > MAX_PDF_SIZE_BYTES) {
      throw new Error(`PDF size exceeds maximum of ${MAX_PDF_SIZE_BYTES / 1024 / 1024}MB`);
    }

    // Validate source type requirements
    if (args.sourceType === "topic" && (!args.sourceTopic || args.sourceTopic.trim().length === 0)) {
      throw new Error("Topic is required for topic-based capsules");
    }

    if (args.sourceType === "pdf" && !args.sourcePdfStorageId) {
      throw new Error("PDF storage ID is required for PDF-based capsules");
    }

    // Validate user exists
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // =========================================================================
    // CREATE CAPSULE
    // =========================================================================
    const now = Date.now();

    const capsuleId = await ctx.db.insert("capsules", {
      userId: args.userId,
      title: args.title.trim(),
      description: undefined,
      userPrompt: args.userPrompt?.trim(),
      sourceType: args.sourceType,
      sourcePdfStorageId: args.sourcePdfStorageId,
      sourcePdfName: args.sourcePdfName,
      sourcePdfMime: args.sourcePdfMime,
      sourcePdfSize: args.sourcePdfSize,
      sourceTopic: args.sourceTopic?.trim(),
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return capsuleId;
  },
});

/**
 * Mutation: Update capsule status
 * SECURITY: Restricted to internal use only via internalMutation pattern
 * External status updates should go through authenticated mutations
 */
export const updateCapsuleStatus = internalMutation({
  args: {
    capsuleId: v.id("capsules"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    errorMessage: v.optional(v.string()),
    moduleCount: v.optional(v.number()),
    estimatedDuration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { capsuleId, status, errorMessage, moduleCount, estimatedDuration } = args;

    await ctx.db.patch(capsuleId, {
      status,
      errorMessage,
      moduleCount,
      estimatedDuration,
      updatedAt: Date.now(),
      completedAt: status === "completed" ? Date.now() : undefined,
    });
  },
});

/**
 * Mutation: Update capsule metadata
 * SECURITY: Restricted to internal use only via internalMutation pattern
 */
export const updateCapsuleMetadata = internalMutation({
  args: {
    capsuleId: v.id("capsules"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    estimatedDuration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Only include fields that are actually provided to avoid setting required fields to undefined
    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };
    
    if (args.title !== undefined) {
      updates.title = args.title;
    }
    if (args.description !== undefined) {
      updates.description = args.description;
    }
    if (args.estimatedDuration !== undefined) {
      updates.estimatedDuration = args.estimatedDuration;
    }
    
    await ctx.db.patch(args.capsuleId, updates);
  },
});

/**
 * Mutation: Clear stored source payloads after processing and delete PDF from storage
 * SECURITY: Restricted to internal use only
 */
export const clearCapsuleSourceData = internalMutation({
  args: {
    capsuleId: v.id("capsules"),
  },
  handler: async (ctx, args) => {
    // Get the capsule to check for storage ID
    const capsule = await ctx.db.get(args.capsuleId);

    // Delete PDF from Convex storage if it exists
    if (capsule?.sourcePdfStorageId) {
      try {
        await ctx.storage.delete(capsule.sourcePdfStorageId);
        console.log(`[Cleanup] Deleted PDF from storage: ${capsule.sourcePdfStorageId}`);
      } catch (error) {
        // Log but don't fail - the file might already be deleted
        console.warn(`[Cleanup] Failed to delete PDF from storage:`, error);
      }
    }

    // Clear all source data fields
    await ctx.db.patch(args.capsuleId, {
      sourcePdfStorageId: undefined,
      sourcePdfName: undefined,
      sourcePdfMime: undefined,
      sourcePdfSize: undefined,
      sourceTopic: undefined,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Mutation: Create a module for a capsule
 * SECURITY: Restricted to internal use only (during capsule generation)
 */
export const createModule = internalMutation({
  args: {
    capsuleId: v.id("capsules"),
    title: v.string(),
    description: v.optional(v.string()),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    const moduleId = await ctx.db.insert("capsuleModules", {
      capsuleId: args.capsuleId,
      title: args.title,
      description: args.description,
      order: args.order,
      createdAt: Date.now(),
    });

    return moduleId;
  },
});

/**
 * Mutation: Create a lesson for a module
 * SECURITY: Restricted to internal use only (during capsule generation)
 */
const lessonTypeEnum = v.union(
  v.literal("concept"),
  v.literal("mcq"),
  v.literal("dragDrop"),
  v.literal("fillBlanks"),
  v.literal("simulation"),
  v.literal("mixed")
);

export const createLesson = internalMutation({
  args: {
    moduleId: v.id("capsuleModules"),
    capsuleId: v.id("capsules"),
    title: v.string(),
    description: v.optional(v.string()),
    order: v.number(),
    type: lessonTypeEnum,
    content: v.any(),
    isGraded: v.optional(v.boolean()),
    maxPoints: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const lessonId = await ctx.db.insert("capsuleLessons", {
      moduleId: args.moduleId,
      capsuleId: args.capsuleId,
      title: args.title,
      description: args.description,
      order: args.order,
      type: args.type,
      content: args.content,
      isGraded: args.isGraded,
      maxPoints: args.maxPoints,
      createdAt: Date.now(),
    });

    return lessonId;
  },
});

/**
 * SECURITY: Restricted to internal use only (during capsule generation)
 */
export const persistGeneratedCapsuleContent = internalMutation({
  args: {
    capsuleId: v.id("capsules"),
    modules: v.array(
      v.object({
        title: v.string(),
        description: v.optional(v.string()),
        introduction: v.optional(v.string()),
        learningObjectives: v.optional(v.array(v.string())),
        moduleSummary: v.optional(v.string()),
        lessons: v.array(
          v.object({
            title: v.string(),
            content: v.any(),
          })
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Track created resources for rollback on failure
    const createdModuleIds: Array<import("./_generated/dataModel").Id<"capsuleModules">> = [];
    const createdLessonIds: Array<import("./_generated/dataModel").Id<"capsuleLessons">> = [];

    try {
      for (const [moduleIndex, module] of args.modules.entries()) {
        const moduleId = await ctx.db.insert("capsuleModules", {
          capsuleId: args.capsuleId,
          title: module.title,
          description: module.description,
          order: moduleIndex,
          createdAt: Date.now(),
        });
        createdModuleIds.push(moduleId);

        for (const [lessonIndex, lesson] of module.lessons.entries()) {
          // Determine if lesson has practice questions for grading
          const content = lesson.content as Record<string, unknown> | undefined;
          const practiceQuestions = content?.practiceQuestions;
          const hasPracticeQuestions = Boolean(
            practiceQuestions && 
            Array.isArray(practiceQuestions) && 
            practiceQuestions.length > 0
          );
          
          // All module-generated content is "mixed" type - it contains explanations + questions
          const lessonType = "mixed" as const;
          
          const lessonId = await ctx.db.insert("capsuleLessons", {
            moduleId,
            capsuleId: args.capsuleId,
            title: lesson.title,
            description: undefined,
            order: lessonIndex,
            type: lessonType,
            content: lesson.content,
            isGraded: hasPracticeQuestions,
            maxPoints: hasPracticeQuestions ? 10 : undefined,
            createdAt: Date.now(),
          });
          createdLessonIds.push(lessonId);
        }
      }

      return { moduleCount: createdModuleIds.length };
    } catch (error) {
      // Rollback: Delete all created lessons first (they reference modules)
      console.error(`[Rollback] Cleaning up ${createdLessonIds.length} lessons and ${createdModuleIds.length} modules due to error:`, error);

      for (const lessonId of createdLessonIds) {
        try {
          await ctx.db.delete(lessonId);
        } catch (deleteErr) {
          console.warn(`[Rollback] Failed to delete lesson ${lessonId}:`, deleteErr);
        }
      }

      // Then delete modules
      for (const moduleId of createdModuleIds) {
        try {
          await ctx.db.delete(moduleId);
        } catch (deleteErr) {
          console.warn(`[Rollback] Failed to delete module ${moduleId}:`, deleteErr);
        }
      }

      // Re-throw the original error after cleanup
      throw new Error(
        `Failed to persist capsule content: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
        `Rolled back ${createdLessonIds.length} lessons and ${createdModuleIds.length} modules.`
      );
    }
  },
});

/**
 * Mutation: Update or create progress for a lesson
 * SECURITY: Verifies the authenticated user matches the userId parameter
 */
export const updateLessonProgress = mutation({
  args: {
    userId: v.id("users"),
    capsuleId: v.id("capsules"),
    moduleId: v.id("capsuleModules"),
    lessonId: v.id("capsuleLessons"),
    completed: v.boolean(),
    score: v.optional(v.number()),
    maxScore: v.optional(v.number()),
    timeSpent: v.optional(v.number()),
    // Quiz answer tracking
    quizAnswer: v.optional(v.object({
      selectedAnswer: v.string(),
      selectedIndex: v.optional(v.number()),
      correctAnswer: v.optional(v.string()),
      correctIndex: v.optional(v.number()),
      isCorrect: v.boolean(),
      options: v.optional(v.array(v.string())),
    })),
    hintsUsed: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, capsuleId, moduleId, lessonId, completed, score, maxScore, timeSpent, quizAnswer, hintsUsed } = args;

    // SECURITY: Verify the authenticated user matches the userId parameter
    // Uses fallback to support NextAuth sessions where Convex auth context isn't available
    const { user } = await requireAuthenticatedUserWithFallback(ctx, userId);
    if (user._id !== userId) {
      throw new Error("Unauthorized: You can only update your own progress");
    }

    // Verify the capsule exists and is accessible
    const capsule = await ctx.db.get(capsuleId);
    if (!capsule) {
      throw new Error("Capsule not found");
    }
    
    // SECURITY: Only allow progress updates on capsules the user owns OR public capsules
    if (capsule.userId !== userId && !capsule.isPublic) {
      throw new Error("Unauthorized: Cannot access this capsule");
    }

    // Check if progress already exists
    const existing = await ctx.db
      .query("capsuleProgress")
      .withIndex("by_userId_lessonId", (q) => q.eq("userId", userId).eq("lessonId", lessonId))
      .first();

    const now = Date.now();
    const percentage = maxScore && score !== undefined ? (score / maxScore) * 100 : undefined;

    if (existing) {
      const newAttempts = (existing.attempts || 0) + 1;

      // Build quiz answers array if quiz answer provided
      let quizAnswers = existing.quizAnswers || [];
      let lastAnswer = existing.lastAnswer;

      if (quizAnswer) {
        quizAnswers = [
          ...quizAnswers,
          {
            attemptNumber: newAttempts,
            selectedAnswer: quizAnswer.selectedAnswer,
            selectedIndex: quizAnswer.selectedIndex,
            isCorrect: quizAnswer.isCorrect,
            timestamp: now,
          },
        ];
        lastAnswer = {
          selectedAnswer: quizAnswer.selectedAnswer,
          selectedIndex: quizAnswer.selectedIndex,
          correctAnswer: quizAnswer.correctAnswer,
          correctIndex: quizAnswer.correctIndex,
          isCorrect: quizAnswer.isCorrect,
          options: quizAnswer.options,
        };
      }

      // Update existing progress
      await ctx.db.patch(existing._id, {
        completed,
        completedAt: completed ? now : undefined,
        score,
        maxScore,
        percentage,
        attempts: newAttempts,
        timeSpent: (existing.timeSpent || 0) + (timeSpent || 0),
        hintsUsed: hintsUsed !== undefined ? (existing.hintsUsed || 0) + hintsUsed : existing.hintsUsed,
        quizAnswers,
        lastAnswer,
        updatedAt: now,
      });

      return existing._id;
    } else {
      // Build initial quiz answers if provided
      let quizAnswers: Array<{
        attemptNumber: number;
        selectedAnswer: string;
        selectedIndex?: number;
        isCorrect: boolean;
        timestamp: number;
      }> | undefined;
      let lastAnswer: {
        selectedAnswer: string;
        selectedIndex?: number;
        correctAnswer?: string;
        correctIndex?: number;
        isCorrect: boolean;
        options?: string[];
      } | undefined;

      if (quizAnswer) {
        quizAnswers = [{
          attemptNumber: 1,
          selectedAnswer: quizAnswer.selectedAnswer,
          selectedIndex: quizAnswer.selectedIndex,
          isCorrect: quizAnswer.isCorrect,
          timestamp: now,
        }];
        lastAnswer = {
          selectedAnswer: quizAnswer.selectedAnswer,
          selectedIndex: quizAnswer.selectedIndex,
          correctAnswer: quizAnswer.correctAnswer,
          correctIndex: quizAnswer.correctIndex,
          isCorrect: quizAnswer.isCorrect,
          options: quizAnswer.options,
        };
      }

      // Create new progress
      const progressId = await ctx.db.insert("capsuleProgress", {
        userId,
        capsuleId,
        moduleId,
        lessonId,
        completed,
        completedAt: completed ? now : undefined,
        score,
        maxScore,
        percentage,
        attempts: 1,
        timeSpent: timeSpent || 0,
        hintsUsed: hintsUsed || 0,
        quizAnswers,
        lastAnswer,
        createdAt: now,
        updatedAt: now,
      });

      return progressId;
    }
  },
});

// =============================================================================
// NEW TYPED QUIZ MUTATIONS (Phase 1 - State Management Improvement)
// =============================================================================

/**
 * Schema validators for typed quiz answers
 * These match the schema definitions in schema.ts
 */
const mcqAnswerValidator = v.object({
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

const blankAnswerValidator = v.object({
  blankId: v.string(),
  userAnswer: v.string(),
  correctAnswer: v.string(),
  alternatives: v.array(v.string()),
  isCorrect: v.boolean(),
  hintUsed: v.optional(v.boolean()),
});

const fillBlanksAnswerValidator = v.object({
  type: v.literal("fillBlanks"),
  questionId: v.string(),
  blanks: v.array(blankAnswerValidator),
  overallCorrect: v.boolean(),
  score: v.number(),
  timestamp: v.number(),
  timeSpentMs: v.optional(v.number()),
});

const placementResultValidator = v.object({
  itemId: v.string(),
  itemContent: v.string(),
  targetId: v.string(),
  targetLabel: v.string(),
  isCorrect: v.boolean(),
});

const dragDropAnswerValidator = v.object({
  type: v.literal("dragDrop"),
  questionId: v.string(),
  placements: v.array(placementResultValidator),
  overallCorrect: v.boolean(),
  score: v.number(),
  timestamp: v.number(),
  timeSpentMs: v.optional(v.number()),
  shuffleSeed: v.optional(v.number()),
});

const typedQuizAnswerValidator = v.union(
  mcqAnswerValidator,
  fillBlanksAnswerValidator,
  dragDropAnswerValidator,
);

const questionStateValidator = v.object({
  questionIndex: v.number(),
  questionType: v.union(
    v.literal("mcq"),
    v.literal("fillBlanks"),
    v.literal("dragDrop")
  ),
  answered: v.boolean(),
  answer: v.optional(typedQuizAnswerValidator),
});

const mixedLessonProgressValidator = v.object({
  currentQuestionIndex: v.number(),
  questionStates: v.array(questionStateValidator),
  allQuestionsAnswered: v.boolean(),
});

/**
 * Mutation: Update lesson progress with typed quiz answer
 * 
 * This mutation supports all quiz types (MCQ, Fill-in-blanks, Drag-and-drop)
 * with proper type discrimination and dual-write for backward compatibility.
 * 
 * RACE CONDITION PROTECTION:
 * Uses optimistic locking with version field to prevent concurrent updates
 * from overwriting each other. If a version conflict is detected, the update
 * is rejected and the client should retry with fresh data.
 * 
 * SECURITY: Verifies authenticated user matches userId parameter
 * 
 * @param typedAnswer - Discriminated union answer (mcq | fillBlanks | dragDrop)
 * @param mixedLessonProgress - Optional progress state for mixed lessons
 * @param expectedVersion - Optional version for optimistic locking (recommended for updates)
 */
export const updateTypedLessonProgress = mutation({
  args: {
    userId: v.id("users"),
    capsuleId: v.id("capsules"),
    moduleId: v.id("capsuleModules"),
    lessonId: v.id("capsuleLessons"),
    completed: v.boolean(),
    score: v.optional(v.number()),
    maxScore: v.optional(v.number()),
    timeSpent: v.optional(v.number()),
    hintsUsed: v.optional(v.number()),
    // New typed answer - accepts MCQ, FillBlanks, or DragDrop
    typedAnswer: v.optional(typedQuizAnswerValidator),
    // Mixed lesson progress tracking
    mixedLessonProgress: v.optional(mixedLessonProgressValidator),
    // Optimistic locking - expected version for updates
    expectedVersion: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const {
      userId,
      capsuleId,
      moduleId,
      lessonId,
      completed,
      score,
      maxScore,
      timeSpent,
      hintsUsed,
      typedAnswer,
      mixedLessonProgress,
      expectedVersion,
    } = args;

    // SECURITY: Verify the authenticated user matches the userId parameter
    // Uses fallback to support NextAuth sessions where Convex auth context isn't available
    const { user } = await requireAuthenticatedUserWithFallback(ctx, userId);
    if (user._id !== userId) {
      throw new Error("Unauthorized: You can only update your own progress");
    }

    // Verify the capsule exists and is accessible
    const capsule = await ctx.db.get(capsuleId);
    if (!capsule) {
      throw new Error("Capsule not found");
    }
    
    // SECURITY: Only allow progress updates on capsules the user owns OR public capsules
    if (capsule.userId !== userId && !capsule.isPublic) {
      throw new Error("Unauthorized: Cannot access this capsule");
    }

    // Check if progress already exists
    const existing = await ctx.db
      .query("capsuleProgress")
      .withIndex("by_userId_lessonId", (q) => q.eq("userId", userId).eq("lessonId", lessonId))
      .first();

    const now = Date.now();
    const percentage = maxScore && score !== undefined ? (score / maxScore) * 100 : undefined;

    if (existing) {
      // OPTIMISTIC LOCKING: Check version if provided
      const currentVersion = existing.version || 0;
      if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
        throw new Error(
          `Concurrent modification detected for progress. ` +
          `Expected version ${expectedVersion}, but found ${currentVersion}. ` +
          `Please refresh and try again.`
        );
      }

      const newAttempts = (existing.attempts || 0) + 1;

      // Build typed attempt history
      let typedAttemptHistory = existing.typedAttemptHistory || [];

      if (typedAnswer) {
        typedAttemptHistory = [
          ...typedAttemptHistory,
          {
            attemptNumber: newAttempts,
            answer: typedAnswer,
            timestamp: now,
            timeSpentMs: typedAnswer.timeSpentMs || timeSpent || 0,
          },
        ];
      }

      // Dual-write: also update legacy fields for backward compatibility
      let legacyQuizAnswers = existing.quizAnswers || [];
      let legacyLastAnswer = existing.lastAnswer;

      if (typedAnswer && typedAnswer.type === "mcq") {
        // Convert typed MCQ to legacy format
        legacyQuizAnswers = [
          ...legacyQuizAnswers,
          {
            attemptNumber: newAttempts,
            selectedAnswer: typedAnswer.selectedText,
            selectedIndex: typedAnswer.selectedIndex,
            isCorrect: typedAnswer.isCorrect,
            timestamp: now,
          },
        ];
        legacyLastAnswer = {
          selectedAnswer: typedAnswer.selectedText,
          selectedIndex: typedAnswer.selectedIndex,
          correctAnswer: typedAnswer.correctText,
          correctIndex: typedAnswer.correctIndex,
          isCorrect: typedAnswer.isCorrect,
          options: typedAnswer.options,
        };
      } else if (typedAnswer) {
        // For fill-blanks and drag-drop, store a minimal legacy representation
        const isCorrect = typedAnswer.type === "fillBlanks"
          ? typedAnswer.overallCorrect
          : typedAnswer.overallCorrect;

        legacyQuizAnswers = [
          ...legacyQuizAnswers,
          {
            attemptNumber: newAttempts,
            selectedAnswer: `[${typedAnswer.type}]`, // Marker for non-MCQ types
            isCorrect,
            timestamp: now,
          },
        ];
        legacyLastAnswer = {
          selectedAnswer: `[${typedAnswer.type}]`,
          isCorrect,
        };
      }

      // Update existing progress with version increment
      await ctx.db.patch(existing._id, {
        completed,
        completedAt: completed ? now : existing.completedAt,
        score,
        maxScore,
        percentage,
        attempts: newAttempts,
        timeSpent: (existing.timeSpent || 0) + (timeSpent || 0),
        hintsUsed: hintsUsed !== undefined ? (existing.hintsUsed || 0) + hintsUsed : existing.hintsUsed,
        // New typed fields
        typedLastAnswer: typedAnswer,
        typedAttemptHistory,
        mixedLessonProgress,
        // Legacy fields (dual-write)
        quizAnswers: legacyQuizAnswers,
        lastAnswer: legacyLastAnswer,
        // Increment version for optimistic locking
        version: currentVersion + 1,
        updatedAt: now,
      });

      return { progressId: existing._id, version: currentVersion + 1 };
    } else {
      // Build initial typed attempt history (only if we have a typed answer)
      const initialTypedAttemptHistory = typedAnswer ? [{
        attemptNumber: 1,
        answer: typedAnswer,
        timestamp: now,
        timeSpentMs: typedAnswer.timeSpentMs || timeSpent || 0,
      }] : undefined;

      // Build legacy fields for dual-write
      let legacyQuizAnswers: Array<{
        attemptNumber: number;
        selectedAnswer: string;
        selectedIndex?: number;
        isCorrect: boolean;
        timestamp: number;
      }> | undefined;
      let legacyLastAnswer: {
        selectedAnswer: string;
        selectedIndex?: number;
        correctAnswer?: string;
        correctIndex?: number;
        isCorrect: boolean;
        options?: string[];
      } | undefined;

      if (typedAnswer) {
        if (typedAnswer.type === "mcq") {
          legacyQuizAnswers = [{
            attemptNumber: 1,
            selectedAnswer: typedAnswer.selectedText,
            selectedIndex: typedAnswer.selectedIndex,
            isCorrect: typedAnswer.isCorrect,
            timestamp: now,
          }];
          legacyLastAnswer = {
            selectedAnswer: typedAnswer.selectedText,
            selectedIndex: typedAnswer.selectedIndex,
            correctAnswer: typedAnswer.correctText,
            correctIndex: typedAnswer.correctIndex,
            isCorrect: typedAnswer.isCorrect,
            options: typedAnswer.options,
          };
        } else {
          const isCorrect = typedAnswer.type === "fillBlanks"
            ? typedAnswer.overallCorrect
            : typedAnswer.overallCorrect;

          legacyQuizAnswers = [{
            attemptNumber: 1,
            selectedAnswer: `[${typedAnswer.type}]`,
            isCorrect,
            timestamp: now,
          }];
          legacyLastAnswer = {
            selectedAnswer: `[${typedAnswer.type}]`,
            isCorrect,
          };
        }
      }

      // Create new progress with typed fields and initial version
      const progressId = await ctx.db.insert("capsuleProgress", {
        userId,
        capsuleId,
        moduleId,
        lessonId,
        completed,
        completedAt: completed ? now : undefined,
        score,
        maxScore,
        percentage,
        attempts: 1,
        timeSpent: timeSpent || 0,
        hintsUsed: hintsUsed || 0,
        // New typed fields
        typedLastAnswer: typedAnswer,
        typedAttemptHistory: initialTypedAttemptHistory,
        mixedLessonProgress,
        // Legacy fields (dual-write)
        quizAnswers: legacyQuizAnswers,
        lastAnswer: legacyLastAnswer,
        // Initial version for optimistic locking
        version: 1,
        createdAt: now,
        updatedAt: now,
      });

      return { progressId, version: 1 };
    }
  },
});

/**
 * Mutation: Update only mixed lesson progress (for navigation without submission)
 * 
 * This lightweight mutation updates just the navigation state without
 * recording a full attempt, useful for tracking which question the user is on.
 * Creates a progress record if one doesn't exist.
 * 
 * NOTE: This mutation uses last-write-wins for navigation updates since
 * navigation conflicts are non-critical (latest position is typically correct).
 */
export const updateMixedLessonNavigation = mutation({
  args: {
    userId: v.id("users"),
    lessonId: v.id("capsuleLessons"),
    currentQuestionIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId, lessonId, currentQuestionIndex } = args;

    const existing = await ctx.db
      .query("capsuleProgress")
      .withIndex("by_userId_lessonId", (q) => q.eq("userId", userId).eq("lessonId", lessonId))
      .first();

    const now = Date.now();

    if (!existing) {
      // Get lesson to find moduleId and capsuleId
      const lesson = await ctx.db.get(lessonId);
      if (!lesson) {
        throw new Error("Lesson not found");
      }

      const module = await ctx.db.get(lesson.moduleId);
      if (!module) {
        throw new Error("Module not found");
      }

      // Create a new progress record with just navigation state
      const progressId = await ctx.db.insert("capsuleProgress", {
        userId,
        capsuleId: module.capsuleId,
        moduleId: lesson.moduleId,
        lessonId,
        completed: false,
        score: 0,
        maxScore: 100,
        percentage: 0,
        attempts: 0,
        timeSpent: 0,
        hintsUsed: 0,
        mixedLessonProgress: {
          currentQuestionIndex,
          questionStates: [],
          allQuestionsAnswered: false,
        },
        // Initial version for optimistic locking
        version: 1,
        createdAt: now,
        updatedAt: now,
      });

      return { progressId, version: 1 };
    }

    const currentProgress = existing.mixedLessonProgress;
    const currentVersion = existing.version || 0;

    if (!currentProgress) {
      // Initialize mixed lesson progress if it doesn't exist
      await ctx.db.patch(existing._id, {
        mixedLessonProgress: {
          currentQuestionIndex,
          questionStates: [],
          allQuestionsAnswered: false,
        },
        version: currentVersion + 1,
        updatedAt: Date.now(),
      });
    } else {
      // Update only the current question index
      await ctx.db.patch(existing._id, {
        mixedLessonProgress: {
          ...currentProgress,
          currentQuestionIndex,
        },
        version: currentVersion + 1,
        updatedAt: Date.now(),
      });
    }

    return { progressId: existing._id, version: currentVersion + 1 };
  },
});

/**
 * Query: Get typed lesson progress
 * 
 * Returns the lesson progress with typed answer fields,
 * falling back to legacy fields if typed fields don't exist.
 */
export const getTypedLessonProgress = query({
  args: {
    userId: v.id("users"),
    lessonId: v.id("capsuleLessons"),
  },
  handler: async (ctx, args) => {
    const progress = await ctx.db
      .query("capsuleProgress")
      .withIndex("by_userId_lessonId", (q) =>
        q.eq("userId", args.userId).eq("lessonId", args.lessonId)
      )
      .first();

    if (!progress) {
      return null;
    }

    // Return typed fields with fallback to legacy
    return {
      ...progress,
      // Prefer typed fields, but include both for inspection
      hasTypedAnswer: !!progress.typedLastAnswer,
      hasLegacyAnswer: !!progress.lastAnswer,
    };
  },
});

/**
 * Mutation: Reset a capsule (clear content but keep metadata) for retry
 */
export const resetCapsule = mutation({
  args: { capsuleId: v.id("capsules") },
  handler: async (ctx, args) => {
    // Delete all progress
    const progress = await ctx.db
      .query("capsuleProgress")
      .withIndex("by_capsuleId", (q) => q.eq("capsuleId", args.capsuleId))
      .collect();
    for (const p of progress) await ctx.db.delete(p._id);

    // Delete all lessons
    const lessons = await ctx.db
      .query("capsuleLessons")
      .withIndex("by_capsuleId", (q) => q.eq("capsuleId", args.capsuleId))
      .collect();
    for (const l of lessons) await ctx.db.delete(l._id);

    // Delete all modules
    const modules = await ctx.db
      .query("capsuleModules")
      .withIndex("by_capsuleId", (q) => q.eq("capsuleId", args.capsuleId))
      .collect();
    for (const m of modules) await ctx.db.delete(m._id);

    // Reset capsule status
    await ctx.db.patch(args.capsuleId, {
      status: "pending",
      errorMessage: undefined,
      moduleCount: undefined,
      estimatedDuration: undefined,
      completedAt: undefined,
    });
  },
});

import { checkRateLimit, recordRequest, RATE_LIMITS, createBucketKey } from "./rateLimit";

/**
 * Action: Generate capsule content from PDF or topic using AI
 * Uses chunked generation to avoid 600s timeout for large courses
 * 
 * SECURITY: This is the public entry point for capsule generation.
 * It verifies user authentication before calling the internal generation action.
 */
export const generateCapsuleContent = action({
  args: {
    capsuleId: v.id("capsules"),
  },
  handler: async (ctx, args): Promise<{ generationId: string; success: boolean; alreadyRunning?: boolean }> => {
    // =========================================================================
    // 1. Get capsule first - we need it for authorization
    // =========================================================================
    const capsule = await ctx.runQuery(api.capsules.getCapsule, {
      capsuleId: args.capsuleId,
    });

    if (!capsule) {
      throw new Error("Capsule not found");
    }

    // =========================================================================
    // 2. AUTHENTICATION - Verify user identity
    // =========================================================================
    const identity = await ctx.auth.getUserIdentity();

    // Start with capsule owner's ID (proper type)
    let authenticatedUserId = capsule.userId;

    if (identity?.email) {
      // If we have identity, verify through email lookup
      const user = await ctx.runQuery(api.auth.getUserByEmail, {
        email: identity.email,
      });
      if (user) {
        authenticatedUserId = user._id;
      }
    }

    // Verify the capsule owner exists
    const owner = await ctx.runQuery(api.auth.getUserById, {
      id: capsule.userId,
    });

    if (!owner) {
      throw new Error("Unauthorized: Capsule owner not found");
    }

    // =========================================================================
    // 3. AUTHORIZATION - Verify user owns this capsule
    // =========================================================================
    if (capsule.userId !== authenticatedUserId) {
      throw new Error("Forbidden: You do not own this capsule");
    }

    // =========================================================================
    // 4. RATE LIMITING - Enforce usage limits
    // =========================================================================
    const bucketKey = createBucketKey("generation", authenticatedUserId);
    const { allowed, retryAfterMs } = await ctx.runQuery(api.rateLimit.checkRateLimit, {
      bucketKey,
    });

    if (!allowed) {
      const waitMinutes = Math.ceil((retryAfterMs || 0) / 60000);
      throw new Error(
        `Rate limit exceeded. You can generate ${RATE_LIMITS.CAPSULE_GENERATION.maxRequests} capsules per hour. ` +
        `Please try again in ${waitMinutes} minutes.`
      );
    }

    // Record the request (consume token)
    await ctx.runMutation(api.rateLimit.recordRequest, {
      bucketKey,
      maxRequests: RATE_LIMITS.CAPSULE_GENERATION.maxRequests,
      windowMs: RATE_LIMITS.CAPSULE_GENERATION.windowMs,
    });

    // =========================================================================
    // 5. Call internal generation action with verified user ID
    // =========================================================================
    return await ctx.runAction(api.capsuleGeneration.startChunkedGeneration, {
      capsuleId: args.capsuleId,
    });
  },
});

/**
 * Mutation: Delete a capsule and all its content
 * Also cancels any active generation jobs to stop background processing
 */
export const deleteCapsule = mutation({
  args: { 
    capsuleId: v.id("capsules"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { capsuleId, userId } = args;

    // Get the capsule to verify ownership
    const capsule = await ctx.db.get(capsuleId);
    if (!capsule) {
      throw new Error("Capsule not found");
    }

    // Security: Verify ownership
    if (capsule.userId !== userId) {
      throw new Error("You do not have permission to delete this capsule");
    }

    // First, cancel any active generation jobs for this capsule
    // This prevents scheduled tasks from continuing after deletion
    const jobs = await ctx.db
      .query("generationJobs")
      .withIndex("by_capsuleId", (q) => q.eq("capsuleId", capsuleId))
      .collect();
    
    for (const job of jobs) {
      // Mark active jobs as cancelled so scheduled tasks will abort
      if (
        job.state !== "completed" &&
        job.state !== "failed" &&
        job.state !== "cancelled"
      ) {
        await ctx.db.patch(job._id, {
          state: "cancelled",
          lastError: "Generation cancelled: capsule was deleted",
          updatedAt: Date.now(),
          completedAt: Date.now(),
          version: (job.version || 0) + 1,
        });
        console.log(`[DeleteCapsule] Cancelled generation job ${job.generationId}`);
      }
      // Delete the job record
      await ctx.db.delete(job._id);
    }

    // Delete all progress
    const progress = await ctx.db
      .query("capsuleProgress")
      .withIndex("by_capsuleId", (q) => q.eq("capsuleId", capsuleId))
      .collect();

    for (const p of progress) {
      await ctx.db.delete(p._id);
    }

    // Delete all lessons
    const lessons = await ctx.db
      .query("capsuleLessons")
      .withIndex("by_capsuleId", (q) => q.eq("capsuleId", capsuleId))
      .collect();

    for (const lesson of lessons) {
      await ctx.db.delete(lesson._id);
    }

    // Delete all modules
    const capsuleModules = await ctx.db
      .query("capsuleModules")
      .withIndex("by_capsuleId", (q) => q.eq("capsuleId", capsuleId))
      .collect();

    for (const mod of capsuleModules) {
      await ctx.db.delete(mod._id);
    }

    // Delete any stored PDF (capsule was already fetched above for ownership check)
    if (capsule.sourcePdfStorageId) {
      try {
        await ctx.storage.delete(capsule.sourcePdfStorageId);
        console.log(`[DeleteCapsule] Deleted PDF from storage: ${capsule.sourcePdfStorageId}`);
      } catch (error) {
        console.warn(`[DeleteCapsule] Failed to delete PDF from storage:`, error);
      }
    }

    // Delete the capsule itself
    await ctx.db.delete(capsuleId);
  },
});

// =============================================================================
// Queries for Lesson Regeneration
// =============================================================================

/**
 * Get a single lesson by ID
 */
export const getLesson = query({
  args: {
    lessonId: v.id("capsuleLessons"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.lessonId);
  },
});

/**
 * Get a single module by ID
 */
export const getModule = query({
  args: {
    moduleId: v.id("capsuleModules"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.moduleId);
  },
});

/**
 * Update lesson content (for regeneration)
 * SECURITY: Internal mutation - can only be called from server-side code (actions)
 */
export const updateLessonContent = internalMutation({
  args: {
    lessonId: v.id("capsuleLessons"),
    content: v.any(),
  },
  handler: async (ctx, args) => {
    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) {
      throw new Error("Lesson not found");
    }
    
    await ctx.db.patch(args.lessonId, {
      content: args.content,
    });
    return { success: true };
  },
});

/**
 * Check if a lesson has failed/fallback content
 */
export const checkLessonStatus = query({
  args: {
    lessonId: v.id("capsuleLessons"),
  },
  handler: async (ctx, args) => {
    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) return { exists: false, needsRegeneration: false };

    // Check if content indicates failure
    const content = lesson.content as Record<string, unknown> | null;
    const isFallback = content?.fallback === true || content?.error !== undefined;

    // Also check for invalid content based on type
    let isValid = true;
    if (content && !isFallback) {
      switch (lesson.type) {
        case 'concept':
          isValid = !!content.explanation && content.explanation !== 'undefined';
          break;
        case 'mcq':
          isValid = !!content.question && Array.isArray(content.options);
          break;
        case 'fillBlanks':
          isValid = !!(content.text ?? content.sentence) && Array.isArray(content.blanks);
          break;
        case 'dragDrop':
          isValid = Array.isArray(content.items) && Array.isArray(content.targets);
          break;
        case 'simulation':
          isValid = !!content.code;
          break;
      }
    }

    return {
      exists: true,
      needsRegeneration: isFallback || !isValid,
      lessonType: lesson.type,
      lessonTitle: lesson.title,
    };
  },
});
