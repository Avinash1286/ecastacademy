import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { generateQuiz } from "@/lib/services/aimodel";
import { createConvexClient } from "@/lib/convexClient";
import { validateAndCorrectJson } from "@/lib/utils";
import {
  generatedQuizSchema,
  generatedQuizSchemaDescription,
} from "@/lib/validators/generatedContentSchemas";
import { resolveWithConvexClient, MissingAIModelMappingError } from "@shared/ai/modelResolver";

const convex = createConvexClient();

export async function POST(request: NextRequest) {
  try {
    const { contentItemId } = await request.json();

    if (!contentItemId) {
      return NextResponse.json(
        { error: "Content item ID is required" },
        { status: 400 }
      );
    }

    // Get the content item
    const contentItem = await convex.query(api.contentItems.getContentItemById, {
      id: contentItemId as Id<"contentItems">,
    });

    if (!contentItem) {
      return NextResponse.json(
        { error: "Content item not found" },
        { status: 404 }
      );
    }

    if (contentItem.type !== "text") {
      return NextResponse.json(
        { error: "Content item must be of type 'text'" },
        { status: 400 }
      );
    }

    if (!contentItem.textContent) {
      return NextResponse.json(
        { error: "Content item has no text content" },
        { status: 400 }
      );
    }

    // Update status to processing
    await convex.mutation(api.contentItems.updateTextQuizStatus, {
      contentItemId: contentItemId as Id<"contentItems">,
      status: "processing",
    });

    let quizModelConfig;
    try {
      quizModelConfig = await resolveWithConvexClient(convex, "quiz_generation");
    } catch (resolverError) {
      const status = resolverError instanceof MissingAIModelMappingError ? 503 : 500;
      await convex.mutation(api.contentItems.updateTextQuizStatus, {
        contentItemId: contentItemId as Id<"contentItems">,
        status: "failed",
        textQuizError: "Quiz generation is unavailable. Please contact an administrator.",
      });
      return NextResponse.json(
        { error: "Quiz generation is unavailable. Please contact an administrator." },
        { status }
      );
    }

    try {
      // Generate quiz from text content
      const quizJson = await generateQuiz(contentItem.textContent, quizModelConfig);
      const validatedQuiz = await validateAndCorrectJson(quizJson, {
        schema: generatedQuizSchema,
        schemaName: "InteractiveQuiz",
        schemaDescription: generatedQuizSchemaDescription,
        originalInput: contentItem.textContent,
        format: "interactive-quiz",
        modelConfig: quizModelConfig,
      });
      const quiz = JSON.parse(validatedQuiz);

      // Validate quiz structure
      if (!quiz.topic || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
        throw new Error("Invalid quiz format");
      }

      // Update with completed status and quiz data
      await convex.mutation(api.contentItems.updateTextQuizStatus, {
        contentItemId: contentItemId as Id<"contentItems">,
        status: "completed",
        textQuiz: quiz,
      });

      return NextResponse.json({
        success: true,
        quiz,
      });
    } catch (error) {
      // Parse and simplify error message
      let userFriendlyMessage = "Failed to generate quiz";
      let statusCode = 500;

      if (error instanceof Error) {
        const errorMsg = error.message;
        
        // Check for quota exceeded error
        if (errorMsg.includes("quota") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("429")) {
          userFriendlyMessage = "AI quota exceeded. Please try again in a minute.";
          statusCode = 429;
        } 
        // Check for rate limit
        else if (errorMsg.includes("rate limit") || errorMsg.includes("Too Many Requests")) {
          userFriendlyMessage = "Rate limit exceeded. Please wait before trying again.";
          statusCode = 429;
        }
        // Check for authentication errors
        else if (errorMsg.includes("API key") || errorMsg.includes("authentication")) {
          userFriendlyMessage = "AI service authentication failed. Please contact support.";
          statusCode = 500;
        }
        // Generic network/timeout errors
        else if (errorMsg.includes("timeout") || errorMsg.includes("network")) {
          userFriendlyMessage = "Request timeout. Please try again.";
          statusCode = 504;
        }
        // Use the error message if it's already user-friendly (short)
        else if (errorMsg.length < 100) {
          userFriendlyMessage = errorMsg;
        }
      }

      // Update status to failed
      await convex.mutation(api.contentItems.updateTextQuizStatus, {
        contentItemId: contentItemId as Id<"contentItems">,
        status: "failed",
        textQuizError: userFriendlyMessage,
      });

      return NextResponse.json(
        { error: userFriendlyMessage },
        { status: statusCode }
      );
    }
  } catch (error) {
    console.error("Error generating text quiz:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
