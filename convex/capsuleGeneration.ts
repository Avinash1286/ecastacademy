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
import { action, internalAction, internalMutation } from "./_generated/server";
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

export const saveGenerationProgress = internalMutation({
  args: {
    generationId: v.string(),
    state: v.string(),
    currentModuleIndex: v.optional(v.number()),
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

    try {
      // Get AI model config
      const { resolveWithConvexCtx } = await import("../shared/ai/modelResolver");
      const modelConfig = await resolveWithConvexCtx(ctx, "capsule_generation");

      // Import generation function
      const { generateCapsuleOutline } = await import("../shared/ai/generation/index");
      const { capsuleOutlineSchema } = await import("../shared/capsule/schemas");

      // Build input
      const sourceType = args.pdfBase64 ? "pdf" : "topic";
      const pdfBuffer = args.pdfBase64 
        ? Buffer.from(args.pdfBase64, "base64").buffer 
        : undefined;

      // Generate outline
      const rawOutline = await generateCapsuleOutline(
        {
          sourceType,
          pdfBuffer,
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
        outline = capsuleOutlineSchema.parse(parsed);
      } catch (parseError) {
        console.error("[Stage 1] Failed to parse outline:", parseError);
        throw new Error(`Failed to parse outline: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }

      console.log(`[Stage 1] Outline generated: ${outline.title} with ${outline.modules.length} modules`);

      // Update capsule with title from outline
      await ctx.runMutation(api.capsules.updateCapsuleMetadata, {
        capsuleId: args.capsuleId,
        title: outline.title,
        description: outline.description,
        estimatedDuration: outline.estimatedDuration,
      });

      // Save progress
      await ctx.runMutation(internal.capsuleGeneration.saveGenerationProgress, {
        generationId: args.generationId,
        state: "outline_complete",
        outlineJson: JSON.stringify(outline),
      });

      // Schedule Stage 2 (module content generation)
      await ctx.scheduler.runAfter(0, internal.capsuleGeneration.generateModulesBatch, {
        capsuleId: args.capsuleId,
        generationId: args.generationId,
        pdfBase64: args.pdfBase64,
        pdfMimeType: args.pdfMimeType,
        topic: args.topic,
        guidance: args.guidance,
        outlineJson: JSON.stringify(outline),
        currentModuleIndex: 0,
        generatedModulesJson: JSON.stringify([]),
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
    pdfBase64: v.optional(v.string()),
    pdfMimeType: v.optional(v.string()),
    topic: v.optional(v.string()),
    guidance: v.optional(v.string()),
    outlineJson: v.string(),
    currentModuleIndex: v.number(),
    generatedModulesJson: v.string(),
  },
  handler: async (ctx, args) => {
    const outline: ParsedOutline = JSON.parse(args.outlineJson);
    const generatedModules: GeneratedModule[] = JSON.parse(args.generatedModulesJson);

    console.log(`[Stage 2] Processing module ${args.currentModuleIndex + 1}/${outline.modules.length}`);

    try {
      // Check if we're done
      if (args.currentModuleIndex >= outline.modules.length) {
        console.log(`[Stage 2] All modules generated, moving to finalization`);

        // Schedule finalization
        await ctx.scheduler.runAfter(0, internal.capsuleGeneration.finalizeGeneration, {
          capsuleId: args.capsuleId,
          generationId: args.generationId,
          outlineJson: args.outlineJson,
          generatedModulesJson: JSON.stringify(generatedModules),
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

      // Get AI model config
      const { resolveWithConvexCtx } = await import("../shared/ai/modelResolver");
      const modelConfig = await resolveWithConvexCtx(ctx, "capsule_generation");

      // Import generation function
      const { generateModuleContent } = await import("../shared/ai/generation/index");
      const { moduleContentSchema } = await import("../shared/capsule/schemas");

      // Build input
      const sourceType = args.pdfBase64 ? "pdf" : "topic";
      const pdfBuffer = args.pdfBase64 
        ? Buffer.from(args.pdfBase64, "base64").buffer 
        : undefined;

      console.log(`[Stage 2] Generating content for module: ${currentOutlineModule.title}`);

      // Generate module content (this generates ALL lessons in the module in one call!)
      const rawModuleContent = await generateModuleContent(
        {
          sourceType,
          pdfBuffer,
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
        
        // Create fallback module content
        moduleContent = {
          moduleId: `module-${args.currentModuleIndex}`,
          title: currentOutlineModule.title,
          introduction: currentOutlineModule.description,
          learningObjectives: [],
          lessons: currentOutlineModule.lessons.map((lesson, idx) => ({
            lessonId: `lesson-${args.currentModuleIndex}-${idx}`,
            title: lesson.title,
            content: {
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

      // Add to generated modules
      generatedModules.push({
        title: moduleContent.title,
        description: currentOutlineModule.description,
        introduction: moduleContent.introduction,
        learningObjectives: moduleContent.learningObjectives,
        moduleSummary: moduleContent.moduleSummary,
        lessons: moduleContent.lessons.map(lesson => ({
          title: lesson.title,
          content: lesson.content,
        })),
      });

      // Save progress
      await ctx.runMutation(internal.capsuleGeneration.saveGenerationProgress, {
        generationId: args.generationId,
        state: `module_${args.currentModuleIndex + 1}_complete`,
        currentModuleIndex: args.currentModuleIndex,
        modulesContentJson: JSON.stringify(generatedModules),
      });

      // Schedule next module (self-scheduling for continuation)
      await ctx.scheduler.runAfter(0, internal.capsuleGeneration.generateModulesBatch, {
        capsuleId: args.capsuleId,
        generationId: args.generationId,
        pdfBase64: args.pdfBase64,
        pdfMimeType: args.pdfMimeType,
        topic: args.topic,
        guidance: args.guidance,
        outlineJson: args.outlineJson,
        currentModuleIndex: args.currentModuleIndex + 1,
        generatedModulesJson: JSON.stringify(generatedModules),
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
    generatedModulesJson: v.string(),
  },
  handler: async (ctx, args) => {
    console.log(`[Stage 3] Finalizing generation for ${args.generationId}`);

    try {
      const outline: ParsedOutline = JSON.parse(args.outlineJson);
      const generatedModules: GeneratedModule[] = JSON.parse(args.generatedModulesJson);

      console.log(`[Stage 3] Persisting ${generatedModules.length} modules`);

      // Update capsule metadata
      await ctx.runMutation(api.capsules.updateCapsuleMetadata, {
        capsuleId: args.capsuleId,
        description: outline.description,
      });

      // Persist modules and lessons using the module-wise structure
      const { moduleCount } = await ctx.runMutation(
        api.capsules.persistGeneratedCapsuleContent,
        {
          capsuleId: args.capsuleId,
          modules: generatedModules.map((mod) => ({
            title: mod.title,
            description: mod.description,
            introduction: mod.introduction,
            learningObjectives: mod.learningObjectives,
            moduleSummary: mod.moduleSummary,
            lessons: mod.lessons.map((lesson) => ({
              title: lesson.title,
              content: lesson.content,
            })),
          })),
        }
      );

      // Clear source data (delete PDF from storage)
      await ctx.runMutation(api.capsules.clearCapsuleSourceData, {
        capsuleId: args.capsuleId,
      });

      // Update final status
      await ctx.runMutation(api.capsules.updateCapsuleStatus, {
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
      await ctx.runMutation(api.capsules.updateCapsuleStatus, {
        capsuleId: args.capsuleId,
        status: "failed",
        errorMessage: "PDF data missing for capsule",
      });
      throw new Error("PDF data missing for capsule");
    }

    if (capsule.sourceType === "topic" && !capsule.sourceTopic) {
      await ctx.runMutation(api.capsules.updateCapsuleStatus, {
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
    await ctx.runMutation(api.capsules.updateCapsuleStatus, {
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
 * Regenerate a single lesson using the lesson-specific prompt
 * This is for fixing individual failed lessons without regenerating the entire module
 */
export const regenerateLesson = action({
  args: {
    lessonId: v.id("capsuleLessons"),
  },
  handler: async (ctx, args) => {
    console.log(`[Regenerate] Starting regeneration for lesson ${args.lessonId}`);

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
    let pdfBuffer: ArrayBuffer | undefined;
    if (capsule.sourceType === "pdf" && capsule.sourcePdfStorageId) {
      console.log("[Regenerate] Fetching PDF from storage...");
      const pdfBase64 = await ctx.runAction(api.capsules.getPdfBase64, {
        storageId: capsule.sourcePdfStorageId,
      });
      if (pdfBase64) {
        pdfBuffer = Buffer.from(pdfBase64, "base64").buffer;
      }
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
            pdfBuffer,
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

    // Parse the content
    const { moduleContentSchema } = await import("../shared/capsule/schemas");
    let parsedContent: unknown;

    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No valid JSON found in response");
      }
      
      // The single lesson endpoint returns a different structure, parse accordingly
      const parsed = JSON.parse(jsonMatch[0]);
      
      // If it looks like full module content, extract just this lesson
      if (parsed.lessons && Array.isArray(parsed.lessons)) {
        const lessonData = moduleContentSchema.parse(parsed);
        parsedContent = lessonData.lessons[0]?.content || parsed;
      } else if (parsed.content) {
        parsedContent = parsed.content;
      } else {
        parsedContent = parsed;
      }
    } catch (parseError) {
      console.error("[Regenerate] Failed to parse content:", parseError);
      throw new Error(`Failed to parse regenerated content: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }

    // Update the lesson with new content
    await ctx.runMutation(api.capsules.updateLessonContent, {
      lessonId: args.lessonId,
      content: parsedContent,
    });

    console.log(`[Regenerate] Successfully regenerated lesson: ${lesson.title}`);

    return { success: true, lessonId: args.lessonId };
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

    // Rate limit check - reuse capsule generation rate limit bucket
    const userId = capsule.userId;
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

    // Parse the response
    let newVisualization: {
      title?: string;
      description?: string;
      type?: string;
      html?: string;
      css?: string;
      javascript?: string;
    };

    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No valid JSON found in response");
      }
      newVisualization = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      if (!newVisualization.html && !newVisualization.javascript) {
        throw new Error("Generated visualization is missing code");
      }
    } catch (parseError) {
      console.error("[RegenerateViz] Failed to parse response:", parseError);
      throw new Error("Failed to parse the generated visualization. Please try again.");
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
    await ctx.runMutation(api.capsules.updateLessonContent, {
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
