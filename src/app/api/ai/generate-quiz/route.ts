import { NextRequest, NextResponse } from "next/server";
import { createConvexClient } from "@/lib/convexClient";
import { generateQuiz } from "@/lib/services/aimodel";
import { validateAndCorrectJson } from "@/lib/utils";
import {
  generatedQuizSchema,
  generatedQuizSchemaDescription,
} from "@/lib/validators/generatedContentSchemas";
import { resolveWithConvexClient, MissingAIModelMappingError } from "@shared/ai/modelResolver";

const convex = createConvexClient();

export async function POST(request: NextRequest) {
  try {
    const { notes, title } = await request.json();

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
    console.error("[GENERATE_QUIZ_ERROR]", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: `Failed to generate quiz: ${errorMessage}` },
      { status: 500 }
    );
  }
}
