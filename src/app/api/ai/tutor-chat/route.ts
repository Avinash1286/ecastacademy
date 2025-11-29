import { NextRequest, NextResponse } from "next/server";
import { streamText, type CoreMessage } from "ai";
import { cleanTranscript } from "@shared/ai/transcript";
import { TUTOR_CHAT_PROMPT, TUTOR_CHAT_QUIZ_EXTENSION } from "@shared/ai/prompts";
import { createConvexClient } from "@/lib/convexClient";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { getAIClient } from "@shared/ai/core";
import { withRateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { auth } from "@/lib/auth/auth.config";
import { logger } from "@/lib/logging/logger";

const MAX_MESSAGE_LENGTH = 60000;
const MAX_HISTORY = 100;
const MAX_TRANSCRIPT_LENGTH = 4000000;

const convex = createConvexClient();

type ContentItemWithDetails = {
  type?: string;
  videoDetails?: {
    transcript?: string | null;
  } | null;
};

const loadTranscriptFromBackend = async (chapterId?: string | null, contentItemId?: string | null) => {
  try {
    // Priority 1: Content Item Transcript
    if (contentItemId) {
      const contentItem = (await convex.query(api.contentItems.getContentItemWithDetails, {
        id: contentItemId as Id<"contentItems">,
      })) as ContentItemWithDetails | null;
      if (contentItem?.type === "video" && contentItem.videoDetails?.transcript) {
        return contentItem.videoDetails.transcript;
      }
    }

    // Priority 2: Chapter Video Transcript (Fallback)
    if (chapterId) {
      const chapter = await convex.query(api.chapters.getChapterWithDetails, {
        id: chapterId as Id<"chapters">,
      });
      return chapter?.video?.transcript ?? null;
    }

    return null;
  } catch (error) {
    logger.error("[TUTOR_CHAT] Transcript fallback fetch failed", { chapterId, contentItemId }, error as Error);
    return null;
  }
};

type IncomingMessage = {
  role?: string;
  content?: string | Array<{ type?: string; text?: string }>;
  parts?: Array<{ type?: string; text?: string }>;
};

type SanitizedMessage = {
  role: "user" | "assistant";
  content: string;
};

const toTextContent = (message: IncomingMessage): string => {
  if (typeof message.content === "string") {
    return message.content;
  }

  const parts = Array.isArray(message.content)
    ? message.content
    : Array.isArray(message.parts)
      ? message.parts
      : [];

  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n");
};

const sanitizeMessages = (messages: unknown[]): SanitizedMessage[] => {
  return messages
    .map((message) => {
      const candidate = message as IncomingMessage;
      const role = candidate.role === "assistant" ? "assistant" : candidate.role === "user" ? "user" : null;
      if (!role) {
        return null;
      }
      const content = toTextContent(candidate).slice(0, MAX_MESSAGE_LENGTH).trim();
      if (!content) {
        return null;
      }
      return { role, content };
    })
    .filter((message): message is SanitizedMessage => Boolean(message))
    .slice(-MAX_HISTORY);
};

export async function POST(request: NextRequest) {
  // Apply rate limiting for AI generation
  const rateLimitResponse = await withRateLimit(request, RATE_LIMIT_PRESETS.AI_GENERATION);
  if (rateLimitResponse) return rateLimitResponse;

  // Require authentication - AI chat is expensive
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  try {
    const {
      messages,
      transcript,
      videoTitle,
      chapterTitle,
      courseTitle,
      chapterId,
      contentItemId,
    } = payload ?? {};

    logger.debug('[TUTOR_CHAT] Request received', {
      clientProvidedTranscript: typeof transcript === 'string' && transcript.trim().length > 0,
      transcriptLength: typeof transcript === 'string' ? transcript.length : 0,
      hasMessages: Array.isArray(messages),
      messageCount: Array.isArray(messages) ? messages.length : 0,
      courseTitle,
      chapterTitle,
      videoTitle,
      chapterId,
      contentItemId,
    });

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "At least one message is required" },
        { status: 400 }
      );
    }

    let workingTranscript =
      typeof transcript === "string" && transcript.trim().length > 0 ? transcript : null;

    if (!workingTranscript) {
      workingTranscript = await loadTranscriptFromBackend(chapterId, contentItemId);
      logger.debug('[TUTOR_CHAT] Server-side transcript fetch', {
        fetchedTranscriptLength: workingTranscript?.length ?? 0,
        source: contentItemId ? 'contentItem' : 'chapter',
      });
    }

    if (!workingTranscript || !workingTranscript.trim()) {
      return NextResponse.json(
        { error: "Transcript is required for tutoring" },
        { status: 400 }
      );
    }

    const sanitizedMessages = sanitizeMessages(messages);

    if (sanitizedMessages.length === 0) {
      return NextResponse.json(
        { error: "Unable to process empty messages" },
        { status: 400 }
      );
    }

    const cleanedTranscript = cleanTranscript(workingTranscript).slice(0, MAX_TRANSCRIPT_LENGTH);
    if (!cleanedTranscript) {
      return NextResponse.json(
        { error: "Transcript is empty. Cannot answer questions yet." },
        { status: 422 }
      );
    }

    const contextBlock = [
      courseTitle ? `Course: ${courseTitle}` : null,
      chapterTitle ? `Chapter: ${chapterTitle}` : null,
      videoTitle ? `Lesson: ${videoTitle}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const systemPrompt = `${TUTOR_CHAT_PROMPT}\n\n${TUTOR_CHAT_QUIZ_EXTENSION}${contextBlock ? `\n${contextBlock}` : ""}\n\nTranscript:\n${cleanedTranscript}`;

    const conversation: CoreMessage[] = sanitizedMessages.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    // Fetch AI Configuration
    const modelConfig = await convex.query(api.aiConfig.getFeatureModel, {
      featureKey: "tutor_chat",
    });

    if (!modelConfig) {
      throw new Error("AI Configuration for 'tutor_chat' not found.");
    }

    const model = getAIClient({
      provider: modelConfig.provider,
      modelId: modelConfig.modelId,
    });

    const result = streamText({
      model,
      system: systemPrompt,
      messages: conversation,
      maxOutputTokens: 8192,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    logger.error("[TUTOR_CHAT] Chat generation failed", undefined, error as Error);
    const message =
      error instanceof Error ? error.message : "Something went wrong while contacting the tutor";
    const status = message.toLowerCase().includes("transcript") ? 422 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
