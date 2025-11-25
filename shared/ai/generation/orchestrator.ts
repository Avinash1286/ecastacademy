/**
 * Capsule Generation Orchestrator
 * 
 * Coordinates the multi-stage generation process:
 * 1. Generate Outline (modules structure)
 * 2. Generate Lesson Plans (per module)
 * 3. Generate Content (per lesson)
 * 
 * Features:
 * - State machine for resumption
 * - Progress callbacks for UI updates
 * - Token tracking for cost estimation
 * - Error isolation (one failed lesson doesn't fail all)
 */

import type { AIClient, AIModelConfig } from "../client";
import { createAIClient } from "../client";
import {
  generateOutline,
  generateLessonPlan,
  generateLessonContent,
  type OutlineInput,
  type LessonPlanInput,
  type LessonContentInput,
  type StageContext,
  type OutlineOutput,
} from "./stages";
import {
  GenerationStateMachine,
  type GenerationProgress,
  getProgressPercentage,
} from "./stateMachine";
import type { LessonType } from "../schemas/types";
import { CapsuleError, ErrorCode } from "../errors";

// =============================================================================
// Types
// =============================================================================

export interface GenerationConfig {
  /** AI model configuration */
  aiConfig: AIModelConfig;
  /** Max retries per stage */
  maxRetries?: number;
  /** Progress callback */
  onProgress?: (progress: GenerationProgress, message: string) => void;
  /** Enable debug logging */
  debug?: boolean;
}

export interface TopicGenerationInput {
  type: "topic";
  topic: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  guidance?: string;
  targetModules?: number;
  targetLessonsPerModule?: number;
}

export interface PDFGenerationInput {
  type: "pdf";
  pdfBase64: string;
  pdfMimeType?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  guidance?: string;
  targetModules?: number;
  targetLessonsPerModule?: number;
}

export type GenerationInput = TopicGenerationInput | PDFGenerationInput;

export interface ModuleWithContent {
  title: string;
  description: string;
  lessons: LessonWithContent[];
}

export interface LessonWithContent {
  title: string;
  type: LessonType;
  objective: string;
  content: unknown;
}

export interface GenerationResult {
  success: boolean;
  capsule?: {
    title: string;
    description: string;
    modules: ModuleWithContent[];
  };
  progress: GenerationProgress;
  error?: string;
}

// =============================================================================
// Internal Types
// =============================================================================

interface LessonPlanItem {
  title: string;
  type: LessonType;
  objective: string;
}

interface ModuleWithPlan {
  title: string;
  description: string;
  lessonCount: number;
  lessons: LessonPlanItem[];
}

// =============================================================================
// Orchestrator Class
// =============================================================================

export class CapsuleOrchestrator {
  private client: AIClient;
  private config: GenerationConfig;
  private stateMachine: GenerationStateMachine;
  private aborted = false;
  private generationId: string;
  private capsuleId: string;
  
  constructor(config: GenerationConfig, generationId?: string, capsuleId?: string) {
    this.config = {
      maxRetries: 2,
      debug: false,
      ...config,
    };
    
    this.client = createAIClient(config.aiConfig);
    this.stateMachine = new GenerationStateMachine();
    this.generationId = generationId || `gen_${Date.now()}`;
    this.capsuleId = capsuleId || `capsule_${Date.now()}`;
  }
  
  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  
  async generate(input: GenerationInput): Promise<GenerationResult> {
    this.aborted = false;
    
    try {
      // Stage 1: Generate Outline
      this.log("Starting Stage 1: Outline Generation");
      this.updateProgress("Generating course outline...");
      this.stateMachine.transition("generating_outline");
      
      const outline = await this.generateOutlineWithRetry(input);
      
      if (this.aborted) return this.abortedResult();
      
      this.stateMachine.setOutlineComplete(
        outline.modules.length,
        outline.modules.reduce((sum, m) => sum + m.lessonCount, 0)
      );
      this.stateMachine.transition("outline_complete");
      
      // Stage 2: Generate Lesson Plans
      this.log("Starting Stage 2: Lesson Plan Generation");
      this.stateMachine.transition("generating_lesson_plans");
      
      const modulesWithPlans = await this.generateAllLessonPlans(input, outline);
      
      if (this.aborted) return this.abortedResult();
      
      this.stateMachine.transition("lesson_plans_complete");
      
      // Stage 3: Generate Content
      this.log("Starting Stage 3: Content Generation");
      this.stateMachine.transition("generating_content");
      
      const modulesWithContent = await this.generateAllContent(input, outline, modulesWithPlans);
      
      if (this.aborted) return this.abortedResult();
      
      this.stateMachine.transition("content_complete");
      this.stateMachine.transition("completed");
      
      this.updateProgress("Generation complete!");
      
      return {
        success: true,
        capsule: {
          title: outline.title,
          description: outline.description,
          modules: modulesWithContent,
        },
        progress: this.stateMachine.getProgress(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.log(`Generation failed: ${message}`);
      
      if (this.stateMachine.getState() !== "failed") {
        this.stateMachine.setError(message);
      }
      
      return {
        success: false,
        progress: this.stateMachine.getProgress(),
        error: message,
      };
    }
  }
  
  abort(): void {
    this.aborted = true;
  }
  
  getProgress(): GenerationProgress {
    return this.stateMachine.getProgress();
  }
  
  // ---------------------------------------------------------------------------
  // Stage Context Factory
  // ---------------------------------------------------------------------------
  
  private createContext(attempt: number): StageContext {
    return {
      generationId: this.generationId,
      capsuleId: this.capsuleId,
      attempt,
      maxAttempts: this.config.maxRetries! + 1,
    };
  }
  
  // ---------------------------------------------------------------------------
  // Stage 1: Outline Generation
  // ---------------------------------------------------------------------------
  
  private async generateOutlineWithRetry(input: GenerationInput): Promise<OutlineOutput> {
    const outlineInput: OutlineInput = {
      sourceType: input.type,
      topic: input.type === "topic" ? input.topic : undefined,
      pdfBase64: input.type === "pdf" ? input.pdfBase64 : undefined,
      pdfMimeType: input.type === "pdf" ? input.pdfMimeType : undefined,
      difficulty: input.difficulty,
      guidance: input.guidance,
      targetModuleCount: input.targetModules,
    };
    
    for (let attempt = 0; attempt <= this.config.maxRetries!; attempt++) {
      if (this.aborted) throw new Error("Aborted");
      
      const context = this.createContext(attempt);
      const result = await generateOutline(this.client, outlineInput, context);
      
      this.stateMachine.addTokensUsed(result.tokensUsed);
      
      if (result.success) {
        return result.data;
      }
      
      this.log(`Outline attempt ${attempt + 1} failed: ${result.error}`);
      
      if (!result.retriable || attempt === this.config.maxRetries!) {
        throw new CapsuleError(
          (result.errorCode as ErrorCode) || ErrorCode.MAX_RETRIES_EXCEEDED,
          `Outline generation failed: ${result.error}`
        );
      }
      
      // Wait before retry
      await this.delay(1000 * (attempt + 1));
    }
    
    throw new CapsuleError(ErrorCode.MAX_RETRIES_EXCEEDED, "Outline generation exhausted retries");
  }
  
  // ---------------------------------------------------------------------------
  // Stage 2: Lesson Plans
  // ---------------------------------------------------------------------------
  
  private async generateAllLessonPlans(
    input: GenerationInput,
    outline: OutlineOutput
  ): Promise<ModuleWithPlan[]> {
    const modulesWithPlans: ModuleWithPlan[] = [];
    
    for (let i = 0; i < outline.modules.length; i++) {
      if (this.aborted) throw new Error("Aborted");
      
      const outlineModule = outline.modules[i];
      this.updateProgress(`Generating lesson plan for module ${i + 1}/${outline.modules.length}: ${outlineModule.title}`);
      
      const plan = await this.generateLessonPlanWithRetry(input, outline, outlineModule, i);
      
      modulesWithPlans.push({
        ...outlineModule,
        lessons: plan.lessons,
      });
      
      this.stateMachine.incrementLessonPlansGenerated();
    }
    
    return modulesWithPlans;
  }
  
  private async generateLessonPlanWithRetry(
    input: GenerationInput,
    outline: OutlineOutput,
    outlineModule: { title: string; description: string; lessonCount: number },
    moduleIndex: number
  ): Promise<{ lessons: LessonPlanItem[] }> {
    const planInput: LessonPlanInput = {
      capsuleTitle: outline.title,
      capsuleDescription: outline.description,
      moduleTitle: outlineModule.title,
      moduleDescription: outlineModule.description,
      moduleIndex,
      lessonCount: outlineModule.lessonCount,
      sourceType: input.type,
      topic: input.type === "topic" ? input.topic : undefined,
      pdfBase64: input.type === "pdf" ? input.pdfBase64 : undefined,
      pdfMimeType: input.type === "pdf" ? input.pdfMimeType : undefined,
      difficulty: input.difficulty,
      guidance: input.guidance,
    };
    
    for (let attempt = 0; attempt <= this.config.maxRetries!; attempt++) {
      if (this.aborted) throw new Error("Aborted");
      
      const context = this.createContext(attempt);
      const result = await generateLessonPlan(this.client, planInput, context);
      
      this.stateMachine.addTokensUsed(result.tokensUsed);
      
      if (result.success) {
        // Map lessonType to type for internal use
        return { 
          lessons: result.data.lessons.map(l => ({
            title: l.title,
            type: l.lessonType,
            objective: l.objective,
          }))
        };
      }
      
      this.log(`Lesson plan attempt ${attempt + 1} for module ${moduleIndex + 1} failed: ${result.error}`);
      
      if (!result.retriable || attempt === this.config.maxRetries!) {
        throw new CapsuleError(
          (result.errorCode as ErrorCode) || ErrorCode.MAX_RETRIES_EXCEEDED,
          `Lesson plan generation failed for module ${moduleIndex + 1}: ${result.error}`
        );
      }
      
      await this.delay(1000 * (attempt + 1));
    }
    
    throw new CapsuleError(ErrorCode.MAX_RETRIES_EXCEEDED, "Lesson plan generation exhausted retries");
  }
  
  // ---------------------------------------------------------------------------
  // Stage 3: Content Generation
  // ---------------------------------------------------------------------------
  
  private async generateAllContent(
    input: GenerationInput,
    outline: OutlineOutput,
    modulesWithPlans: ModuleWithPlan[]
  ): Promise<ModuleWithContent[]> {
    const modulesWithContent: ModuleWithContent[] = [];
    
    for (let moduleIndex = 0; moduleIndex < modulesWithPlans.length; moduleIndex++) {
      if (this.aborted) throw new Error("Aborted");
      
      const currentModule = modulesWithPlans[moduleIndex];
      const lessonsWithContent: LessonWithContent[] = [];
      
      const previousLessons: Array<{ title: string; type: LessonType }> = [];
      
      for (let lessonIndex = 0; lessonIndex < currentModule.lessons.length; lessonIndex++) {
        if (this.aborted) throw new Error("Aborted");
        
        const lesson = currentModule.lessons[lessonIndex];
        const totalProgress = this.stateMachine.getProgress();
        const lessonNumber = totalProgress.lessonsGenerated + 1;
        
        this.updateProgress(
          `Generating content ${lessonNumber}/${totalProgress.totalLessons}: ${lesson.title}`
        );
        
        const content = await this.generateLessonContentWithRetry(
          input,
          outline,
          currentModule,
          lesson,
          moduleIndex,
          lessonIndex,
          previousLessons
        );
        
        lessonsWithContent.push({
          title: lesson.title,
          type: lesson.type,
          objective: lesson.objective,
          content,
        });
        
        previousLessons.push({ title: lesson.title, type: lesson.type });
        this.stateMachine.incrementLessonsGenerated(moduleIndex, lessonIndex);
      }
      
      modulesWithContent.push({
        title: currentModule.title,
        description: currentModule.description,
        lessons: lessonsWithContent,
      });
    }
    
    return modulesWithContent;
  }
  
  private async generateLessonContentWithRetry(
    input: GenerationInput,
    outline: OutlineOutput,
    currentModule: ModuleWithPlan,
    lesson: LessonPlanItem,
    moduleIndex: number,
    lessonIndex: number,
    previousLessons: Array<{ title: string; type: LessonType }>
  ): Promise<unknown> {
    const contentInput: LessonContentInput = {
      capsuleTitle: outline.title,
      moduleTitle: currentModule.title,
      lessonTitle: lesson.title,
      lessonObjective: lesson.objective,
      lessonType: lesson.type,
      moduleIndex,
      lessonIndex,
      sourceType: input.type,
      topic: input.type === "topic" ? input.topic : undefined,
      pdfBase64: input.type === "pdf" ? input.pdfBase64 : undefined,
      pdfMimeType: input.type === "pdf" ? input.pdfMimeType : undefined,
      difficulty: input.difficulty,
      guidance: input.guidance,
      previousLessons,
    };
    
    for (let attempt = 0; attempt <= this.config.maxRetries!; attempt++) {
      if (this.aborted) throw new Error("Aborted");
      
      const context = this.createContext(attempt);
      const result = await generateLessonContent(this.client, contentInput, context);
      
      this.stateMachine.addTokensUsed(result.tokensUsed);
      
      if (result.success) {
        return result.data.content;
      }
      
      this.log(
        `Content attempt ${attempt + 1} for lesson ${lessonIndex + 1} ` +
        `in module ${moduleIndex + 1} failed: ${result.error}`
      );
      
      if (!result.retriable || attempt === this.config.maxRetries!) {
        // For content, we could potentially return a placeholder or skip
        // For now, we throw to fail the whole generation
        throw new CapsuleError(
          (result.errorCode as ErrorCode) || ErrorCode.MAX_RETRIES_EXCEEDED,
          `Content generation failed for lesson "${lesson.title}": ${result.error}`
        );
      }
      
      await this.delay(1000 * (attempt + 1));
    }
    
    throw new CapsuleError(ErrorCode.MAX_RETRIES_EXCEEDED, "Content generation exhausted retries");
  }
  
  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  
  private updateProgress(message: string): void {
    const progress = this.stateMachine.getProgress();
    const percentage = getProgressPercentage(progress);
    
    this.log(`[${percentage}%] ${message}`);
    
    if (this.config.onProgress) {
      this.config.onProgress(progress, message);
    }
  }
  
  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[Orchestrator] ${message}`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private abortedResult(): GenerationResult {
    return {
      success: false,
      progress: this.stateMachine.getProgress(),
      error: "Generation was aborted",
    };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createCapsuleOrchestrator(
  config: GenerationConfig,
  generationId?: string,
  capsuleId?: string
): CapsuleOrchestrator {
  return new CapsuleOrchestrator(config, generationId, capsuleId);
}
