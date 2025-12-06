/**
 * Module-wise Capsule Generation Pipeline
 * 
 * Efficient generation that creates content module-by-module:
 * - Stage 1: Generate course outline (1 AI call)
 * - Stage 2: Generate module content (1 AI call per module - generates ALL lessons in that module)
 * - Stage 3: Finalize and persist
 * 
 * For 7 modules with 26 lessons: Only 8 AI calls (1 + 7) instead of 34 (1 + 7 + 26)
 * 
 * Each stage saves progress to the database, enabling resumption on failure.
 */

import { v } from "convex/values";
import { action, internalAction, internalMutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";

// =============================================================================
// Types
// =============================================================================

interface OutlineLesson {
  title: string;
  description: string;
}

interface OutlineModule {
  title: string;
  description: string;
  lessons: OutlineLesson[];
}

interface ParsedOutline {
  title: string;
  description: string;
  estimatedDuration: number;
  modules: OutlineModule[];
}

interface ParsedLesson {
  lessonId: string;
  title: string;
  content: {
    sections: Array<{
      type: string;
      title: string;
      content: string;
      keyPoints: string[];
    }>;
    codeExamples: unknown[];
    interactiveVisualizations: unknown[];
    practiceQuestions: unknown[];
  };
}

interface ParsedModuleContent {
  moduleId: string;
  title: string;
  introduction: string;
  learningObjectives: string[];
  lessons: ParsedLesson[];
  moduleSummary: string;
}

interface GeneratedModule {
  title: string;
  description?: string;
  introduction?: string;
  learningObjectives?: string[];
  moduleSummary?: string;
  lessons: Array<{
    title: string;
    content: unknown;
  }>;
}

// =============================================================================
// Progress Management
// =============================================================================

/**
 * Save a single generated module directly to the database
 * This avoids memory accumulation by persisting immediately
 */
export const saveGeneratedModule = internalMutation({
  args: {
    capsuleId: v.id("capsules"),
    moduleIndex: v.number(),
    moduleData: v.object({
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
    }),
  },
  handler: async (ctx, args) => {
    const { capsuleId, moduleIndex, moduleData } = args;

    // Create the module
    const moduleId = await ctx.db.insert("capsuleModules", {
      capsuleId,
      title: moduleData.title,
      description: moduleData.description,
      order: moduleIndex,
      createdAt: Date.now(),
    });

    // Create lessons for this module
    for (const [lessonIndex, lesson] of moduleData.lessons.entries()) {
      // Determine if lesson has practice questions for grading
      const content = lesson.content as Record<string, unknown> | undefined;
      const practiceQuestions = content?.practiceQuestions;
      const hasPracticeQuestions = Boolean(
        practiceQuestions && 
        Array.isArray(practiceQuestions) && 
        practiceQuestions.length > 0
      );
      
      await ctx.db.insert("capsuleLessons", {
        moduleId,
        capsuleId,
        title: lesson.title,
        description: undefined,
        order: lessonIndex,
        type: "mixed",
        content: lesson.content,
        isGraded: hasPracticeQuestions,
        maxPoints: hasPracticeQuestions ? 10 : undefined,
        createdAt: Date.now(),
      });
    }

    console.log(`[SaveModule] Saved module ${moduleIndex + 1}: "${moduleData.title}" with ${moduleData.lessons.length} lessons`);
    return { moduleId };
  },
});

export const saveGenerationProgress = internalMutation({
  args: {
    generationId: v.string(),
    state: v.string(),
    currentModuleIndex: v.optional(v.number()),
    totalModules: v.optional(v.number()),
    outlineJson: v.optional(v.string()),
    modulesContentJson: v.optional(v.string()),
  },
  handler: async (ctx, updates) => {
    // Find the generation job
    const job = await ctx.db
      .query("generationJobs")
      .withIndex("by_generationId", (q) => q.eq("generationId", updates.generationId))
      .first();

    if (!job) {
      console.warn(`[Progress] Job not found: ${updates.generationId}`);
      return;
    }

    // Build patch object
    const patch: Record<string, unknown> = {
      currentStage: updates.state,
      updatedAt: Date.now(),
    };

    if (updates.currentModuleIndex !== undefined) patch.currentModuleIndex = updates.currentModuleIndex;
    if (updates.totalModules !== undefined) patch.totalModules = updates.totalModules;
    if (updates.outlineJson !== undefined) patch.outlineJson = updates.outlineJson;
    if (updates.modulesContentJson !== undefined) patch.modulesContentJson = updates.modulesContentJson;

    await ctx.db.patch(job._id, patch);
  },
});

export const markGenerationFailed = internalMutation({
  args: {
    generationId: v.string(),
    capsuleId: v.id("capsules"),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    // Update capsule status
    await ctx.db.patch(args.capsuleId, {
      status: "failed",
      errorMessage: args.errorMessage,
      updatedAt: Date.now(),
    });

    // Update job status
    const job = await ctx.db
      .query("generationJobs")
      .withIndex("by_generationId", (q) => q.eq("generationId", args.generationId))
      .first();

    if (job) {
      await ctx.db.patch(job._id, {
        state: "failed",
        errorMessage: args.errorMessage,
        completedAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

// =============================================================================
// Stage 1: Generate Course Outline
// =============================================================================

export const generateOutline = internalAction({
  args: {
    capsuleId: v.id("capsules"),
    generationId: v.string(),
    pdfBase64: v.optional(v.string()),
    pdfMimeType: v.optional(v.string()),
    topic: v.optional(v.string()),
    guidance: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    console.log(`[Stage 1] Generating outline for ${args.generationId}`);

    // Check if capsule still exists and job is valid before proceeding
    const validationResult = await ctx.runQuery(internal.generationJobs.isGenerationJobValid, {
      generationId: args.generationId,
      capsuleId: args.capsuleId,
    });
    
    if (!validationResult.valid) {
      console.log(`[Stage 1] Aborting - job invalid: ${validationResult.reason}`);
      return; // Exit early, don't continue generation
    }

    try {
      // Get AI model config
      const { resolveWithConvexCtx } = await import("../shared/ai/modelResolver");
      const modelConfig = await resolveWithConvexCtx(ctx, "capsule_generation");

      // Import generation function
      const { generateCapsuleOutline } = await import("../shared/ai/generation/index");
      const { capsuleOutlineSchema } = await import("../shared/capsule/schemas");

      // Build input
      const sourceType = args.pdfBase64 ? "pdf" : "topic";

      // Generate outline
      const rawOutline = await generateCapsuleOutline(
        {
          sourceType,
          pdfBase64: args.pdfBase64,
          topic: args.topic,
          guidance: args.guidance,
        },
        { modelConfig }
      );

      // Parse and validate outline
      let outline: ParsedOutline;
      try {
        // Clean up JSON response
        const jsonMatch = rawOutline.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("No valid JSON found in outline response");
        }
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Check for content safety violation
        if (parsed.error === true && parsed.errorType === "CONTENT_SAFETY_VIOLATION") {
          const safetyMessage = parsed.message || "This topic cannot be used to create educational content. Please choose a different topic.";
          console.log(`[Stage 1] Content safety violation detected: ${safetyMessage}`);
          throw new Error(`⚠️ ${safetyMessage}`);
        }
        
        outline = capsuleOutlineSchema.parse(parsed);
      } catch (parseError) {
        // Re-throw content safety errors as-is
        if (parseError instanceof Error && parseError.message.startsWith("⚠️")) {
          throw parseError;
        }
        console.error("[Stage 1] Failed to parse outline:", parseError);
        throw new Error(`Failed to parse outline: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }

      console.log(`[Stage 1] Outline generated: ${outline.title} with ${outline.modules.length} modules`);

      // Update capsule with title from outline
      await ctx.runMutation(internal.capsules.updateCapsuleMetadata, {
        capsuleId: args.capsuleId,
        title: outline.title,
        description: outline.description,
        estimatedDuration: outline.estimatedDuration,
      });

      // Save progress
      await ctx.runMutation(internal.capsuleGeneration.saveGenerationProgress, {
        generationId: args.generationId,
        state: "outline_complete",
        totalModules: outline.modules.length,
        outlineJson: JSON.stringify(outline),
      });

      // Schedule Stage 2 (module content generation)
      // NOTE: Don't pass pdfBase64 here - it will be fetched fresh from storage to avoid memory accumulation
      await ctx.scheduler.runAfter(0, internal.capsuleGeneration.generateModulesBatch, {
        capsuleId: args.capsuleId,
        generationId: args.generationId,
        topic: args.topic,
        guidance: args.guidance,
        outlineJson: JSON.stringify(outline),
        currentModuleIndex: 0,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error in outline generation";
      console.error(`[Stage 1] Failed:`, error);

      await ctx.runMutation(internal.capsuleGeneration.markGenerationFailed, {
        generationId: args.generationId,
        capsuleId: args.capsuleId,
        errorMessage,
      });
    }
  },
});

// =============================================================================
// Stage 2: Generate Module Content (Module by Module)
// =============================================================================

export const generateModulesBatch = internalAction({
  args: {
    capsuleId: v.id("capsules"),
    generationId: v.string(),
    topic: v.optional(v.string()),
    guidance: v.optional(v.string()),
    outlineJson: v.string(),
    currentModuleIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const outline: ParsedOutline = JSON.parse(args.outlineJson);

    console.log(`[Stage 2] Processing module ${args.currentModuleIndex + 1}/${outline.modules.length}`);

    // Check if capsule still exists and job is valid before proceeding
    const validationResult = await ctx.runQuery(internal.generationJobs.isGenerationJobValid, {
      generationId: args.generationId,
      capsuleId: args.capsuleId,
    });
    
    if (!validationResult.valid) {
      console.log(`[Stage 2] Aborting module ${args.currentModuleIndex + 1} - job invalid: ${validationResult.reason}`);
      return; // Exit early, don't continue generation
    }

    try {
      // Check if we're done
      if (args.currentModuleIndex >= outline.modules.length) {
        console.log(`[Stage 2] All modules generated, moving to finalization`);

        // Schedule finalization - modules are already saved to DB
        await ctx.scheduler.runAfter(0, internal.capsuleGeneration.finalizeGeneration, {
          capsuleId: args.capsuleId,
          generationId: args.generationId,
          outlineJson: args.outlineJson,
        });
        return;
      }

      // Get current module from outline
      const currentOutlineModule = outline.modules[args.currentModuleIndex];

      // Update progress
      await ctx.runMutation(internal.capsuleGeneration.saveGenerationProgress, {
        generationId: args.generationId,
        state: "generating_module_content",
        currentModuleIndex: args.currentModuleIndex,
      });

      // Fetch PDF from storage if this is a PDF-based capsule (fetch fresh to avoid memory accumulation)
      const capsule = await ctx.runQuery(api.capsules.getCapsule, { capsuleId: args.capsuleId });
      let pdfBase64: string | undefined;
      
      if (capsule?.sourceType === "pdf" && capsule.sourcePdfStorageId) {
        console.log(`[Stage 2] Fetching PDF from storage for module ${args.currentModuleIndex + 1}...`);
        pdfBase64 = await ctx.runAction(api.capsules.getPdfBase64, {
          storageId: capsule.sourcePdfStorageId,
        }) ?? undefined;
      }

      const sourceType = pdfBase64 ? "pdf" : "topic";

      // Get AI model config
      const { resolveWithConvexCtx } = await import("../shared/ai/modelResolver");
      const modelConfig = await resolveWithConvexCtx(ctx, "capsule_generation");

      // Import generation function
      const { generateModuleContent } = await import("../shared/ai/generation/index");
      const { moduleContentSchema } = await import("../shared/capsule/schemas");

      console.log(`[Stage 2] Generating content for module: ${currentOutlineModule.title}`);

      // Generate module content (this generates ALL lessons in the module in one call!)
      const rawModuleContent = await generateModuleContent(
        {
          sourceType,
          pdfBase64,
          topic: args.topic,
          capsuleTitle: outline.title,
          capsuleDescription: outline.description,
          moduleTitle: currentOutlineModule.title,
          moduleDescription: currentOutlineModule.description,
          moduleIndex: args.currentModuleIndex,
          lessons: currentOutlineModule.lessons.map(l => ({
            title: l.title,
            description: l.description,
          })),
        },
        { modelConfig }
      );

      // Parse module content
      let moduleContent: ParsedModuleContent;
      try {
        const jsonMatch = rawModuleContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("No valid JSON found in module content response");
        }
        const parsed = JSON.parse(jsonMatch[0]);
        moduleContent = moduleContentSchema.parse(parsed);
      } catch (parseError) {
        console.error(`[Stage 2] Failed to parse module ${args.currentModuleIndex + 1}:`, parseError);
        
        // Create fallback module content with _generationFailed flag
        // This flag is used by FailedLessonsAlert component to detect failed lessons
        moduleContent = {
          moduleId: `module-${args.currentModuleIndex}`,
          title: currentOutlineModule.title,
          introduction: currentOutlineModule.description,
          learningObjectives: [],
          lessons: currentOutlineModule.lessons.map((lesson, idx) => ({
            lessonId: `lesson-${args.currentModuleIndex}-${idx}`,
            title: lesson.title,
            content: {
              _generationFailed: true, // Flag for FailedLessonsAlert detection
              sections: [{
                type: "concept",
                title: lesson.title,
                content: `Content for "${lesson.title}" could not be generated. Please try regenerating this lesson.`,
                keyPoints: ["Content generation failed"],
              }],
              codeExamples: [],
              interactiveVisualizations: [],
              practiceQuestions: [],
            },
          })),
          moduleSummary: "",
        };
      }

      console.log(`[Stage 2] Module ${args.currentModuleIndex + 1} content generated with ${moduleContent.lessons.length} lessons`);

      // Save module directly to database (instead of accumulating in memory)
      await ctx.runMutation(internal.capsuleGeneration.saveGeneratedModule, {
        capsuleId: args.capsuleId,
        moduleIndex: args.currentModuleIndex,
        moduleData: {
          title: moduleContent.title,
          description: currentOutlineModule.description,
          introduction: moduleContent.introduction,
          learningObjectives: moduleContent.learningObjectives,
          moduleSummary: moduleContent.moduleSummary,
          lessons: moduleContent.lessons.map(lesson => ({
            title: lesson.title,
            content: lesson.content,
          })),
        },
      });

      // Clear pdfBase64 reference to help with memory
      pdfBase64 = undefined;

      // Save progress
      await ctx.runMutation(internal.capsuleGeneration.saveGenerationProgress, {
        generationId: args.generationId,
        state: `module_${args.currentModuleIndex + 1}_complete`,
        currentModuleIndex: args.currentModuleIndex,
      });

      // Schedule next module (self-scheduling for continuation)
      // Note: PDF will be fetched fresh from storage in the next call
      await ctx.scheduler.runAfter(0, internal.capsuleGeneration.generateModulesBatch, {
        capsuleId: args.capsuleId,
        generationId: args.generationId,
        topic: args.topic,
        guidance: args.guidance,
        outlineJson: args.outlineJson,
        currentModuleIndex: args.currentModuleIndex + 1,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error in module content generation";
      console.error(`[Stage 2] Failed:`, error);

      await ctx.runMutation(internal.capsuleGeneration.markGenerationFailed, {
        generationId: args.generationId,
        capsuleId: args.capsuleId,
        errorMessage,
      });
    }
  },
});

// =============================================================================
// Stage 3: Finalize Generation
// =============================================================================

export const finalizeGeneration = internalAction({
  args: {
    capsuleId: v.id("capsules"),
    generationId: v.string(),
    outlineJson: v.string(),
    // Note: generatedModulesJson removed - modules are now saved directly to DB during generation
  },
  handler: async (ctx, args) => {
    console.log(`[Stage 3] Finalizing generation for ${args.generationId}`);

    // Check if capsule still exists and job is valid before proceeding
    const validationResult = await ctx.runQuery(internal.generationJobs.isGenerationJobValid, {
      generationId: args.generationId,
      capsuleId: args.capsuleId,
    });
    
    if (!validationResult.valid) {
      console.log(`[Stage 3] Aborting finalization - job invalid: ${validationResult.reason}`);
      return; // Exit early, don't continue generation
    }

    try {
      const outline: ParsedOutline = JSON.parse(args.outlineJson);

      // Count modules that were saved to DB
      const modules = await ctx.runQuery(api.capsules.getCapsuleModules, {
        capsuleId: args.capsuleId,
      });
      
      const moduleCount = modules?.length ?? outline.modules.length;
      console.log(`[Stage 3] Found ${moduleCount} modules in database`);

      // Update capsule metadata
      await ctx.runMutation(internal.capsules.updateCapsuleMetadata, {
        capsuleId: args.capsuleId,
        description: outline.description,
      });

      // NOTE: Modules and lessons are already persisted during generation
      // No need to call persistGeneratedCapsuleContent

      // Clear source data (delete PDF from storage)
      await ctx.runMutation(internal.capsules.clearCapsuleSourceData, {
        capsuleId: args.capsuleId,
      });

      // Update final status
      await ctx.runMutation(internal.capsules.updateCapsuleStatus, {
        capsuleId: args.capsuleId,
        status: "completed",
        moduleCount,
      });

      // Update job as completed
      await ctx.runMutation(api.generationJobs.updateGenerationJob, {
        generationId: args.generationId,
        state: "completed",
        completedAt: Date.now(),
      });

      console.log(`[Stage 3] Generation completed successfully!`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error in finalization";
      console.error(`[Stage 3] Failed:`, error);

      await ctx.runMutation(internal.capsuleGeneration.markGenerationFailed, {
        generationId: args.generationId,
        capsuleId: args.capsuleId,
        errorMessage,
      });
    }
  },
});

// =============================================================================
// Entry Point: Start Module-wise Generation
// =============================================================================

/**
 * Start module-wise capsule generation
 * This is the main entry point called by the public action
 */
export const startChunkedGeneration = action({
  args: {
    capsuleId: v.id("capsules"),
  },
  handler: async (ctx, args) => {
    // Get capsule
    const capsule = await ctx.runQuery(api.capsules.getCapsule, {
      capsuleId: args.capsuleId,
    });

    if (!capsule) {
      throw new Error("Capsule not found");
    }

    // Validate source
    if (capsule.sourceType === "pdf" && !capsule.sourcePdfStorageId) {
      await ctx.runMutation(internal.capsules.updateCapsuleStatus, {
        capsuleId: args.capsuleId,
        status: "failed",
        errorMessage: "PDF data missing for capsule",
      });
      throw new Error("PDF data missing for capsule");
    }

    if (capsule.sourceType === "topic" && !capsule.sourceTopic) {
      await ctx.runMutation(internal.capsules.updateCapsuleStatus, {
        capsuleId: args.capsuleId,
        status: "failed",
        errorMessage: "Topic missing for capsule",
      });
      throw new Error("Topic missing for capsule");
    }

    // Reset capsule
    await ctx.runMutation(api.capsules.resetCapsule, {
      capsuleId: args.capsuleId,
    });

    // Update status to processing
    await ctx.runMutation(internal.capsules.updateCapsuleStatus, {
      capsuleId: args.capsuleId,
      status: "processing",
    });

    // Generate unique ID
    const generationId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Create generation job
    await ctx.runMutation(api.generationJobs.createGenerationJob, {
      capsuleId: args.capsuleId,
      generationId,
    });

    // Fetch PDF if needed
    let pdfBase64: string | undefined;
    if (capsule.sourceType === "pdf") {
      if (capsule.sourcePdfStorageId) {
        console.log("[ModuleGen] Fetching PDF from storage...");
        pdfBase64 = await ctx.runAction(api.capsules.getPdfBase64, {
          storageId: capsule.sourcePdfStorageId,
        });
        console.log("[ModuleGen] PDF fetched successfully");
      }
    }

    // Schedule Stage 1 (outline generation)
    await ctx.scheduler.runAfter(0, internal.capsuleGeneration.generateOutline, {
      capsuleId: args.capsuleId,
      generationId,
      pdfBase64,
      pdfMimeType: capsule.sourcePdfMime,
      topic: capsule.sourceTopic,
      guidance: capsule.userPrompt,
    });

    return { generationId, success: true };
  },
});

// =============================================================================
// Single Lesson Regeneration
// =============================================================================

/**
 * Update lesson regeneration status
 */
export const updateLessonRegenerationStatus = internalMutation({
  args: {
    lessonId: v.id("capsuleLessons"),
    status: v.union(
      v.literal("idle"),
      v.literal("pending"),
      v.literal("regenerating"),
      v.literal("completed"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.lessonId, {
      regenerationStatus: args.status,
      regenerationError: args.error,
      ...(args.status === "regenerating" ? { regenerationStartedAt: Date.now() } : {}),
    });
  },
});

/**
 * Internal action that performs the actual lesson regeneration
 * This runs in the background even if the user leaves the page
 */
export const performLessonRegeneration = internalAction({
  args: {
    lessonId: v.id("capsuleLessons"),
  },
  handler: async (ctx, args) => {
    console.log(`[Regenerate] Starting background regeneration for lesson ${args.lessonId}`);

    try {
      // Update status to regenerating
      await ctx.runMutation(internal.capsuleGeneration.updateLessonRegenerationStatus, {
        lessonId: args.lessonId,
        status: "regenerating",
      });

      // Get the lesson
      const lesson = await ctx.runQuery(api.capsules.getLesson, {
        lessonId: args.lessonId,
      });

      if (!lesson) {
        throw new Error("Lesson not found");
      }

      // Get the module for context
      const lessonModule = await ctx.runQuery(api.capsules.getModule, {
        moduleId: lesson.moduleId,
      });

      if (!lessonModule) {
        throw new Error("Module not found");
      }

      // Get the capsule for source material
      const capsule = await ctx.runQuery(api.capsules.getCapsule, {
        capsuleId: lesson.capsuleId,
      });

      if (!capsule) {
        throw new Error("Capsule not found");
      }

      // Get AI config
      const { resolveWithConvexCtx } = await import("../shared/ai/modelResolver");
      const modelConfig = await resolveWithConvexCtx(ctx, "capsule_generation");

      // Import generation function - use the single lesson generator
      const { generateLessonContent } = await import("../shared/ai/generation/index");

      // Fetch PDF if needed
      let pdfBase64: string | undefined;
      if (capsule.sourceType === "pdf" && capsule.sourcePdfStorageId) {
        console.log("[Regenerate] Fetching PDF from storage...");
        pdfBase64 = await ctx.runAction(api.capsules.getPdfBase64, {
          storageId: capsule.sourcePdfStorageId,
        }) ?? undefined;
      }

      // Generate lesson content with retries
      let rawContent: string | null = null;
      let lastError = "";

      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          console.log(`[Regenerate] Retry attempt ${attempt + 1}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }

        try {
          rawContent = await generateLessonContent(
            {
              sourceType: capsule.sourceType as "pdf" | "topic",
              pdfBase64,
              topic: capsule.sourceTopic,
              capsuleTitle: capsule.title,
              moduleTitle: lessonModule.title,
              moduleIndex: lessonModule.order,
              lessonTitle: lesson.title,
              lessonDescription: lesson.description || `Learn about ${lesson.title}`,
              lessonIndex: lesson.order,
            },
            { modelConfig }
          );
          break;
        } catch (error) {
          lastError = error instanceof Error ? error.message : "Unknown error";
          console.warn(`[Regenerate] Attempt ${attempt + 1} failed: ${lastError}`);
        }
      }

      if (!rawContent) {
        throw new Error(`Failed to regenerate lesson after 3 attempts: ${lastError}`);
      }

      // Parse the content using robust JSON extractor
      const { moduleContentSchema } = await import("../shared/capsule/schemas");
      const { extractJson } = await import("../shared/ai/response");
      let parsedContent: unknown;

      // Use robust JSON extraction with repair capabilities
      const extraction = await extractJson<{ 
        content?: unknown; 
        lessons?: Array<{ content?: unknown }>;
        sections?: unknown;
      }>(rawContent, {
        stage: "regenerate_lesson",
      });

      if (!extraction.success) {
        console.error("[Regenerate] JSON extraction failed:", extraction.error);
        console.error("[Regenerate] Attempted strategies:", extraction.attemptedStrategies);
        throw new Error(`Failed to parse lesson response: ${extraction.error.message}`);
      }

      const parsed = extraction.data;
      
      if (extraction.wasRepaired) {
        console.log("[Regenerate] JSON was repaired using strategy:", extraction.strategy);
      }
      
      // The single lesson endpoint returns a different structure, parse accordingly
      // If it looks like full module content, extract just this lesson
      if (parsed.lessons && Array.isArray(parsed.lessons)) {
        const lessonData = moduleContentSchema.parse(parsed);
        parsedContent = lessonData.lessons[0]?.content || parsed;
      } else if (parsed.content) {
        // Standard lesson regeneration response: { content: { sections: [...], ... } }
        parsedContent = parsed.content;
      } else if (parsed.sections) {
        // Content was returned directly without wrapper
        parsedContent = parsed;
      } else {
        parsedContent = parsed;
      }
      
      // Validate that we have proper content structure
      const contentToCheck = parsedContent as Record<string, unknown>;
      if (!contentToCheck.sections && !contentToCheck.explanation) {
        console.warn("[Regenerate] Content may not have expected structure:", Object.keys(contentToCheck));
      }

      // Update the lesson with new content
      await ctx.runMutation(internal.capsules.updateLessonContent, {
        lessonId: args.lessonId,
        content: parsedContent,
      });

      // Mark regeneration as completed
      await ctx.runMutation(internal.capsuleGeneration.updateLessonRegenerationStatus, {
        lessonId: args.lessonId,
        status: "completed",
      });

      console.log(`[Regenerate] Successfully regenerated lesson: ${lesson.title}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Regenerate] Failed to regenerate lesson:`, error);

      // Mark regeneration as failed
      await ctx.runMutation(internal.capsuleGeneration.updateLessonRegenerationStatus, {
        lessonId: args.lessonId,
        status: "failed",
        error: errorMessage,
      });
    }
  },
});

/**
 * Regenerate a single lesson using the lesson-specific prompt
 * This schedules a background job and returns immediately
 */
export const regenerateLesson = action({
  args: {
    lessonId: v.id("capsuleLessons"),
  },
  handler: async (ctx, args) => {
    console.log(`[Regenerate] Scheduling regeneration for lesson ${args.lessonId}`);

    // Get the lesson to verify it exists
    const lesson = await ctx.runQuery(api.capsules.getLesson, {
      lessonId: args.lessonId,
    });

    if (!lesson) {
      throw new Error("Lesson not found");
    }

    // Check if already regenerating
    if (lesson.regenerationStatus === "regenerating" || lesson.regenerationStatus === "pending") {
      throw new Error("Lesson is already being regenerated. Please wait.");
    }

    // Mark as pending
    await ctx.runMutation(internal.capsuleGeneration.updateLessonRegenerationStatus, {
      lessonId: args.lessonId,
      status: "pending",
    });

    // Schedule the background regeneration
    await ctx.scheduler.runAfter(0, internal.capsuleGeneration.performLessonRegeneration, {
      lessonId: args.lessonId,
    });

    return { success: true, lessonId: args.lessonId, status: "pending" };
  },
});

// =============================================================================
// Interactive Visualization Regeneration
// =============================================================================

/**
 * Regenerate a single interactive visualization with user feedback
 * Rate limited and authenticated
 */
export const regenerateVisualization = action({
  args: {
    lessonId: v.id("capsuleLessons"),
    visualizationIndex: v.number(),
    userFeedback: v.string(),
    userId: v.id("users"), // Required: User ID for ownership verification
  },
  handler: async (ctx, args) => {
    // Validate feedback length (security)
    if (args.userFeedback.length > 1000) {
      throw new Error("Feedback is too long. Please keep it under 1000 characters.");
    }
    if (args.userFeedback.trim().length < 10) {
      throw new Error("Please provide more detailed feedback (at least 10 characters).");
    }

    console.log(`[RegenerateViz] Starting for lesson ${args.lessonId}, index ${args.visualizationIndex}`);

    // Get the lesson
    const lesson = await ctx.runQuery(api.capsules.getLesson, {
      lessonId: args.lessonId,
    });

    if (!lesson) {
      throw new Error("Lesson not found");
    }

    // Verify the visualization exists
    const content = lesson.content as {
      interactiveVisualizations?: Array<{
        title?: string;
        description?: string;
        type?: string;
        html?: string;
        css?: string;
        javascript?: string;
      }>;
    } | undefined;

    const visualizations = content?.interactiveVisualizations || [];
    if (args.visualizationIndex < 0 || args.visualizationIndex >= visualizations.length) {
      throw new Error("Visualization not found at the specified index");
    }

    const currentViz = visualizations[args.visualizationIndex];

    // Get the module for context
    const lessonModule = await ctx.runQuery(api.capsules.getModule, {
      moduleId: lesson.moduleId,
    });

    if (!lessonModule) {
      throw new Error("Module not found");
    }

    // Get the capsule for context
    const capsule = await ctx.runQuery(api.capsules.getCapsule, {
      capsuleId: lesson.capsuleId,
    });

    if (!capsule) {
      throw new Error("Capsule not found");
    }

    // SECURITY: Verify ownership - only capsule owner can regenerate visualizations
    // Verify the user exists in database
    const user = await ctx.runQuery(api.auth.getUserById, { id: args.userId });
    if (!user) {
      throw new Error("User not found. Please sign in again.");
    }

    // Verify user owns this capsule
    if (user._id !== capsule.userId) {
      throw new Error("Unauthorized: Only the capsule owner can regenerate visualizations.");
    }

    // Rate limit check - reuse capsule generation rate limit bucket
    const userId = args.userId;
    const bucketKey = `viz_regen:${userId}`;
    
    const rateCheck = await ctx.runQuery(api.rateLimit.checkRateLimit, {
      bucketKey,
    });

    if (!rateCheck.allowed) {
      const waitMinutes = Math.ceil((rateCheck.retryAfterMs || 60000) / 60000);
      throw new Error(`Rate limit exceeded. Please wait ${waitMinutes} minute(s) before trying again.`);
    }

    // Record the request for rate limiting
    await ctx.runMutation(api.rateLimit.recordRequest, {
      bucketKey,
      maxRequests: 20, // Allow 20 visualization regenerations per hour
      windowMs: 60 * 60 * 1000, // 1 hour
    });

    // Get AI config
    const { resolveWithConvexCtx } = await import("../shared/ai/modelResolver");
    const modelConfig = await resolveWithConvexCtx(ctx, "capsule_generation");

    // Import regeneration function
    const { regenerateVisualization: generateViz } = await import("../shared/ai/generation/index");

    // Generate new visualization with retries
    let rawContent: string | null = null;
    let lastError = "";

    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        console.log(`[RegenerateViz] Retry attempt ${attempt + 1}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }

      try {
        rawContent = await generateViz(
          {
            currentVisualization: currentViz,
            userFeedback: args.userFeedback,
            lessonContext: {
              lessonTitle: lesson.title,
              moduleTitle: lessonModule.title,
              capsuleTitle: capsule.title,
            },
          },
          { modelConfig }
        );
        break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Unknown error";
        console.warn(`[RegenerateViz] Attempt ${attempt + 1} failed: ${lastError}`);
      }
    }

    if (!rawContent) {
      throw new Error(`Failed to regenerate visualization after 3 attempts: ${lastError}`);
    }

    // Parse the response using robust JSON extractor
    let newVisualization: {
      title?: string;
      description?: string;
      type?: string;
      html?: string;
      css?: string;
      javascript?: string;
    };

    try {
      const { extractJson } = await import("../shared/ai/response");
      const extraction = await extractJson<typeof newVisualization>(rawContent, {
        stage: "regenerate_visualization",
      });

      if (!extraction.success) {
        console.error("[RegenerateViz] JSON extraction failed:", extraction.error);
        console.error("[RegenerateViz] Attempted strategies:", extraction.attemptedStrategies);
        console.error("[RegenerateViz] Raw input preview:", extraction.rawInput?.substring(0, 500));
        throw new Error(`Failed to parse visualization response: ${extraction.error.message}`);
      }

      newVisualization = extraction.data;

      if (extraction.wasRepaired) {
        console.log("[RegenerateViz] JSON was repaired using strategy:", extraction.strategy);
        if (extraction.warnings) {
          console.log("[RegenerateViz] Warnings:", extraction.warnings);
        }
      }
      
      // Validate required fields
      if (!newVisualization.html && !newVisualization.javascript) {
        throw new Error("Generated visualization is missing code");
      }
    } catch (parseError) {
      console.error("[RegenerateViz] Failed to parse response:", parseError);
      // Provide a more helpful error message
      const errorMessage = parseError instanceof Error ? parseError.message : "Unknown error";
      throw new Error(`Failed to parse the generated visualization: ${errorMessage}. Please try again with different feedback.`);
    }

    // Update the lesson content with the new visualization
    const updatedVisualizations = [...visualizations];
    updatedVisualizations[args.visualizationIndex] = {
      title: newVisualization.title || currentViz.title || "Interactive Visualization",
      description: newVisualization.description || currentViz.description,
      type: newVisualization.type || "simulation",
      html: newVisualization.html || "",
      css: newVisualization.css || "",
      javascript: newVisualization.javascript || "",
    };

    const updatedContent = {
      ...content,
      interactiveVisualizations: updatedVisualizations,
    };

    // Save the updated content
    await ctx.runMutation(internal.capsules.updateLessonContent, {
      lessonId: args.lessonId,
      content: updatedContent,
    });

    console.log(`[RegenerateViz] Successfully regenerated visualization for lesson: ${lesson.title}`);

    return { 
      success: true, 
      lessonId: args.lessonId,
      visualizationIndex: args.visualizationIndex,
    };
  },
});

// =============================================================================
// Practice Question Regeneration
// =============================================================================

/**
 * Internal mutation to update question regeneration status
 */
export const updateQuestionRegenerationStatus = internalMutation({
  args: {
    lessonId: v.id("capsuleLessons"),
    questionIndex: v.number(),
    status: v.union(
      v.literal("idle"),
      v.literal("pending"),
      v.literal("regenerating"),
      v.literal("completed"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) return;

    // Get current status object or create new one
    const currentStatus = (lesson.questionRegenerationStatus as Record<number, {
      status: string;
      error?: string;
      startedAt?: number;
    }>) || {};

    // Update status for this question
    currentStatus[args.questionIndex] = {
      status: args.status,
      error: args.error,
      startedAt: args.status === "pending" || args.status === "regenerating" ? Date.now() : currentStatus[args.questionIndex]?.startedAt,
    };

    await ctx.db.patch(args.lessonId, {
      questionRegenerationStatus: currentStatus,
    });
  },
});

/**
 * Query to get question regeneration status for a lesson
 */
export const getQuestionRegenerationStatus = query({
  args: {
    lessonId: v.id("capsuleLessons"),
  },
  handler: async (ctx, args) => {
    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) return null;
    return lesson.questionRegenerationStatus as Record<number, {
      status: string;
      error?: string;
      startedAt?: number;
    }> | null;
  },
});

/**
 * Internal action to perform the actual question regeneration in background
 */
export const performQuestionRegeneration = internalAction({
  args: {
    lessonId: v.id("capsuleLessons"),
    questionIndex: v.number(),
    userFeedback: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    console.log(`[RegenerateQuestion] Starting background regeneration for lesson ${args.lessonId}, question ${args.questionIndex}`);

    try {
      // Mark as regenerating
      await ctx.runMutation(internal.capsuleGeneration.updateQuestionRegenerationStatus, {
        lessonId: args.lessonId,
        questionIndex: args.questionIndex,
        status: "regenerating",
      });

      // Get the lesson
      const lesson = await ctx.runQuery(api.capsules.getLesson, {
        lessonId: args.lessonId,
      });

      if (!lesson) {
        throw new Error("Lesson not found");
      }

      // Get current question
      const content = lesson.content as {
        practiceQuestions?: Array<{
          type: string;
          question?: string;
          instruction?: string;
          text?: string;
          options?: string[];
          correctIndex?: number;
          explanation?: string;
          blanks?: Array<{ id: string; correctAnswer: string; alternatives?: string[]; hint?: string }>;
          items?: Array<{ id: string; content: string }>;
          targets?: Array<{ id: string; label: string; acceptsItems: string[] }>;
          feedback?: { correct?: string; incorrect?: string };
        }>;
      } | undefined;

      const questions = content?.practiceQuestions || [];
      if (args.questionIndex < 0 || args.questionIndex >= questions.length) {
        throw new Error("Question not found at the specified index");
      }

      const currentQuestion = questions[args.questionIndex];

      // Get module and capsule for context
      const lessonModule = await ctx.runQuery(api.capsules.getModule, {
        moduleId: lesson.moduleId,
      });

      if (!lessonModule) {
        throw new Error("Module not found");
      }

      const capsule = await ctx.runQuery(api.capsules.getCapsule, {
        capsuleId: lesson.capsuleId,
      });

      if (!capsule) {
        throw new Error("Capsule not found");
      }

      // Get AI config
      const { resolveWithConvexCtx } = await import("../shared/ai/modelResolver");
      const modelConfig = await resolveWithConvexCtx(ctx, "capsule_generation");

      // Import regeneration function
      const { regenerateQuestion: generateQuestion } = await import("../shared/ai/generation/index");

      // Generate new question with retries
      let rawContent: string | null = null;
      let lastError = "";

      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          console.log(`[RegenerateQuestion] Retry attempt ${attempt + 1}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }

        try {
          rawContent = await generateQuestion(
            {
              currentQuestion,
              questionIndex: args.questionIndex,
              userFeedback: args.userFeedback,
              lessonContext: {
                lessonTitle: lesson.title,
                moduleTitle: lessonModule.title,
                capsuleTitle: capsule.title,
                lessonDescription: lesson.description || undefined,
              },
            },
            { modelConfig }
          );
          break;
        } catch (error) {
          lastError = error instanceof Error ? error.message : "Unknown error";
          console.warn(`[RegenerateQuestion] Attempt ${attempt + 1} failed: ${lastError}`);
        }
      }

      if (!rawContent) {
        throw new Error(`Failed to regenerate question after 3 attempts: ${lastError}`);
      }

      // Parse the response
      let newQuestion: typeof currentQuestion;

      const { extractJson } = await import("../shared/ai/response");
      const extraction = await extractJson<typeof currentQuestion>(rawContent, {
        stage: "regenerate_question",
      });

      if (!extraction.success) {
        throw new Error(`Failed to parse question response: ${extraction.error.message}`);
      }

      newQuestion = extraction.data;

      // Validate the new question
      if (!newQuestion.type) {
        throw new Error("Generated question is missing type");
      }

      // Type-specific validation
      if (newQuestion.type === "mcq") {
        if (!newQuestion.question || !newQuestion.options || newQuestion.options.length !== 4) {
          throw new Error("MCQ question must have a question and exactly 4 options");
        }
        if (typeof newQuestion.correctIndex !== "number" || newQuestion.correctIndex < 0 || newQuestion.correctIndex > 3) {
          throw new Error("MCQ correctIndex must be 0, 1, 2, or 3");
        }
      } else if (newQuestion.type === "fillBlanks") {
        if (!newQuestion.text || !newQuestion.blanks || newQuestion.blanks.length === 0) {
          throw new Error("Fill blanks question must have text and blanks");
        }
        const placeholders = newQuestion.text.match(/\{\{(\w+)\}\}/g) || [];
        if (placeholders.length !== newQuestion.blanks.length) {
          throw new Error(`Fill blanks: ${placeholders.length} placeholders but ${newQuestion.blanks.length} blanks defined`);
        }
      } else if (newQuestion.type === "dragDrop") {
        if (!newQuestion.items || !newQuestion.targets) {
          throw new Error("Drag & drop question must have items and targets");
        }
        if (newQuestion.items.length !== newQuestion.targets.length) {
          throw new Error(`Drag & drop: ${newQuestion.items.length} items but ${newQuestion.targets.length} targets (must be equal)`);
        }
        const assignedItems = new Set<string>();
        for (const target of newQuestion.targets) {
          if (!target.acceptsItems || target.acceptsItems.length === 0) {
            throw new Error("Each target must accept at least one item");
          }
          for (const itemId of target.acceptsItems) {
            assignedItems.add(itemId);
          }
        }
        for (const item of newQuestion.items) {
          if (!assignedItems.has(item.id)) {
            throw new Error(`Item "${item.id}" is not assigned to any target`);
          }
        }
      }

      // Update the lesson content with the new question
      const updatedQuestions = [...questions];
      updatedQuestions[args.questionIndex] = newQuestion;

      const updatedContent = {
        ...content,
        practiceQuestions: updatedQuestions,
      };

      // Save the updated content
      await ctx.runMutation(internal.capsules.updateLessonContent, {
        lessonId: args.lessonId,
        content: updatedContent,
      });

      // Mark as completed
      await ctx.runMutation(internal.capsuleGeneration.updateQuestionRegenerationStatus, {
        lessonId: args.lessonId,
        questionIndex: args.questionIndex,
        status: "completed",
      });

      console.log(`[RegenerateQuestion] Successfully regenerated question ${args.questionIndex} for lesson: ${lesson.title}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[RegenerateQuestion] Failed to regenerate question:`, error);

      // Mark as failed
      await ctx.runMutation(internal.capsuleGeneration.updateQuestionRegenerationStatus, {
        lessonId: args.lessonId,
        questionIndex: args.questionIndex,
        status: "failed",
        error: errorMessage,
      });
    }
  },
});

/**
 * Regenerate a single practice question in the background
 * This schedules a background job and returns immediately
 * Rate limited and owner-only access
 */
export const regenerateQuestion = action({
  args: {
    lessonId: v.id("capsuleLessons"),
    questionIndex: v.number(),
    userFeedback: v.optional(v.string()),
    userId: v.id("users"), // Required: User ID for ownership verification
  },
  handler: async (ctx, args) => {
    // Validate feedback length if provided
    if (args.userFeedback && args.userFeedback.length > 500) {
      throw new Error("Feedback is too long. Please keep it under 500 characters.");
    }

    console.log(`[RegenerateQuestion] Scheduling regeneration for lesson ${args.lessonId}, question ${args.questionIndex}`);

    // Get the lesson
    const lesson = await ctx.runQuery(api.capsules.getLesson, {
      lessonId: args.lessonId,
    });

    if (!lesson) {
      throw new Error("Lesson not found");
    }

    // Verify the question exists
    const content = lesson.content as {
      practiceQuestions?: Array<unknown>;
    } | undefined;

    const questions = content?.practiceQuestions || [];
    if (args.questionIndex < 0 || args.questionIndex >= questions.length) {
      throw new Error("Question not found at the specified index");
    }

    // Check if already regenerating
    const currentStatus = lesson.questionRegenerationStatus as Record<number, {
      status: string;
    }> | undefined;
    
    if (currentStatus?.[args.questionIndex]?.status === "pending" || 
        currentStatus?.[args.questionIndex]?.status === "regenerating") {
      throw new Error("This question is already being regenerated. Please wait.");
    }

    // Get the capsule for ownership check
    const capsule = await ctx.runQuery(api.capsules.getCapsule, {
      capsuleId: lesson.capsuleId,
    });

    if (!capsule) {
      throw new Error("Capsule not found");
    }

    // SECURITY: Verify ownership - only capsule owner can regenerate questions
    // Verify the user exists in database
    const user = await ctx.runQuery(api.auth.getUserById, { id: args.userId });
    if (!user) {
      throw new Error("User not found. Please sign in again.");
    }

    // Verify user owns this capsule
    if (user._id !== capsule.userId) {
      throw new Error("Unauthorized: Only the capsule owner can regenerate questions.");
    }

    // Rate limit check
    const userId = args.userId;
    const bucketKey = `question_regen:${userId}`;
    
    const rateCheck = await ctx.runQuery(api.rateLimit.checkRateLimit, {
      bucketKey,
    });

    if (!rateCheck.allowed) {
      const waitMinutes = Math.ceil((rateCheck.retryAfterMs || 60000) / 60000);
      throw new Error(
        `Rate limit exceeded. You can regenerate more questions in ${waitMinutes} minute(s).`
      );
    }

    // Record the request for rate limiting
    await ctx.runMutation(api.rateLimit.recordRequest, {
      bucketKey,
      maxRequests: 10,
      windowMs: 60 * 60 * 1000,
    });

    // Mark as pending
    await ctx.runMutation(internal.capsuleGeneration.updateQuestionRegenerationStatus, {
      lessonId: args.lessonId,
      questionIndex: args.questionIndex,
      status: "pending",
    });

    // Schedule the background regeneration
    await ctx.scheduler.runAfter(0, internal.capsuleGeneration.performQuestionRegeneration, {
      lessonId: args.lessonId,
      questionIndex: args.questionIndex,
      userFeedback: args.userFeedback,
    });

    return { 
      success: true, 
      lessonId: args.lessonId,
      questionIndex: args.questionIndex,
      status: "pending",
    };
  },
});
