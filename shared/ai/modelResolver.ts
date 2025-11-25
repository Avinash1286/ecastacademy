import { api } from "convex/_generated/api";
import type { FunctionReference } from "convex/server";
import { AIModelConfig } from "@shared/ai/centralized";

export class MissingAIModelMappingError extends Error {
  constructor(featureKey: string, reason?: string) {
    super(
      `AI configuration for feature '${featureKey}' is unavailable${reason ? `: ${reason}` : ""}`
    );
    this.name = "MissingAIModelMappingError";
  }
}

type FeatureModelRecord = {
  provider: AIModelConfig["provider"];
  modelId: string;
  isEnabled?: boolean;
};

export type FeatureModelFetcher = (
  featureKey: string
) => Promise<FeatureModelRecord | null>;

export const resolveModelConfig = async (
  featureKey: string,
  fetcher: FeatureModelFetcher
): Promise<AIModelConfig> => {
  const model = await fetcher(featureKey);

  if (!model) {
    throw new MissingAIModelMappingError(featureKey, "feature not found");
  }

  if (model.isEnabled === false) {
    throw new MissingAIModelMappingError(featureKey, "model is disabled");
  }

  return {
    provider: model.provider,
    modelId: model.modelId,
  };
};

type QueryFn = (
  name: FunctionReference<"query">,
  args: Record<string, unknown>
) => Promise<unknown>;

export const resolveWithConvexClient = async (
  convexClient: { query: QueryFn },
  featureKey: string
): Promise<AIModelConfig> => {
  return resolveModelConfig(featureKey, (key) =>
    convexClient.query(api.aiConfig.getFeatureModel, {
      featureKey: key,
    }) as Promise<FeatureModelRecord | null>
  );
};

export const resolveWithConvexCtx = async (
  ctx: { runQuery: QueryFn },
  featureKey: string
): Promise<AIModelConfig> => {
  return resolveModelConfig(featureKey, (key) =>
    ctx.runQuery(api.aiConfig.getFeatureModel, {
      featureKey: key,
    }) as Promise<FeatureModelRecord | null>
  );
};
