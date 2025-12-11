import { NextRequest, NextResponse } from "next/server";
import { createConvexClient } from "@/lib/convexClient";
import { generateQuiz } from "@/lib/services/aimodel";
import { validateAndCorrectJson } from "@/lib/utils";
import {
  generatedQuizSchema,
  generatedQuizSchemaDescription,
} from "@/lib/validators/generatedContentSchemas";
import { resolveWithConvexClient, MissingAIModelMappingError } from "@shared/ai/modelResolver";
import { withRateLimit, withRateLimitByUser, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { requireAdmin } from "@/lib/auth/auth.config";
import { logger } from "@/lib/logging/logger";

const convex = createConvexClient();

export async function POST(request: NextRequest) {
  // Apply rate limiting for AI generation
  const rateLimitResponse = await withRateLimit(request, RATE_LIMIT_PRESETS.AI_GENERATION);
  if (rateLimitResponse) return rateLimitResponse;

  // Require admin authentication - quiz generation is only for admin course building
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json(
      { error: "Admin authentication required" },
      { status: 401 }
    );
  }

  // MEDIUM-5 FIX: Apply per-user rate limiting for authenticated users
  const userRateLimit = await withRateLimitByUser(
    session.user.clerkId,
    RATE_LIMIT_PRESETS.AI_GENERATION,
    "generate-quiz"
  );
  if (!userRateLimit.success) {
    return NextResponse.json(
      { error: "You've reached your AI usage limit. Please wait a moment before trying again." },
      { status: 429 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  try {
    const { notes, title } = body;

    if (!notes) {
      return NextResponse.json(
        { error: "Notes are required" },
        { status: 400 }
      );
    }

    let quizModelConfig;
    try {
      quizModelConfig = await resolveWithConvexClient(convex, "quiz_generation");
    } catch (resolverError) {
      const status = resolverError instanceof MissingAIModelMappingError ? 503 : 500;
      return NextResponse.json(
        { error: "Quiz generation is currently unavailable. Please contact an administrator." },
        { status }
      );
    }

    const quizSource = title ? `Video Title: ${title}\n\n${notes}` : notes;
    const quizJson = await generateQuiz(quizSource, quizModelConfig);
    const validatedQuiz = await validateAndCorrectJson(quizJson, {
      schema: generatedQuizSchema,
      schemaName: "InteractiveQuiz",
      schemaDescription: generatedQuizSchemaDescription,
      originalInput: quizSource,
      format: "interactive-quiz",
      modelConfig: quizModelConfig,
    });

    const quiz = JSON.parse(validatedQuiz);

    return NextResponse.json(quiz);
  } catch (error) {
    logger.error("[GENERATE_QUIZ] Quiz generation failed", undefined, error as Error);
    // MEDIUM-3 FIX: Don't leak internal error details to client
    const safeErrorMessage = getSafeErrorMessage(error);
    return NextResponse.json(
      { error: safeErrorMessage },
      { status: 500 }
    );
  }
}

/**
 * MEDIUM-3 FIX: Convert internal errors to safe user-facing messages
 */
function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    // Map known error patterns to safe messages
    if (msg.includes("quota") || msg.includes("rate limit") || msg.includes("429")) {
      return "Service is temporarily busy. Please try again in a moment.";
    }
    if (msg.includes("timeout") || msg.includes("timed out")) {
      return "Request took too long. Please try again.";
    }
    if (msg.includes("invalid") && msg.includes("json")) {
      return "Failed to process AI response. Please try again.";
    }
  }
  // Generic fallback - never expose raw error messages
  return "Failed to generate quiz. Please try again later.";
}
