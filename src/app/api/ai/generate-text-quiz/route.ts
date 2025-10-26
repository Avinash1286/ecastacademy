import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { generateQuiz } from "@/lib/services/aimodel";
import { createConvexClient } from "@/lib/convexClient";

const convex = createConvexClient();

/**
 * Handle POST requests to generate a quiz from a text content item and update its processing status.
 *
 * Validates the request body, fetches the content item, sets its status to "processing", invokes the quiz generator,
 * and updates the content item to "completed" with the generated quiz on success or "failed" with an error message on failure.
 *
 * @returns A NextResponse JSON payload: on success `{ success: true, quiz }`, on error `{ error: string }`.
 */
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

    try {
      // Generate quiz from text content
      const quizJson = await generateQuiz(contentItem.textContent);
      const quiz = JSON.parse(quizJson);

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