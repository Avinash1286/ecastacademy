/**
 * Metrics Comparison Tool
 * Compare unified pipeline vs LangChain pipeline performance
 * 
 * Usage: node scripts/compareMetrics.ts
 */

interface GenerationMetrics {
  tokensUsed: number;
  duration: number;
  apiCalls: number;
  method: "unified" | "langchain";
  timestamp: string;
}

interface AggregatedMetrics {
  count: number;
  avgTokens: number;
  avgDuration: number;
  avgApiCalls: number;
  totalCost: number;
}

/**
 * Parse metrics from application logs
 * In production, this would read from your logging service
 */
function parseMetricsFromLogs(logData: string): GenerationMetrics[] {
  const metrics: GenerationMetrics[] = [];
  const lines = logData.split('\n');
  
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.event === 'capsule_generation_metrics') {
        metrics.push({
          tokensUsed: parsed.tokensUsed,
          duration: parsed.duration,
          apiCalls: parsed.apiCalls,
          method: parsed.method,
          timestamp: parsed.timestamp,
        });
      }
    } catch {
      // Skip invalid lines
      continue;
    }
  }
  
  return metrics;
}

/**
 * Calculate cost based on token usage (Gemini 1.5 Pro pricing)
 */
function calculateCost(tokensUsed: number): number {
  const inputCost = 0.00125; // per 1K tokens
  const outputCost = 0.005; // per 1K tokens
  
  // Estimate 80% input, 20% output
  const inputTokens = tokensUsed * 0.8;
  const outputTokens = tokensUsed * 0.2;
  
  return (inputTokens / 1000) * inputCost + (outputTokens / 1000) * outputCost;
}

/**
 * Aggregate metrics by method
 */
function aggregateMetrics(metrics: GenerationMetrics[]): Map<string, AggregatedMetrics> {
  const byMethod = new Map<string, GenerationMetrics[]>();
  
  for (const metric of metrics) {
    const existing = byMethod.get(metric.method) ?? [];
    existing.push(metric);
    byMethod.set(metric.method, existing);
  }
  
  const aggregated = new Map<string, AggregatedMetrics>();
  
  for (const [method, methodMetrics] of byMethod.entries()) {
    const count = methodMetrics.length;
    const avgTokens = methodMetrics.reduce((sum, m) => sum + m.tokensUsed, 0) / count;
    const avgDuration = methodMetrics.reduce((sum, m) => sum + m.duration, 0) / count;
    const avgApiCalls = methodMetrics.reduce((sum, m) => sum + m.apiCalls, 0) / count;
    
    const totalCost = methodMetrics.reduce((sum, m) => sum + calculateCost(m.tokensUsed), 0);
    
    aggregated.set(method, {
      count,
      avgTokens,
      avgDuration,
      avgApiCalls,
      totalCost,
    });
  }
  
  return aggregated;
}

/**
 * Print comparison table
 */
function printComparison(aggregated: Map<string, AggregatedMetrics>): void {
  const unified = aggregated.get("unified");
  const langchain = aggregated.get("langchain");
  
  if (!unified || !langchain) {
    console.log("Insufficient data for comparison");
    console.log("Unified:", unified ? `${unified.count} samples` : "no data");
    console.log("LangChain:", langchain ? `${langchain.count} samples` : "no data");
    return;
  }
  
  console.log("\n=== Pipeline Comparison ===\n");
  
  console.log("Sample Size:");
  console.log(`  Unified:   ${unified.count} generations`);
  console.log(`  LangChain: ${langchain.count} generations\n`);
  
  console.log("Token Usage:");
  console.log(`  Unified:   ${Math.round(unified.avgTokens).toLocaleString()} tokens`);
  console.log(`  LangChain: ${Math.round(langchain.avgTokens).toLocaleString()} tokens`);
  console.log(`  Savings:   ${((1 - unified.avgTokens / langchain.avgTokens) * 100).toFixed(1)}%\n`);
  
  console.log("Generation Time:");
  console.log(`  Unified:   ${(unified.avgDuration / 1000).toFixed(1)}s`);
  console.log(`  LangChain: ${(langchain.avgDuration / 1000).toFixed(1)}s`);
  console.log(`  Faster:    ${((1 - unified.avgDuration / langchain.avgDuration) * 100).toFixed(1)}%\n`);
  
  console.log("API Calls:");
  console.log(`  Unified:   ${unified.avgApiCalls.toFixed(1)} calls`);
  console.log(`  LangChain: ${langchain.avgApiCalls.toFixed(1)} calls`);
  console.log(`  Reduction: ${((1 - unified.avgApiCalls / langchain.avgApiCalls) * 100).toFixed(1)}%\n`);
  
  console.log("Cost per Capsule:");
  console.log(`  Unified:   $${(unified.totalCost / unified.count).toFixed(3)}`);
  console.log(`  LangChain: $${(langchain.totalCost / langchain.count).toFixed(3)}`);
  console.log(`  Savings:   ${((1 - (unified.totalCost / unified.count) / (langchain.totalCost / langchain.count)) * 100).toFixed(1)}%\n`);
  
  console.log("Total Cost (Sample Period):");
  console.log(`  Unified:   $${unified.totalCost.toFixed(2)}`);
  console.log(`  LangChain: $${langchain.totalCost.toFixed(2)}`);
  console.log(`  Savings:   $${(langchain.totalCost - unified.totalCost).toFixed(2)}\n`);
  
  // Projections
  const projectedMonthly = 1000; // capsules per month
  const monthlyUnified = (unified.totalCost / unified.count) * projectedMonthly;
  const monthlyLangchain = (langchain.totalCost / langchain.count) * projectedMonthly;
  
  console.log("=== Projected Monthly Cost (1,000 capsules) ===");
  console.log(`  Unified:   $${monthlyUnified.toFixed(2)}/month`);
  console.log(`  LangChain: $${monthlyLangchain.toFixed(2)}/month`);
  console.log(`  Savings:   $${(monthlyLangchain - monthlyUnified).toFixed(2)}/month\n`);
}

/**
 * Main function - example usage
 */
export function analyzeMetrics(logData: string): void {
  const metrics = parseMetricsFromLogs(logData);
  
  if (metrics.length === 0) {
    console.log("No metrics found in log data");
    return;
  }
  
  const aggregated = aggregateMetrics(metrics);
  printComparison(aggregated);
}

/**
 * Example log data for testing
 */
export const EXAMPLE_LOGS = `
{"event":"capsule_generation_metrics","tokensUsed":85000,"duration":32000,"apiCalls":1,"method":"unified","timestamp":"2025-11-24T10:00:00Z"}
{"event":"capsule_generation_metrics","tokensUsed":92000,"duration":28000,"apiCalls":1,"method":"unified","timestamp":"2025-11-24T10:15:00Z"}
{"event":"capsule_generation_metrics","tokensUsed":78000,"duration":35000,"apiCalls":1,"method":"unified","timestamp":"2025-11-24T10:30:00Z"}
{"event":"capsule_generation_metrics","tokensUsed":225000,"duration":52000,"apiCalls":4,"method":"langchain","timestamp":"2025-11-24T10:05:00Z"}
{"event":"capsule_generation_metrics","tokensUsed":198000,"duration":48000,"apiCalls":3,"method":"langchain","timestamp":"2025-11-24T10:20:00Z"}
{"event":"capsule_generation_metrics","tokensUsed":240000,"duration":65000,"apiCalls":5,"method":"langchain","timestamp":"2025-11-24T10:35:00Z"}
`;

// If run directly
if (require.main === module) {
  console.log("Running with example data...\n");
  analyzeMetrics(EXAMPLE_LOGS);
}
