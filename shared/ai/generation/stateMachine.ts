/**
 * Generation State Machine
 * 
 * Manages the state transitions for capsule generation.
 * Allows resumption of failed generations from last known good state.
 */

// =============================================================================
// State Definitions
// =============================================================================

export type GenerationState =
  | "idle"
  | "generating_outline"
  | "outline_complete"
  | "generating_lesson_plans"
  | "lesson_plans_complete"
  | "generating_content"
  | "content_complete"
  | "completed"
  | "failed";

export interface GenerationProgress {
  state: GenerationState;
  
  // Stage progress
  outlineGenerated: boolean;
  lessonPlansGenerated: number; // Number of modules with plans
  lessonsGenerated: number; // Total lessons generated
  totalModules: number;
  totalLessons: number;
  
  // Current position (for resumption)
  currentModuleIndex: number;
  currentLessonIndex: number;
  
  // Timing
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  
  // Error tracking
  lastError?: string;
  lastErrorCode?: string;
  retryCount: number;
  
  // Token usage
  totalTokensUsed: number;
}

// =============================================================================
// Valid Transitions
// =============================================================================

const VALID_TRANSITIONS: Record<GenerationState, GenerationState[]> = {
  idle: ["generating_outline", "failed"],
  generating_outline: ["outline_complete", "failed"],
  outline_complete: ["generating_lesson_plans", "failed"],
  generating_lesson_plans: ["lesson_plans_complete", "failed"],
  lesson_plans_complete: ["generating_content", "failed"],
  generating_content: ["content_complete", "failed"],
  content_complete: ["completed", "failed"],
  completed: [],
  failed: ["generating_outline", "generating_lesson_plans", "generating_content"], // Allow retry from any stage
};

// =============================================================================
// State Machine Class
// =============================================================================

export class GenerationStateMachine {
  private progress: GenerationProgress;
  
  constructor(initialProgress?: Partial<GenerationProgress>) {
    this.progress = {
      state: "idle",
      outlineGenerated: false,
      lessonPlansGenerated: 0,
      lessonsGenerated: 0,
      totalModules: 0,
      totalLessons: 0,
      currentModuleIndex: 0,
      currentLessonIndex: 0,
      startedAt: Date.now(),
      updatedAt: Date.now(),
      retryCount: 0,
      totalTokensUsed: 0,
      ...initialProgress,
    };
  }
  
  // ---------------------------------------------------------------------------
  // State Accessors
  // ---------------------------------------------------------------------------
  
  getState(): GenerationState {
    return this.progress.state;
  }
  
  getProgress(): Readonly<GenerationProgress> {
    return { ...this.progress };
  }
  
  isComplete(): boolean {
    return this.progress.state === "completed";
  }
  
  isFailed(): boolean {
    return this.progress.state === "failed";
  }
  
  canRetry(): boolean {
    return this.progress.state === "failed" && this.progress.retryCount < 3;
  }
  
  // ---------------------------------------------------------------------------
  // State Transitions
  // ---------------------------------------------------------------------------
  
  transition(newState: GenerationState): void {
    const currentState = this.progress.state;
    const validNextStates = VALID_TRANSITIONS[currentState];
    
    if (!validNextStates.includes(newState)) {
      throw new Error(
        `Invalid state transition: ${currentState} -> ${newState}. ` +
        `Valid transitions: ${validNextStates.join(", ")}`
      );
    }
    
    this.progress.state = newState;
    this.progress.updatedAt = Date.now();
    
    if (newState === "completed") {
      this.progress.completedAt = Date.now();
    }
  }
  
  // ---------------------------------------------------------------------------
  // Progress Updates
  // ---------------------------------------------------------------------------
  
  setOutlineComplete(totalModules: number, totalLessons: number): void {
    this.progress.outlineGenerated = true;
    this.progress.totalModules = totalModules;
    this.progress.totalLessons = totalLessons;
    this.progress.updatedAt = Date.now();
  }
  
  incrementLessonPlansGenerated(): void {
    this.progress.lessonPlansGenerated++;
    this.progress.currentModuleIndex = this.progress.lessonPlansGenerated;
    this.progress.updatedAt = Date.now();
  }
  
  incrementLessonsGenerated(moduleIndex: number, lessonIndex: number): void {
    this.progress.lessonsGenerated++;
    this.progress.currentModuleIndex = moduleIndex;
    this.progress.currentLessonIndex = lessonIndex;
    this.progress.updatedAt = Date.now();
  }
  
  addTokensUsed(tokens: number): void {
    this.progress.totalTokensUsed += tokens;
    this.progress.updatedAt = Date.now();
  }
  
  // ---------------------------------------------------------------------------
  // Error Handling
  // ---------------------------------------------------------------------------
  
  setError(error: string, errorCode?: string): void {
    this.progress.lastError = error;
    this.progress.lastErrorCode = errorCode;
    this.progress.updatedAt = Date.now();
    this.transition("failed");
  }
  
  incrementRetry(): void {
    this.progress.retryCount++;
    this.progress.updatedAt = Date.now();
  }
  
  clearError(): void {
    this.progress.lastError = undefined;
    this.progress.lastErrorCode = undefined;
    this.progress.updatedAt = Date.now();
  }
  
  // ---------------------------------------------------------------------------
  // Resumption Support
  // ---------------------------------------------------------------------------
  
  getResumeState(): GenerationState {
    // Determine where to resume from based on progress
    if (!this.progress.outlineGenerated) {
      return "generating_outline";
    }
    if (this.progress.lessonPlansGenerated < this.progress.totalModules) {
      return "generating_lesson_plans";
    }
    if (this.progress.lessonsGenerated < this.progress.totalLessons) {
      return "generating_content";
    }
    return "completed";
  }
  
  resume(): void {
    if (!this.isFailed()) {
      throw new Error("Can only resume from failed state");
    }
    
    this.incrementRetry();
    this.clearError();
    
    const resumeState = this.getResumeState();
    this.progress.state = resumeState; // Direct assignment for resume
    this.progress.updatedAt = Date.now();
  }
  
  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------
  
  toJSON(): GenerationProgress {
    return { ...this.progress };
  }
  
  static fromJSON(json: GenerationProgress): GenerationStateMachine {
    return new GenerationStateMachine(json);
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

export function createGenerationProgress(): GenerationProgress {
  return new GenerationStateMachine().toJSON();
}

export function getProgressPercentage(progress: GenerationProgress): number {
  // Weight: Outline 10%, Lesson Plans 20%, Content 70%
  let percentage = 0;
  
  if (progress.outlineGenerated) {
    percentage += 10;
  }
  
  if (progress.totalModules > 0) {
    percentage += (progress.lessonPlansGenerated / progress.totalModules) * 20;
  }
  
  if (progress.totalLessons > 0) {
    percentage += (progress.lessonsGenerated / progress.totalLessons) * 70;
  }
  
  return Math.round(percentage);
}

export function getEstimatedTimeRemaining(progress: GenerationProgress): number | null {
  if (progress.lessonsGenerated === 0) {
    return null; // Not enough data
  }
  
  const elapsed = progress.updatedAt - progress.startedAt;
  const itemsCompleted = progress.lessonsGenerated;
  const itemsRemaining = progress.totalLessons - progress.lessonsGenerated;
  
  if (itemsCompleted === 0) return null;
  
  const msPerItem = elapsed / itemsCompleted;
  return Math.round(msPerItem * itemsRemaining);
}
