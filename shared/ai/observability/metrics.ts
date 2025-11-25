/**
 * Metrics Collector
 * 
 * Collects and reports metrics for capsule generation.
 * Works with both in-memory collection (for serverless) and
 * database persistence (via Convex).
 */

import type { StageMetric, GenerationSummary } from "./types";

// =============================================================================
// Metric Event Types
// =============================================================================

export type MetricEvent =
  | { type: "stage_start"; stage: string; attempt: number }
  | { type: "stage_complete"; stage: string; durationMs: number; tokensUsed: number }
  | { type: "stage_error"; stage: string; error: string; retriable: boolean }
  | { type: "generation_complete"; success: boolean }
  | { type: "retry"; stage: string; attempt: number; reason: string };

// =============================================================================
// Metrics Collector Class
// =============================================================================

export class MetricsCollector {
  private generationId: string;
  private capsuleId: string;
  private provider: string;
  private model: string;
  
  private metrics: StageMetric[] = [];
  private currentStageStart: number | null = null;
  private currentStage: string | null = null;
  private currentAttempt = 0;
  private totalTokensUsed = 0;
  private generationStartTime: number;
  
  // Optional callback for persisting metrics
  private persistCallback?: (metric: StageMetric) => Promise<void>;
  
  constructor(options: {
    generationId: string;
    capsuleId: string;
    provider: string;
    model: string;
    onPersist?: (metric: StageMetric) => Promise<void>;
  }) {
    this.generationId = options.generationId;
    this.capsuleId = options.capsuleId;
    this.provider = options.provider;
    this.model = options.model;
    this.persistCallback = options.onPersist;
    this.generationStartTime = Date.now();
  }
  
  // ---------------------------------------------------------------------------
  // Event Recording
  // ---------------------------------------------------------------------------
  
  startStage(stage: string, attempt: number = 0): void {
    this.currentStage = stage;
    this.currentAttempt = attempt;
    this.currentStageStart = Date.now();
    
    this.log(`Stage "${stage}" started (attempt ${attempt + 1})`);
  }
  
  async completeStage(tokensUsed: number): Promise<void> {
    if (!this.currentStage || !this.currentStageStart) {
      console.warn("completeStage called without active stage");
      return;
    }
    
    const now = Date.now();
    const metric: StageMetric = {
      generationId: this.generationId,
      capsuleId: this.capsuleId,
      stage: this.currentStage,
      stageDurationMs: now - this.currentStageStart,
      stageTokensUsed: tokensUsed,
      stageSuccess: true,
      provider: this.provider,
      model: this.model,
      attempt: this.currentAttempt,
      startedAt: this.currentStageStart,
      completedAt: now,
    };
    
    this.metrics.push(metric);
    this.totalTokensUsed += tokensUsed;
    
    this.log(
      `Stage "${this.currentStage}" completed in ${metric.stageDurationMs}ms, ` +
      `${tokensUsed} tokens`
    );
    
    // Persist if callback provided
    if (this.persistCallback) {
      try {
        await this.persistCallback(metric);
      } catch (error) {
        console.error("Failed to persist metric:", error);
      }
    }
    
    this.currentStage = null;
    this.currentStageStart = null;
  }
  
  async failStage(error: string, retriable: boolean): Promise<void> {
    if (!this.currentStage || !this.currentStageStart) {
      console.warn("failStage called without active stage");
      return;
    }
    
    const now = Date.now();
    const metric: StageMetric = {
      generationId: this.generationId,
      capsuleId: this.capsuleId,
      stage: this.currentStage,
      stageDurationMs: now - this.currentStageStart,
      stageTokensUsed: 0,
      stageSuccess: false,
      stageError: error,
      provider: this.provider,
      model: this.model,
      attempt: this.currentAttempt,
      startedAt: this.currentStageStart,
      completedAt: now,
    };
    
    this.metrics.push(metric);
    
    this.log(
      `Stage "${this.currentStage}" failed: ${error} ` +
      `(retriable: ${retriable})`
    );
    
    // Persist if callback provided
    if (this.persistCallback) {
      try {
        await this.persistCallback(metric);
      } catch (err) {
        console.error("Failed to persist metric:", err);
      }
    }
    
    // Don't clear current stage for retries
    if (!retriable) {
      this.currentStage = null;
      this.currentStageStart = null;
    }
  }
  
  // ---------------------------------------------------------------------------
  // Summary Generation
  // ---------------------------------------------------------------------------
  
  getSummary(): GenerationSummary {
    const failedStages = this.metrics.filter(m => !m.stageSuccess).length;
    const retryCount = Math.max(
      0,
      ...this.metrics.map(m => m.attempt)
    );
    
    return {
      generationId: this.generationId,
      capsuleId: this.capsuleId,
      totalDurationMs: Date.now() - this.generationStartTime,
      totalTokensUsed: this.totalTokensUsed,
      success: this.metrics.length > 0 && 
               this.metrics[this.metrics.length - 1]?.stageSuccess === true,
      stageCount: new Set(this.metrics.map(m => m.stage)).size,
      failedStages,
      retryCount,
    };
  }
  
  getMetrics(): readonly StageMetric[] {
    return this.metrics;
  }
  
  getTotalTokensUsed(): number {
    return this.totalTokensUsed;
  }
  
  // ---------------------------------------------------------------------------
  // Logging
  // ---------------------------------------------------------------------------
  
  private log(message: string): void {
    console.log(`[Metrics:${this.generationId.slice(0, 8)}] ${message}`);
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createMetricsCollector(options: {
  generationId: string;
  capsuleId: string;
  provider: string;
  model: string;
  onPersist?: (metric: StageMetric) => Promise<void>;
}): MetricsCollector {
  return new MetricsCollector(options);
}
