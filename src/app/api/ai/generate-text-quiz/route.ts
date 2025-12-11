import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { createConvexClient } from "@/lib/convexClient";
import { withRateLimit, withRateLimitByUser, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { requireAdmin } from "@/lib/auth/auth.config";

export async function POST(request: NextRequest) {
  // Apply rate limiting for AI generation
  const rateLimitResponse = await withRateLimit(request, RATE_LIMIT_PRESETS.AI_GENERATION);
  if (rateLimitResponse) return rateLimitResponse;

  // Require admin authentication - text quiz generation is only for admin course building
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json(
      { error: "Admin authentication required" },
      { status: 401 }
    );
  }

  // Apply per-user rate limiting for authenticated users
  const userRateLimit = await withRateLimitByUser(
    session.user.clerkId,
    RATE_LIMIT_PRESETS.AI_GENERATION,
    "generate-text-quiz"
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
    const { contentItemId } = body;

    if (!contentItemId) {
      return NextResponse.json(
        { error: "Content item ID is required" },
        { status: 400 }
      );
    }

    // Get bearer token for authenticated Convex calls
    const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
    const convex = createConvexClient({ userToken: bearer });

    // Trigger the background job on Convex
    const result = await convex.action(api.contentItems.triggerTextQuizGeneration, {
      contentItemId: contentItemId as Id<"contentItems">,
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      contentItemId: result.contentItemId,
    });
  } catch (error) {
    console.error("Error triggering text quiz generation:", error);
    
    // Return a user-friendly error message
    const errorMessage = error instanceof Error ? error.message : "Failed to start quiz generation";
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
