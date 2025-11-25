/**
 * Generation Metrics Types
 */

export interface StageMetric {
  generationId: string;
  capsuleId: string;
  stage: string;
  stageDurationMs: number;
  stageTokensUsed: number;
  stageSuccess: boolean;
  stageError?: string;
  provider: string;
  model: string;
  attempt: number;
  startedAt: number;
  completedAt: number;
}

export interface GenerationSummary {
  generationId: string;
  capsuleId: string;
  totalDurationMs: number;
  totalTokensUsed: number;
  success: boolean;
  stageCount: number;
  failedStages: number;
  retryCount: number;
}

export interface ProviderMetrics {
  provider: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokensUsed: number;
  averageDurationMs: number;
  errorRate: number;
}

export interface StagePerformance {
  stage: string;
  averageDurationMs: number;
  averageTokensUsed: number;
  successRate: number;
  totalAttempts: number;
}
