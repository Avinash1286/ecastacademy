import { generateText } from "ai";
import { getAIClient } from "@shared/ai/core";
import { MissingAIModelMappingError, resolveWithConvexCtx } from "@shared/ai/modelResolver";
import { TUTOR_CHAT_PROMPT, TUTOR_CHAT_QUIZ_EXTENSION } from "@shared/ai/prompts";
import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { Id, DataModel } from "./_generated/dataModel";
import { GenericActionCtx } from "convex/server";

// Maximum allowed message length (must match frontend)
const MAX_MESSAGE_LENGTH = 1000;

// Helper to load transcript on demand from chapter or content item
async function loadTranscript(
    ctx: GenericActionCtx<DataModel>,
    chapterId?: string,
    contentItemId?: string
): Promise<string | null> {
    try {
        // Priority 1: Content Item Transcript
        if (contentItemId) {
            const contentItem = await ctx.runQuery(api.contentItems.getContentItemWithDetails, {
                id: contentItemId as Id<"contentItems">,
            });
            
            // Check if it's a video type with video details
            if (contentItem && 'videoDetails' in contentItem && contentItem.videoDetails?.transcript) {
                return contentItem.videoDetails.transcript;
            }
        }

        // Priority 2: Chapter Video Transcript (Fallback)
        if (chapterId) {
            const chapter = await ctx.runQuery(api.chapters.getChapterWithDetails, {
                id: chapterId as Id<"chapters">,
            });
            
            return chapter?.video?.transcript ?? null;
        }

        return null;
    } catch (error) {
        console.error("[AI_TUTOR] Transcript fetch failed", { chapterId, contentItemId, error });
        return null;
    }
}

export const generateTutorResponse = action({
    args: {
        userId: v.id("users"),
        chatId: v.string(),
        messages: v.array(
            v.object({
                role: v.union(v.literal("user"), v.literal("assistant")),
                content: v.string(),
            })
        ),
        // New args for on-demand transcript loading
        chapterId: v.optional(v.string()),
        contentItemId: v.optional(v.string()),
        courseTitle: v.optional(v.string()),
        chapterTitle: v.optional(v.string()),
        videoTitle: v.optional(v.string()),
        // Deprecated: kept for backward compatibility but no longer used
        context: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { userId, chatId, messages, chapterId, contentItemId, courseTitle, chapterTitle, videoTitle } = args;

        // 1. Verify user exists (userId is passed from client)
        const user = await ctx.runQuery(api.auth.getUserById, { id: userId });
        if (!user) {
            throw new Error("User not found");
        }

        // 2. Validate message length (server-side security check)
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.role !== "user") {
            throw new Error("Last message must be from user");
        }
        
        if (lastMessage.content.length > MAX_MESSAGE_LENGTH) {
            throw new Error(`Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`);
        }

        // 3. Load transcript on demand
        const transcript = await loadTranscript(ctx, chapterId, contentItemId);
        if (!transcript || !transcript.trim()) {
            throw new Error("Transcript not available for this content. Cannot answer questions.");
        }

        // 4. Prepare the system prompt with full tutor capabilities including quiz mode
        const contextInfo = [
            courseTitle ? `Course: ${courseTitle}` : null,
            chapterTitle ? `Chapter: ${chapterTitle}` : null,
            videoTitle ? `Video: ${videoTitle}` : null,
        ].filter(Boolean).join('\n');

        const systemPrompt = `${TUTOR_CHAT_PROMPT}

${TUTOR_CHAT_QUIZ_EXTENSION}

${contextInfo ? contextInfo + '\n\n' : ''}Transcript:
${transcript}
`;

        try {
            const modelConfig = await resolveWithConvexCtx(ctx, "tutor_chat");
            
            // Build conversation history for context
            const conversationMessages = messages.slice(-8).map(msg => ({
                role: msg.role as "user" | "assistant",
                content: msg.content,
            }));

            const { text } = await generateText({
                model: getAIClient(modelConfig),
                system: systemPrompt,
                messages: conversationMessages,
            });
            const aiText = text?.trim() || "I'm sorry, I couldn't generate a response.";

            // 5. Save Assistant Message
            await ctx.runMutation(api.messages.saveAIResponse, {
                userId: userId,
                chatId: chatId,
                content: aiText,
            });

            return aiText;

        } catch (error: unknown) {
            console.error("AI Generation Error:", error);
            if (error instanceof MissingAIModelMappingError) {
                throw new Error(error.message);
            }
            const message = error instanceof Error ? error.message : "Unknown error";
            throw new Error("Failed to generate response: " + message);
        }
    },
});
