import { NextRequest, NextResponse } from "next/server";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { createConvexClient } from "@/lib/convexClient";
import { generateNotes } from "@/lib/services/aimodel";
import { validateAndCorrectJson } from "@/lib/utils";
import {
	interactiveNotesSchema,
	interactiveNotesSchemaDescription,
} from "@/lib/validators/generatedContentSchemas";
import { resolveWithConvexClient, MissingAIModelMappingError } from "@shared/ai/modelResolver";
import { withRateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { auth } from "@/lib/auth/auth.config";
import { logger } from "@/lib/logging/logger";

const convex = createConvexClient();

type GenerateNotesRequest = {
	videoId?: string;
	contentItemId?: string;
};

const buildUserFriendlyError = (error: unknown): { message: string; status: number } => {
	if (error instanceof Error) {
		const text = error.message;
		if (text.includes("GEMINI_API_KEY")) {
			return {
				message: "AI service is not configured. Please add a GEMINI_API_KEY and try again.",
				status: 500,
			};
		}

		if (
			text.includes("quota") ||
			text.includes("RESOURCE_EXHAUSTED") ||
			text.includes("429")
		) {
			return {
				message: "AI quota exceeded. Please wait a moment and retry.",
				status: 429,
			};
		}

		if (text.toLowerCase().includes("transcript")) {
			return {
				message: text,
				status: 422,
			};
		}

		if (text.length < 120) {
			return { message: text, status: 500 };
		}
	}

	return {
		message: "Failed to generate notes. Please try again in a few minutes.",
		status: 500,
	};
};

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

	try {
		let payload: GenerateNotesRequest = {};
		try {
			payload = ((await request.json()) ?? {}) as GenerateNotesRequest;
		} catch {
			payload = {};
		}
		const { videoId, contentItemId } = payload;

		if (!videoId && !contentItemId) {
			return NextResponse.json(
				{ error: "Provide either a videoId or contentItemId." },
				{ status: 400 }
			);
		}

		let resolvedVideoId = videoId;
		let fallbackTitle: string | undefined;

		if (!resolvedVideoId && contentItemId) {
			const contentItem = await convex.query(api.contentItems.getContentItemById, {
				id: contentItemId as Id<"contentItems">,
			});

			if (!contentItem) {
				return NextResponse.json(
					{ error: "Content item not found" },
					{ status: 404 }
				);
			}

			if (contentItem.type !== "video" || !contentItem.videoId) {
				return NextResponse.json(
					{ error: "The specified content item is not linked to a video." },
					{ status: 400 }
				);
			}

			resolvedVideoId = contentItem.videoId;
			fallbackTitle = contentItem.title;
		}

		const video = await convex.query(api.videos.getVideoById, {
			id: resolvedVideoId as Id<"videos">,
		});

		if (!video) {
			return NextResponse.json(
				{ error: "Video not found" },
				{ status: 404 }
			);
		}

		const transcript = typeof video.transcript === "string" ? video.transcript : "";
		const videoTitle = typeof video.title === "string" ? video.title : undefined;
		if (!transcript.trim()) {
			return NextResponse.json(
				{ error: "Transcript is required before generating notes." },
				{ status: 422 }
			);
		}

		let notesModelConfig;
		try {
			notesModelConfig = await resolveWithConvexClient(convex, "notes_generation");
		} catch (error) {
			const status = error instanceof MissingAIModelMappingError ? 503 : 500;
			return NextResponse.json(
				{ error: "Notes generation is currently unavailable. Please contact an administrator." },
				{ status }
			);
		}

		try {
			const notesJson = await generateNotes(transcript, {
				videoTitle: videoTitle ?? fallbackTitle,
				modelConfig: notesModelConfig,
			});

			const validatedJson = await validateAndCorrectJson(notesJson, {
				schema: interactiveNotesSchema,
				schemaName: "InteractiveNotes",
				schemaDescription: interactiveNotesSchemaDescription,
				originalInput: transcript,
				format: "interactive-notes",
				modelConfig: notesModelConfig,
			});

			const notes = JSON.parse(validatedJson);

			await convex.mutation(api.videos.updateVideo, {
				id: video._id,
				notes,
			});

			return NextResponse.json({ success: true, videoId: video._id, notes });
		} catch (error) {
			const { message, status } = buildUserFriendlyError(error);
			logger.error("[GENERATE_NOTES] Notes generation failed", { status }, error as Error);
			return NextResponse.json({ error: message }, { status });
		}
	} catch (error) {
		logger.error("[GENERATE_NOTES] Unexpected error", undefined, error as Error);
		return NextResponse.json(
			{ error: "Failed to generate notes due to an unexpected error." },
			{ status: 500 }
		);
	}
}
