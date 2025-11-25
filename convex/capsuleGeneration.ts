/**
 * Chunked Capsule Generation
 * 
 * Breaks generation into smaller chunks to avoid 600s timeout:
 * - Stage 1: Generate outline (schedules Stage 2)
 * - Stage 2: Generate lesson plans (schedules Stage 3)
 * - Stage 3: Generate content in batches of 5 lessons (self-schedules until done)
 * - Stage 4: Finalize and persist
 * 
 * Each stage saves progress to the database, enabling resumption on failure.
 */

import { v } from "convex/values";
import { action, internalAction, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";

// Import the canonical LessonType from schemas
import type { LessonType as SchemaLessonType } from "../shared/ai/schemas/types";

// Constants
const LESSONS_PER_BATCH = 5; // Generate 5 lessons per action to stay under timeout

// Local lesson type that includes runtime variants (for storage/persistence)
type LessonType = SchemaLessonType | "mixed";

// =============================================================================
// Types
// =============================================================================

interface GeneratedLesson {
  title: string;
  type: LessonType;
  content: unknown;
}

interface GeneratedModule {
  title: string;
  description?: string;
  lessons: GeneratedLesson[];
}

// Note: GenerationState interface removed - using inline types instead

// =============================================================================
// Helper: Create fallback content for failed generations
// =============================================================================

/**
 * Creates minimal valid content when AI generation fails
 * This ensures the lesson is at least displayable to users
 */
function createFallbackContent(lessonType: SchemaLessonType, title: string): unknown {
  switch (lessonType) {
    case "concept":
      return {
        conceptTitle: title,
        explanation: `This lesson about "${title}" could not be generated. Please try regenerating the course or contact support.`,
        keyPoints: ["Content generation failed", "Please try again later"],
        realWorldExample: undefined,
        visualAid: undefined,
      };
    
    case "mcq":
      return {
        question: `Question about "${title}" could not be generated.`,
        options: ["Option A", "Option B", "Option C", "Try regenerating"],
        correctAnswer: 3,
        explanation: "This question could not be generated. Please try regenerating the course.",
        hint: "Try regenerating the course",
      };
    
    case "fillBlanks":
      return {
        instruction: "Fill in the blanks to complete the statement.",
        text: `This lesson about "${title}" could not be generated. The content is {{blank-1}}.`,
        blanks: [
          {
            id: "blank-1",
            correctAnswer: "unavailable",
            alternatives: ["not available", "missing"],
            hint: "The content generation failed",
          },
        ],
      };
    
    case "dragDrop":
      return {
        instruction: `Drag and drop activity for "${title}" could not be generated.`,
        activityType: "matching" as const,
        items: [
          { id: "item-1", content: "Item 1" },
          { id: "item-2", content: "Item 2" },
        ],
        targets: [
          { id: "target-1", label: "Target 1", acceptsItems: ["item-1"] },
          { id: "target-2", label: "Target 2", acceptsItems: ["item-2"] },
        ],
        feedback: {
          correct: "Correct!",
          incorrect: "This activity could not be generated properly.",
        },
      };
    
    case "simulation":
      return {
        title: title,
        description: `Simulation for "${title}" could not be generated.`,
        simulationType: "html-css-js" as const,
        code: {
          html: `<div style="padding: 20px; text-align: center;">
            <h2>Simulation Unavailable</h2>
            <p>The simulation for "${title}" could not be generated.</p>
            <p>Please try regenerating the course.</p>
          </div>`,
          css: "body { font-family: sans-serif; }",
          javascript: "console.log('Simulation failed to generate');",
        },
        instructions: "This simulation could not be generated. Please try regenerating the course.",
        observationPrompts: ["Try regenerating the course"],
        learningGoals: ["Content generation failed"],
      };
    
    default:
      return {
        error: "Content generation failed",
        fallback: true,
        message: `Could not generate content for lesson type: ${lessonType}`,
      };
  }
}

// =============================================================================
// Queries for tracking generation progress
// =============================================================================

import { query } from "./_generated/server";

/**
 * Get generation status by ID (for frontend polling)
 */
export const getGenerationStatus = query({
  args: {
    generationId: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db
      .query("generationJobs")
      .withIndex("by_generationId", (q) => q.eq("generationId", args.generationId))
      .unique();
    
    if (!job) return null;
    
    // Calculate progress percentage
    let progress = 0;
    const state = job.state || "idle";
    
    if (state === "generating_outline") {
      progress = 5;
    } else if (state === "outline_complete") {
      progress = 15;
    } else if (state === "generating_lesson_plans") {
      progress = 20;
    } else if (state === "lesson_plans_complete") {
      progress = 30;
    } else if (state === "generating_content") {
      // Content generation is 30-90%
      const lessonsGenerated = job.lessonsGenerated || 0;
      const totalLessons = job.totalLessons || 1;
      progress = 30 + Math.round((lessonsGenerated / totalLessons) * 60);
    } else if (state === "content_complete") {
      progress = 95;
    } else if (state === "completed") {
      progress = 100;
    } else if (state === "failed") {
      progress = 0;
    }
    
    return {
      generationId: job.generationId,
      capsuleId: job.capsuleId,
      state,
      progress,
      lessonsGenerated: job.lessonsGenerated || 0,
      totalLessons: job.totalLessons || 0,
      totalModules: job.totalModules || 0,
      error: job.lastError,
      createdAt: job.startedAt,
      updatedAt: job.updatedAt,
    };
  },
});

/**
 * Get generation status by capsule ID
 */
export const getGenerationStatusByCapsule = query({
  args: {
    capsuleId: v.id("capsules"),
  },
  handler: async (ctx, args) => {
    // Get most recent generation job for this capsule
    const job = await ctx.db
      .query("generationJobs")
      .withIndex("by_capsuleId", (q) => q.eq("capsuleId", args.capsuleId))
      .order("desc")
      .first();
    
    if (!job) return null;
    
    // Calculate progress percentage
    let progress = 0;
    const state = job.state || "idle";
    
    if (state === "generating_outline") {
      progress = 5;
    } else if (state === "outline_complete") {
      progress = 15;
    } else if (state === "generating_lesson_plans") {
      progress = 20;
    } else if (state === "lesson_plans_complete") {
      progress = 30;
    } else if (state === "generating_content") {
      const lessonsGenerated = job.lessonsGenerated || 0;
      const totalLessons = job.totalLessons || 1;
      progress = 30 + Math.round((lessonsGenerated / totalLessons) * 60);
    } else if (state === "content_complete") {
      progress = 95;
    } else if (state === "completed") {
      progress = 100;
    } else if (state === "failed") {
      progress = 0;
    }
    
    return {
      generationId: job.generationId,
      capsuleId: job.capsuleId,
      state,
      progress,
      lessonsGenerated: job.lessonsGenerated || 0,
      totalLessons: job.totalLessons || 0,
      totalModules: job.totalModules || 0,
      error: job.lastError,
      createdAt: job.startedAt,
      updatedAt: job.updatedAt,
    };
  },
});

// =============================================================================
// Internal Mutations for State Management
// =============================================================================

/**
 * Save generation progress to allow resumption
 */
export const saveGenerationProgress = internalMutation({
  args: {
    generationId: v.string(),
    state: v.optional(v.string()),
    outlineJson: v.optional(v.string()),
    lessonPlansJson: v.optional(v.string()),
    generatedContentJson: v.optional(v.string()),
    lessonsGenerated: v.optional(v.number()),
    currentModuleIndex: v.optional(v.number()),
    currentLessonIndex: v.optional(v.number()),
    totalModules: v.optional(v.number()),
    totalLessons: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { generationId, ...updates } = args;
    
    const job = await ctx.db
      .query("generationJobs")
      .withIndex("by_generationId", (q) => q.eq("generationId", generationId))
      .unique();
    
    if (!job) {
      throw new Error(`Generation job not found: ${generationId}`);
    }
    
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    
    if (updates.state) patch.state = updates.state;
    if (updates.outlineJson !== undefined) patch.outlineJson = updates.outlineJson;
    if (updates.lessonPlansJson !== undefined) patch.lessonPlansJson = updates.lessonPlansJson;
    if (updates.generatedContentJson !== undefined) patch.generatedContentJson = updates.generatedContentJson;
    if (updates.lessonsGenerated !== undefined) patch.lessonsGenerated = updates.lessonsGenerated;
    if (updates.currentModuleIndex !== undefined) patch.currentModuleIndex = updates.currentModuleIndex;
    if (updates.currentLessonIndex !== undefined) patch.currentLessonIndex = updates.currentLessonIndex;
    if (updates.totalModules !== undefined) patch.totalModules = updates.totalModules;
    if (updates.totalLessons !== undefined) patch.totalLessons = updates.totalLessons;
    if (updates.state) patch.outlineGenerated = updates.state !== "idle" && updates.state !== "generating_outline";
    
    await ctx.db.patch(job._id, patch);
  },
});

/**
 * Mark generation as failed
 */
export const markGenerationFailed = internalMutation({
  args: {
    generationId: v.string(),
    capsuleId: v.id("capsules"),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    // Update job
    const job = await ctx.db
      .query("generationJobs")
      .withIndex("by_generationId", (q) => q.eq("generationId", args.generationId))
      .unique();
    
    if (job) {
      await ctx.db.patch(job._id, {
        state: "failed",
        lastError: args.errorMessage,
        updatedAt: Date.now(),
      });
    }
    
    // Update capsule
    await ctx.db.patch(args.capsuleId, {
      status: "failed",
      errorMessage: args.errorMessage,
      updatedAt: Date.now(),
    });
  },
});

// =============================================================================
// Stage 1: Generate Outline
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
    console.log(`[Stage 1] Starting outline generation for ${args.generationId}`);
    
    try {
      // Get AI config
      const { resolveWithConvexCtx, MissingAIModelMappingError } = await import(
        "../shared/ai/modelResolver"
      );
      
      let modelConfig;
      try {
        modelConfig = await resolveWithConvexCtx(ctx, "capsule_generation");
      } catch (resolverError) {
        throw new Error(
          resolverError instanceof MissingAIModelMappingError
            ? "AI model not configured. Please configure in admin panel."
            : "Failed to resolve AI model configuration."
        );
      }
      
      // Create AI client
      const { createAIClient } = await import("../shared/ai/client");
      const client = createAIClient({
        provider: modelConfig.provider as "google" | "openai",
        apiKey: modelConfig.apiKey,
        modelId: modelConfig.modelId,
      });
      
      // Import stage handler
      const { generateOutline: runOutlineStage } = await import("../shared/ai/generation/stages");
      
      // Build input
      const input = {
        sourceType: args.pdfBase64 ? "pdf" as const : "topic" as const,
        pdfBase64: args.pdfBase64,
        pdfMimeType: args.pdfMimeType || "application/pdf",
        topic: args.topic,
        guidance: args.guidance,
      };
      
      // Generate outline
      const context = {
        generationId: args.generationId,
        capsuleId: args.capsuleId,
        attempt: 0,
        maxAttempts: 3,
      };
      
      const result = await runOutlineStage(client, input, context);
      
      if (!result.success) {
        throw new Error(result.error || "Failed to generate outline");
      }
      
      // Calculate totals
      const outline = result.data;
      const totalModules = outline.modules.length;
      const totalLessons = outline.modules.reduce(
        (sum: number, mod: { lessonCount: number }) => sum + mod.lessonCount,
        0
      );
      
      console.log(`[Stage 1] Outline generated: ${totalModules} modules, ${totalLessons} lessons`);
      
      // Save progress
      await ctx.runMutation(internal.capsuleGeneration.saveGenerationProgress, {
        generationId: args.generationId,
        state: "outline_complete",
        outlineJson: JSON.stringify(outline),
        totalModules,
        totalLessons,
      });
      
      // Schedule Stage 2
      await ctx.scheduler.runAfter(0, internal.capsuleGeneration.generateLessonPlans, {
        capsuleId: args.capsuleId,
        generationId: args.generationId,
        pdfBase64: args.pdfBase64,
        pdfMimeType: args.pdfMimeType,
        topic: args.topic,
        guidance: args.guidance,
        outlineJson: JSON.stringify(outline),
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
// Stage 2: Generate Lesson Plans
// =============================================================================

export const generateLessonPlans = internalAction({
  args: {
    capsuleId: v.id("capsules"),
    generationId: v.string(),
    pdfBase64: v.optional(v.string()),
    pdfMimeType: v.optional(v.string()),
    topic: v.optional(v.string()),
    guidance: v.optional(v.string()),
    outlineJson: v.string(),
  },
  handler: async (ctx, args) => {
    console.log(`[Stage 2] Starting lesson plan generation for ${args.generationId}`);
    
    try {
      const outline = JSON.parse(args.outlineJson);
      
      // Get AI config
      const { resolveWithConvexCtx } = await import("../shared/ai/modelResolver");
      const modelConfig = await resolveWithConvexCtx(ctx, "capsule_generation");
      
      // Create AI client
      const { createAIClient } = await import("../shared/ai/client");
      const client = createAIClient({
        provider: modelConfig.provider as "google" | "openai",
        apiKey: modelConfig.apiKey,
        modelId: modelConfig.modelId,
      });
      
      // Import stage handler
      const { generateLessonPlan: runLessonPlanStage } = await import("../shared/ai/generation/stages");
      
      // Build base input with capsule info from outline
      const baseInput = {
        sourceType: args.pdfBase64 ? "pdf" as const : "topic" as const,
        pdfBase64: args.pdfBase64,
        pdfMimeType: args.pdfMimeType || "application/pdf",
        topic: args.topic,
        guidance: args.guidance,
        capsuleTitle: outline.title as string,
        capsuleDescription: outline.description as string,
      };
      
      // Generate lesson plans for all modules
      const lessonPlans: Array<{
        moduleIndex: number;
        moduleTitle: string;
        lessons: Array<{
          title: string;
          type: LessonType;
          description: string;
          objectives: string[];
        }>;
      }> = [];
      
      for (let i = 0; i < outline.modules.length; i++) {
        const outlineMod = outline.modules[i];
        console.log(`[Stage 2] Generating plan for module ${i + 1}/${outline.modules.length}: ${outlineMod.title}`);
        
        // Update progress
        await ctx.runMutation(internal.capsuleGeneration.saveGenerationProgress, {
          generationId: args.generationId,
          state: "generating_lesson_plans",
          currentModuleIndex: i,
        });
        
        const context = {
          generationId: args.generationId,
          capsuleId: args.capsuleId,
          attempt: 0,
          maxAttempts: 3,
        };
        
        const result = await runLessonPlanStage(
          client,
          {
            ...baseInput,
            moduleTitle: outlineMod.title,
            moduleDescription: outlineMod.description,
            lessonCount: outlineMod.lessonCount,
            moduleIndex: i,
          },
          context
        );
        
        if (!result.success) {
          throw new Error(result.error || `Failed to generate lesson plan for module ${i + 1}`);
        }
        
        lessonPlans.push({
          moduleIndex: i,
          moduleTitle: outlineMod.title,
          lessons: result.data.lessons.map((l) => ({
            title: l.title,
            type: l.lessonType as LessonType,
            description: l.objective,
            objectives: [l.objective],
          })),
        });
      }
      
      console.log(`[Stage 2] All lesson plans generated`);
      
      // Save progress
      await ctx.runMutation(internal.capsuleGeneration.saveGenerationProgress, {
        generationId: args.generationId,
        state: "lesson_plans_complete",
        lessonPlansJson: JSON.stringify(lessonPlans),
      });
      
      // Schedule Stage 3 (first batch)
      await ctx.scheduler.runAfter(0, internal.capsuleGeneration.generateContentBatch, {
        capsuleId: args.capsuleId,
        generationId: args.generationId,
        pdfBase64: args.pdfBase64,
        pdfMimeType: args.pdfMimeType,
        topic: args.topic,
        guidance: args.guidance,
        outlineJson: args.outlineJson,
        lessonPlansJson: JSON.stringify(lessonPlans),
        generatedContentJson: JSON.stringify([]),
        currentModuleIndex: 0,
        currentLessonIndex: 0,
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error in lesson plan generation";
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
// Stage 3: Generate Content (in batches)
// =============================================================================

export const generateContentBatch = internalAction({
  args: {
    capsuleId: v.id("capsules"),
    generationId: v.string(),
    pdfBase64: v.optional(v.string()),
    pdfMimeType: v.optional(v.string()),
    topic: v.optional(v.string()),
    guidance: v.optional(v.string()),
    outlineJson: v.string(),
    lessonPlansJson: v.string(),
    generatedContentJson: v.string(),
    currentModuleIndex: v.number(),
    currentLessonIndex: v.number(),
  },
  handler: async (ctx, args) => {
    console.log(`[Stage 3] Starting content batch at module ${args.currentModuleIndex}, lesson ${args.currentLessonIndex}`);
    
    try {
      const outline = JSON.parse(args.outlineJson);
      const lessonPlans = JSON.parse(args.lessonPlansJson);
      const generatedContent: GeneratedModule[] = JSON.parse(args.generatedContentJson);
      
      // Get AI config
      const { resolveWithConvexCtx } = await import("../shared/ai/modelResolver");
      const modelConfig = await resolveWithConvexCtx(ctx, "capsule_generation");
      
      // Create AI client
      const { createAIClient } = await import("../shared/ai/client");
      const client = createAIClient({
        provider: modelConfig.provider as "google" | "openai",
        apiKey: modelConfig.apiKey,
        modelId: modelConfig.modelId,
      });
      
      // Import stage handler
      const { generateLessonContent: runContentStage } = await import("../shared/ai/generation/stages");
      
      // Build base input with capsule info from outline
      const baseInput = {
        sourceType: args.pdfBase64 ? "pdf" as const : "topic" as const,
        pdfBase64: args.pdfBase64,
        pdfMimeType: args.pdfMimeType || "application/pdf",
        topic: args.topic,
        guidance: args.guidance,
        capsuleTitle: outline.title as string,
      };
      
      // Calculate total lessons for progress
      const totalLessons = lessonPlans.reduce(
        (sum: number, plan: { lessons: unknown[] }) => sum + plan.lessons.length,
        0
      );
      
      // Process lessons in this batch
      let moduleIndex = args.currentModuleIndex;
      let lessonIndex = args.currentLessonIndex;
      let lessonsProcessed = 0;
      let totalLessonsGenerated = generatedContent.reduce(
        (sum, mod) => sum + mod.lessons.length,
        0
      );
      
      // Initialize module in generated content if needed
      while (generatedContent.length <= moduleIndex) {
        const outlineMod = outline.modules[generatedContent.length];
        generatedContent.push({
          title: outlineMod.title,
          description: outlineMod.description,
          lessons: [],
        });
      }
      
      while (lessonsProcessed < LESSONS_PER_BATCH && moduleIndex < lessonPlans.length) {
        const modulePlan = lessonPlans[moduleIndex];
        
        if (lessonIndex >= modulePlan.lessons.length) {
          // Move to next module
          moduleIndex++;
          lessonIndex = 0;
          
          // Initialize next module
          if (moduleIndex < outline.modules.length && generatedContent.length <= moduleIndex) {
            const outlineMod = outline.modules[moduleIndex];
            generatedContent.push({
              title: outlineMod.title,
              description: outlineMod.description,
              lessons: [],
            });
          }
          continue;
        }
        
        const lesson = modulePlan.lessons[lessonIndex];
        totalLessonsGenerated++;
        
        console.log(`[Stage 3] Generating content ${totalLessonsGenerated}/${totalLessons}: ${lesson.title}`);
        
        // Update progress
        await ctx.runMutation(internal.capsuleGeneration.saveGenerationProgress, {
          generationId: args.generationId,
          state: "generating_content",
          currentModuleIndex: moduleIndex,
          currentLessonIndex: lessonIndex,
          lessonsGenerated: totalLessonsGenerated,
        });
        
        const context = {
          generationId: args.generationId,
          capsuleId: args.capsuleId,
          attempt: 0,
          maxAttempts: 3,
        };
        
        // Map "mixed" type to "concept" for content generation (fallback)
        const lessonTypeForGeneration = (lesson.type === "mixed" ? "concept" : lesson.type) as SchemaLessonType;
        
        // Generate content for this lesson with retry logic
        let result: Awaited<ReturnType<typeof runContentStage>> | null = null;
        let lastError = "";
        
        for (let attempt = 0; attempt < 3; attempt++) {
          if (attempt > 0) {
            console.log(`[Stage 3] Retry attempt ${attempt + 1} for ${lesson.title}`);
            // Small delay before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
          
          result = await runContentStage(
            client,
            {
              ...baseInput,
              lessonTitle: lesson.title,
              lessonType: lessonTypeForGeneration,
              lessonObjective: lesson.description || lesson.objectives?.[0] || "",
              moduleTitle: modulePlan.moduleTitle,
              moduleIndex,
              lessonIndex,
            },
            { ...context, attempt }
          );
          
          if (result.success) {
            break;
          }
          
          lastError = result.error || "Unknown error";
          console.warn(`[Stage 3] Attempt ${attempt + 1} failed for ${lesson.title}: ${lastError}`);
        }
        
        if (!result || !result.success) {
          console.warn(`[Stage 3] All attempts failed for ${lesson.title}, using fallback. Last error: ${lastError}`);
          // Add placeholder content on failure - create minimal valid content based on type
          const fallbackContent = createFallbackContent(lessonTypeForGeneration, lesson.title);
          generatedContent[moduleIndex].lessons.push({
            title: lesson.title,
            type: lesson.type as LessonType,
            content: fallbackContent,
          });
        } else {
          // IMPORTANT: result.data contains { lessonTitle, lessonType, content }
          // We only want the inner content object
          generatedContent[moduleIndex].lessons.push({
            title: lesson.title,
            type: lesson.type as LessonType,
            content: result.data.content,
          });
        }
        
        lessonIndex++;
        lessonsProcessed++;
      }
      
      // Check if we're done
      const allDone = moduleIndex >= lessonPlans.length || 
        (moduleIndex === lessonPlans.length - 1 && lessonIndex >= lessonPlans[moduleIndex]?.lessons?.length);
      
      if (allDone) {
        console.log(`[Stage 3] All content generated, moving to finalization`);
        
        // Save final content
        await ctx.runMutation(internal.capsuleGeneration.saveGenerationProgress, {
          generationId: args.generationId,
          state: "content_complete",
          generatedContentJson: JSON.stringify(generatedContent),
          lessonsGenerated: totalLessonsGenerated,
        });
        
        // Schedule finalization
        await ctx.scheduler.runAfter(0, internal.capsuleGeneration.finalizeGeneration, {
          capsuleId: args.capsuleId,
          generationId: args.generationId,
          outlineJson: args.outlineJson,
          generatedContentJson: JSON.stringify(generatedContent),
        });
      } else {
        console.log(`[Stage 3] Batch complete, scheduling next batch at module ${moduleIndex}, lesson ${lessonIndex}`);
        
        // Save progress and schedule next batch
        await ctx.runMutation(internal.capsuleGeneration.saveGenerationProgress, {
          generationId: args.generationId,
          generatedContentJson: JSON.stringify(generatedContent),
          lessonsGenerated: totalLessonsGenerated,
        });
        
        // Schedule next batch
        await ctx.scheduler.runAfter(0, internal.capsuleGeneration.generateContentBatch, {
          capsuleId: args.capsuleId,
          generationId: args.generationId,
          pdfBase64: args.pdfBase64,
          pdfMimeType: args.pdfMimeType,
          topic: args.topic,
          guidance: args.guidance,
          outlineJson: args.outlineJson,
          lessonPlansJson: args.lessonPlansJson,
          generatedContentJson: JSON.stringify(generatedContent),
          currentModuleIndex: moduleIndex,
          currentLessonIndex: lessonIndex,
        });
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error in content generation";
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
// Stage 4: Finalize Generation
// =============================================================================

export const finalizeGeneration = internalAction({
  args: {
    capsuleId: v.id("capsules"),
    generationId: v.string(),
    outlineJson: v.string(),
    generatedContentJson: v.string(),
  },
  handler: async (ctx, args) => {
    console.log(`[Stage 4] Finalizing generation for ${args.generationId}`);
    
    try {
      const outline = JSON.parse(args.outlineJson);
      const generatedContent: GeneratedModule[] = JSON.parse(args.generatedContentJson);
      
      // Persist content to database
      console.log(`[Stage 4] Persisting ${generatedContent.length} modules`);
      
      // Update capsule metadata
      await ctx.runMutation(api.capsules.updateCapsuleMetadata, {
        capsuleId: args.capsuleId,
        description: outline.description,
      });
      
      // Persist modules and lessons
      const { moduleCount } = await ctx.runMutation(
        api.capsules.persistGeneratedCapsuleContent,
        {
          capsuleId: args.capsuleId,
          modules: generatedContent.map((mod) => ({
            title: mod.title,
            description: mod.description,
            lessons: mod.lessons.map((lesson) => ({
              title: lesson.title,
              lessonType: lesson.type,
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
      await ctx.runMutation(api.capsulesV2.updateGenerationJob, {
        generationId: args.generationId,
        state: "completed",
        completedAt: Date.now(),
      });
      
      console.log(`[Stage 4] Generation completed successfully!`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error in finalization";
      console.error(`[Stage 4] Failed:`, error);
      
      await ctx.runMutation(internal.capsuleGeneration.markGenerationFailed, {
        generationId: args.generationId,
        capsuleId: args.capsuleId,
        errorMessage,
      });
    }
  },
});

// =============================================================================
// Entry Point: Start Chunked Generation
// =============================================================================

/**
 * Start chunked capsule generation
 * This replaces the old generateCapsuleContentV2 for large courses
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
    if (capsule.sourceType === "pdf" && !capsule.sourcePdfStorageId && !capsule.sourcePdfData) {
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
    await ctx.runMutation(api.capsulesV2.createGenerationJob, {
      capsuleId: args.capsuleId,
      generationId,
    });
    
    // Fetch PDF if needed
    let pdfBase64: string | undefined;
    if (capsule.sourceType === "pdf") {
      if (capsule.sourcePdfStorageId) {
        console.log("[Chunked] Fetching PDF from storage...");
        pdfBase64 = await ctx.runAction(api.capsules.getPdfBase64, {
          storageId: capsule.sourcePdfStorageId,
        });
        console.log("[Chunked] PDF fetched successfully");
      } else if (capsule.sourcePdfData) {
        pdfBase64 = capsule.sourcePdfData;
      }
    }
    
    // Schedule Stage 1
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
 * Regenerate a single failed lesson
 * This allows users to retry content generation for specific lessons
 * without regenerating the entire capsule
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
    
    // Create AI client
    const { createAIClient } = await import("../shared/ai/client");
    const client = createAIClient({
      provider: modelConfig.provider as "google" | "openai",
      apiKey: modelConfig.apiKey,
      modelId: modelConfig.modelId,
    });
    
    // Import stage handler
    const { generateLessonContent } = await import("../shared/ai/generation/stages");
    
    // Fetch PDF if needed
    let pdfBase64: string | undefined;
    if (capsule.sourceType === "pdf") {
      if (capsule.sourcePdfStorageId) {
        console.log("[Regenerate] Fetching PDF from storage...");
        pdfBase64 = await ctx.runAction(api.capsules.getPdfBase64, {
          storageId: capsule.sourcePdfStorageId,
        });
      } else if (capsule.sourcePdfData) {
        pdfBase64 = capsule.sourcePdfData;
      }
    }
    
    // Build input
    const input = {
      sourceType: capsule.sourceType as "pdf" | "topic",
      pdfBase64,
      pdfMimeType: capsule.sourcePdfMime || "application/pdf",
      topic: capsule.sourceTopic,
      guidance: capsule.userPrompt,
      capsuleTitle: capsule.title,
      lessonTitle: lesson.title,
      lessonType: lesson.type as SchemaLessonType,
      lessonObjective: lesson.description || `Learn about ${lesson.title}`,
      moduleTitle: lessonModule.title,
      moduleIndex: lessonModule.order,
      lessonIndex: lesson.order,
    };
    
    const context = {
      generationId: `regen_${Date.now()}`,
      capsuleId: lesson.capsuleId,
      attempt: 0,
      maxAttempts: 3,
    };
    
    // Try to generate content with retries
    let result: Awaited<ReturnType<typeof generateLessonContent>> | null = null;
    let lastError = "";
    
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        console.log(`[Regenerate] Retry attempt ${attempt + 1} for ${lesson.title}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
      
      result = await generateLessonContent(client, input, { ...context, attempt });
      
      if (result.success) {
        break;
      }
      
      lastError = result.error || "Unknown error";
      console.warn(`[Regenerate] Attempt ${attempt + 1} failed: ${lastError}`);
    }
    
    if (!result || !result.success) {
      console.error(`[Regenerate] All attempts failed for ${lesson.title}: ${lastError}`);
      throw new Error(`Failed to regenerate lesson: ${lastError}`);
    }
    
    // Update the lesson with new content
    await ctx.runMutation(api.capsules.updateLessonContent, {
      lessonId: args.lessonId,
      content: result.data.content,
    });
    
    console.log(`[Regenerate] Successfully regenerated lesson: ${lesson.title}`);
    
    return { success: true, lessonId: args.lessonId };
  },
});
