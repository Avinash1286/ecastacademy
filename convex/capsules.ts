import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { api } from "./_generated/api";

// =============================================================================
// File Storage for Large PDFs
// =============================================================================

/**
 * Generate an upload URL for PDF files
 * This allows uploading files up to 20MB to Convex storage
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
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
 * Get PDF data from storage as base64 for AI processing
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
    
    // Fetch the PDF from storage
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }
    
    // Convert to base64 using Web APIs (Buffer is not available in Convex runtime)
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Convert to base64 using btoa with binary string
    let binaryString = '';
    const chunkSize = 8192; // Process in chunks to avoid call stack issues with large files
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binaryString += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    const base64 = btoa(binaryString);
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

    return lessons;
  },
});

/**
 * Query: Get capsule with modules and lessons (full structure)
 */
export const getCapsuleWithContent = query({
  args: { capsuleId: v.id("capsules") },
  handler: async (ctx, args) => {
    const capsule = await ctx.db.get(args.capsuleId);
    if (!capsule) return null;

    const modules = await ctx.db
      .query("capsuleModules")
      .withIndex("by_capsuleId_order", (q) => q.eq("capsuleId", args.capsuleId))
      .collect();

    const modulesWithLessons = await Promise.all(
      modules.map(async (module) => {
        const lessons = await ctx.db
          .query("capsuleLessons")
          .withIndex("by_moduleId_order", (q) => q.eq("moduleId", module._id))
          .collect();

        return {
          ...module,
          lessons,
        };
      })
    );

    return {
      ...capsule,
      modules: modulesWithLessons,
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
 */
export const createCapsule = mutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    sourceType: v.union(v.literal("pdf"), v.literal("topic")),
    sourcePdfStorageId: v.optional(v.id("_storage")), // For large PDFs via Convex storage
    sourcePdfData: v.optional(v.string()), // Legacy: for small PDFs < 1MB
    sourcePdfName: v.optional(v.string()),
    sourcePdfMime: v.optional(v.string()),
    sourcePdfSize: v.optional(v.number()),
    sourceTopic: v.optional(v.string()),
    userPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const capsuleId = await ctx.db.insert("capsules", {
      userId: args.userId,
      title: args.title,
      description: undefined,
      userPrompt: args.userPrompt,
      sourceType: args.sourceType,
      sourcePdfStorageId: args.sourcePdfStorageId,
      sourcePdfData: args.sourcePdfData,
      sourcePdfName: args.sourcePdfName,
      sourcePdfMime: args.sourcePdfMime,
      sourcePdfSize: args.sourcePdfSize,
      sourceTopic: args.sourceTopic,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return capsuleId;
  },
});

/**
 * Mutation: Update capsule status
 */
export const updateCapsuleStatus = mutation({
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
 */
export const updateCapsuleMetadata = mutation({
  args: {
    capsuleId: v.id("capsules"),
    description: v.optional(v.string()),
    estimatedDuration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.capsuleId, {
      description: args.description,
      estimatedDuration: args.estimatedDuration,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Mutation: Clear stored source payloads after processing and delete PDF from storage
 */
export const clearCapsuleSourceData = mutation({
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
      sourcePdfData: undefined,
      sourcePdfName: undefined,
      sourcePdfMime: undefined,
      sourcePdfSize: undefined,
      sourceTopic: undefined,
      updatedAt: Date.now(),
    });
  },
});

const generationStatusEnum = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed")
);

export const createGenerationRun = mutation({
  args: {
    capsuleId: v.id("capsules"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const runId = await ctx.db.insert("capsuleGenerationRuns", {
      capsuleId: args.capsuleId,
      status: "queued",
      createdAt: now,
      updatedAt: now,
    });
    return runId;
  },
});

export const updateGenerationRun = mutation({
  args: {
    runId: v.id("capsuleGenerationRuns"),
    status: v.optional(generationStatusEnum),
    stage: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    reviewJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { runId, ...updates } = args;
    await ctx.db.patch(runId, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Mutation: Create a module for a capsule
 */
export const createModule = mutation({
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
 */
const lessonTypeEnum = v.union(
  v.literal("concept"),
  v.literal("mcq"),
  v.literal("dragDrop"),
  v.literal("fillBlanks"),
  v.literal("simulation"),
  v.literal("mixed")
);

export const createLesson = mutation({
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

export const persistGeneratedCapsuleContent = mutation({
  args: {
    capsuleId: v.id("capsules"),
    modules: v.array(
      v.object({
        title: v.string(),
        description: v.optional(v.string()),
        lessons: v.array(
          v.object({
            title: v.string(),
            lessonType: lessonTypeEnum,
            content: v.any(),
          })
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    let moduleCount = 0;

    for (const [moduleIndex, module] of args.modules.entries()) {
      const moduleId = await ctx.db.insert("capsuleModules", {
        capsuleId: args.capsuleId,
        title: module.title,
        description: module.description,
        order: moduleIndex,
        createdAt: Date.now(),
      });

      moduleCount++;

      for (const [lessonIndex, lesson] of module.lessons.entries()) {
        const isMcq = lesson.lessonType === "mcq";
        await ctx.db.insert("capsuleLessons", {
          moduleId,
          capsuleId: args.capsuleId,
          title: lesson.title,
          description: undefined,
          order: lessonIndex,
          type: lesson.lessonType,
          content: lesson.content,
          isGraded: isMcq,
          maxPoints: isMcq ? 10 : undefined,
          createdAt: Date.now(),
        });
      }
    }

    return { moduleCount };
  },
});

/**
 * Mutation: Update or create progress for a lesson
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

/**
 * Action: Generate capsule content from PDF or topic using AI
 * Uses chunked generation to avoid 600s timeout for large courses
 */
export const generateCapsuleContent = action({
  args: {
    capsuleId: v.id("capsules"),
  },
  handler: async (ctx, args): Promise<{ generationId: string; success: boolean }> => {
    // Use chunked generation system to avoid timeout
    return await ctx.runAction(api.capsuleGeneration.startChunkedGeneration, {
      capsuleId: args.capsuleId,
    });
  },
});

/**
 * Mutation: Delete a capsule and all its content
 */
export const deleteCapsule = mutation({
  args: { capsuleId: v.id("capsules") },
  handler: async (ctx, args) => {
    // Delete all progress
    const progress = await ctx.db
      .query("capsuleProgress")
      .withIndex("by_capsuleId", (q) => q.eq("capsuleId", args.capsuleId))
      .collect();

    for (const p of progress) {
      await ctx.db.delete(p._id);
    }

    // Delete all lessons
    const lessons = await ctx.db
      .query("capsuleLessons")
      .withIndex("by_capsuleId", (q) => q.eq("capsuleId", args.capsuleId))
      .collect();

    for (const lesson of lessons) {
      await ctx.db.delete(lesson._id);
    }

    // Delete all modules
    const capsuleModules = await ctx.db
      .query("capsuleModules")
      .withIndex("by_capsuleId", (q) => q.eq("capsuleId", args.capsuleId))
      .collect();

    for (const mod of capsuleModules) {
      await ctx.db.delete(mod._id);
    }

    // Delete the capsule itself
    await ctx.db.delete(args.capsuleId);
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
 */
export const updateLessonContent = mutation({
  args: {
    lessonId: v.id("capsuleLessons"),
    content: v.any(),
  },
  handler: async (ctx, args) => {
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
