import { generateText } from "ai";
import { getAIClient } from "@shared/ai/core";
import { MissingAIModelMappingError, resolveWithConvexCtx } from "@shared/ai/modelResolver";
import { TUTOR_CHAT_PROMPT, TUTOR_CHAT_QUIZ_EXTENSION } from "@shared/ai/prompts";
import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// Maximum allowed message length (must match frontend)
const MAX_MESSAGE_LENGTH = 1000;

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
        context: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { userId, chatId, messages, context } = args;

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

        // 3. Prepare the system prompt with full tutor capabilities including quiz mode
        const systemPrompt = `${TUTOR_CHAT_PROMPT}

${TUTOR_CHAT_QUIZ_EXTENSION}

Context/Transcript:
${context || "No specific context provided."}
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

            // 4. Save Assistant Message
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
