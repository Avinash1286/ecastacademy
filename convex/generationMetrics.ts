/**
 * Generation Metrics Convex Functions
 * 
 * Persists and queries generation metrics in the database.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// =============================================================================
// Mutations
// =============================================================================

/**
 * Record a stage metric
 */
export const recordStageMetric = mutation({
  args: {
    generationId: v.string(),
    capsuleId: v.id("capsules"),
    stage: v.string(),
    stageDurationMs: v.number(),
    stageTokensUsed: v.number(),
    stageSuccess: v.boolean(),
    stageError: v.optional(v.string()),
    provider: v.string(),
    model: v.string(),
    attempt: v.number(),
    startedAt: v.number(),
    completedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("generationMetrics", args);
  },
});

// =============================================================================
// Queries
// =============================================================================

/**
 * Get all metrics for a generation
 */
export const getMetricsByGenerationId = query({
  args: {
    generationId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("generationMetrics")
      .withIndex("by_generationId", (q) => q.eq("generationId", args.generationId))
      .collect();
  },
});

/**
 * Get all metrics for a capsule
 */
export const getMetricsByCapsuleId = query({
  args: {
    capsuleId: v.id("capsules"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("generationMetrics")
      .withIndex("by_capsuleId", (q) => q.eq("capsuleId", args.capsuleId))
      .collect();
  },
});

/**
 * Get aggregated metrics by provider
 */
export const getProviderMetrics = query({
  args: {
    provider: v.optional(v.string()),
    since: v.optional(v.number()), // Timestamp
  },
  handler: async (ctx, args) => {
    let metrics;
    
    if (args.provider) {
      metrics = await ctx.db
        .query("generationMetrics")
        .withIndex("by_provider", (q) => q.eq("provider", args.provider!))
        .collect();
    } else {
      metrics = await ctx.db.query("generationMetrics").collect();
    }
    
    // Filter by time if specified
    const filteredMetrics = args.since 
      ? metrics.filter(m => m.startedAt >= args.since!)
      : metrics;
    
    // Group by provider
    const byProvider = new Map<string, typeof filteredMetrics>();
    for (const metric of filteredMetrics) {
      const existing = byProvider.get(metric.provider) || [];
      existing.push(metric);
      byProvider.set(metric.provider, existing);
    }
    
    // Calculate aggregates
    const result: Array<{
      provider: string;
      totalRequests: number;
      successfulRequests: number;
      failedRequests: number;
      totalTokensUsed: number;
      averageDurationMs: number;
      errorRate: number;
    }> = [];
    
    for (const [provider, providerMetrics] of byProvider) {
      const successful = providerMetrics.filter(m => m.stageSuccess);
      const totalDuration = providerMetrics.reduce((sum, m) => sum + m.stageDurationMs, 0);
      const totalTokens = providerMetrics.reduce((sum, m) => sum + m.stageTokensUsed, 0);
      
      result.push({
        provider,
        totalRequests: providerMetrics.length,
        successfulRequests: successful.length,
        failedRequests: providerMetrics.length - successful.length,
        totalTokensUsed: totalTokens,
        averageDurationMs: providerMetrics.length > 0 
          ? Math.round(totalDuration / providerMetrics.length) 
          : 0,
        errorRate: providerMetrics.length > 0 
          ? (providerMetrics.length - successful.length) / providerMetrics.length 
          : 0,
      });
    }
    
    return result;
  },
});

/**
 * Get aggregated metrics by stage
 */
export const getStageMetrics = query({
  args: {
    since: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const metrics = await ctx.db.query("generationMetrics").collect();
    
    // Filter by time if specified
    const filteredMetrics = args.since 
      ? metrics.filter(m => m.startedAt >= args.since!)
      : metrics;
    
    // Group by stage
    const byStage = new Map<string, typeof filteredMetrics>();
    for (const metric of filteredMetrics) {
      const existing = byStage.get(metric.stage) || [];
      existing.push(metric);
      byStage.set(metric.stage, existing);
    }
    
    // Calculate aggregates
    const result: Array<{
      stage: string;
      averageDurationMs: number;
      averageTokensUsed: number;
      successRate: number;
      totalAttempts: number;
    }> = [];
    
    for (const [stage, stageMetrics] of byStage) {
      const successful = stageMetrics.filter(m => m.stageSuccess);
      const totalDuration = stageMetrics.reduce((sum, m) => sum + m.stageDurationMs, 0);
      const totalTokens = stageMetrics.reduce((sum, m) => sum + m.stageTokensUsed, 0);
      
      result.push({
        stage,
        averageDurationMs: stageMetrics.length > 0 
          ? Math.round(totalDuration / stageMetrics.length) 
          : 0,
        averageTokensUsed: stageMetrics.length > 0 
          ? Math.round(totalTokens / stageMetrics.length) 
          : 0,
        successRate: stageMetrics.length > 0 
          ? successful.length / stageMetrics.length 
          : 0,
        totalAttempts: stageMetrics.length,
      });
    }
    
    return result;
  },
});

/**
 * Get recent generation summary
 */
export const getRecentGenerations = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    const metrics = await ctx.db.query("generationMetrics").collect();
    
    // Group by generationId
    const byGeneration = new Map<string, typeof metrics>();
    for (const metric of metrics) {
      const existing = byGeneration.get(metric.generationId) || [];
      existing.push(metric);
      byGeneration.set(metric.generationId, existing);
    }
    
    // Build summaries
    const summaries: Array<{
      generationId: string;
      capsuleId: string;
      totalDurationMs: number;
      totalTokensUsed: number;
      stageCount: number;
      success: boolean;
      startedAt: number;
    }> = [];
    
    for (const [generationId, genMetrics] of byGeneration) {
      const sortedMetrics = genMetrics.sort((a, b) => a.startedAt - b.startedAt);
      const firstMetric = sortedMetrics[0];
      const lastMetric = sortedMetrics[sortedMetrics.length - 1];
      
      summaries.push({
        generationId,
        capsuleId: firstMetric.capsuleId,
        totalDurationMs: lastMetric.completedAt - firstMetric.startedAt,
        totalTokensUsed: genMetrics.reduce((sum, m) => sum + m.stageTokensUsed, 0),
        stageCount: new Set(genMetrics.map(m => m.stage)).size,
        success: lastMetric.stageSuccess,
        startedAt: firstMetric.startedAt,
      });
    }
    
    // Sort by most recent and limit
    return summaries
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, limit);
  },
});
