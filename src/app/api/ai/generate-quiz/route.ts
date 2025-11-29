import { NextRequest, NextResponse } from "next/server";
import { createConvexClient } from "@/lib/convexClient";
import { generateQuiz } from "@/lib/services/aimodel";
import { validateAndCorrectJson } from "@/lib/utils";
import {
  generatedQuizSchema,
  generatedQuizSchemaDescription,
} from "@/lib/validators/generatedContentSchemas";
import { resolveWithConvexClient, MissingAIModelMappingError } from "@shared/ai/modelResolver";
import { withRateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { auth } from "@/lib/auth/auth.config";
import { logger } from "@/lib/logging/logger";

const convex = createConvexClient();

export async function POST(request: NextRequest) {
  // Apply rate limiting for AI generation
  const rateLimitResponse = await withRateLimit(request, RATE_LIMIT_PRESETS.AI_GENERATION);
  if (rateLimitResponse) return rateLimitResponse;

  // Require authentication - AI generation is expensive
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
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
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: `Failed to generate quiz: ${errorMessage}` },
      { status: 500 }
    );
  }
}
