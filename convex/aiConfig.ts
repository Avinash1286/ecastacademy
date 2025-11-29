import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireAdminUser } from "./utils/auth";

// Default models to seed
const DEFAULT_MODELS = [
    {
        name: "Gemini 1.5 Pro",
        provider: "google" as const,
        modelId: "gemini-1.5-pro",
        isEnabled: true,
    },
    {
        name: "Gemini 1.5 Flash",
        provider: "google" as const,
        modelId: "gemini-1.5-flash",
        isEnabled: true,
    },
    {
        name: "GPT-4o",
        provider: "openai" as const,
        modelId: "gpt-4o",
        isEnabled: true,
    },
    {
        name: "GPT-3.5 Turbo",
        provider: "openai" as const,
        modelId: "gpt-3.5-turbo",
        isEnabled: true,
    },
];

const DEFAULT_FEATURES = [
    {
        key: "tutor_chat",
        name: "Tutor Chat",
        description: "AI Tutor for video Q&A",
        defaultModelId: "gemini-1.5-pro",
    },
    {
        key: "capsule_generation",
        name: "Capsule Generation",
        description: "Generates course capsules from PDFs/Topics",
        defaultModelId: "gemini-1.5-pro",
    },
    {
        key: "quiz_generation",
        name: "Quiz Generation",
        description: "Generates quizzes from notes",
        defaultModelId: "gemini-1.5-flash",
    },
    {
        key: "notes_generation",
        name: "Notes Generation",
        description: "Generates interactive notes from transcripts",
        defaultModelId: "gemini-1.5-pro",
    },
];

export const initializeDefaults = mutation({
    args: {},
    handler: async (ctx) => {
        // Require admin access to initialize AI configuration
        await requireAdminUser(ctx);

        // 1. Seed Models
        const modelIds: Record<string, Id<"aiModels">> = {};

        for (const model of DEFAULT_MODELS) {
            const existing = await ctx.db
                .query("aiModels")
                .filter((q) => q.eq(q.field("modelId"), model.modelId))
                .first();

            if (!existing) {
                const id = await ctx.db.insert("aiModels", model);
                modelIds[model.modelId] = id;
            } else {
                modelIds[model.modelId] = existing._id;
            }
        }

        // 2. Seed Features
        for (const feature of DEFAULT_FEATURES) {
            const existing = await ctx.db
                .query("aiFeatures")
                .withIndex("by_key", (q) => q.eq("key", feature.key))
                .first();

            if (!existing) {
                const defaultModelId = modelIds[feature.defaultModelId];
                if (defaultModelId) {
                    await ctx.db.insert("aiFeatures", {
                        key: feature.key,
                        name: feature.name,
                        description: feature.description,
                        currentModelId: defaultModelId,
                    });
                }
            }
        }
    },
});

// =============================================================================
// Query Functions
// =============================================================================

export const getFeatureModel = query({
    args: { featureKey: v.string() },
    handler: async (ctx, args) => {
        const feature = await ctx.db
            .query("aiFeatures")
            .withIndex("by_key", (q) => q.eq("key", args.featureKey))
            .first();

        if (!feature) {
            // Fallback if feature not found (shouldn't happen if initialized)
            // Return a safe default or null
            return null;
        }

        const model = await ctx.db.get(feature.currentModelId);
        return model;
    },
});

export const getAllModels = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("aiModels").collect();
    },
});

export const getAllFeatures = query({
    args: {},
    handler: async (ctx) => {
        const features = await ctx.db.query("aiFeatures").collect();
        const featuresWithModels = await Promise.all(
            features.map(async (f) => {
                const model = await ctx.db.get(f.currentModelId);
                return { ...f, model };
            })
        );
        return featuresWithModels;
    },
});

export const upsertModel = mutation({
    args: {
        id: v.optional(v.id("aiModels")),
        name: v.string(),
        provider: v.union(v.literal("google"), v.literal("openai")),
        modelId: v.string(),
        isEnabled: v.boolean(),
    },
    handler: async (ctx, args) => {
        // Require admin access to modify AI models
        await requireAdminUser(ctx);

        const { id, ...data } = args;
        if (id) {
            await ctx.db.patch(id, data);
        } else {
            await ctx.db.insert("aiModels", data);
        }
    },
});

export const updateFeatureMapping = mutation({
    args: {
        featureId: v.id("aiFeatures"),
        modelId: v.id("aiModels"),
    },
    handler: async (ctx, args) => {
        // Require admin access to update feature mappings
        await requireAdminUser(ctx);

        await ctx.db.patch(args.featureId, {
            currentModelId: args.modelId,
        });
    },
});

export const deleteModel = mutation({
    args: {
        id: v.id("aiModels"),
    },
    handler: async (ctx, args) => {
        // Require admin access to delete AI models
        await requireAdminUser(ctx);

        // Optional: Check if model is in use before deleting
        // For now, we allow deletion but features might break if they use this model
        // Ideally we should check or reassign, but for this task we just delete
        await ctx.db.delete(args.id);
    },
});
