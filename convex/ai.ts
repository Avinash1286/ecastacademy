import { generateText } from "ai";
import { getAIClient } from "@shared/ai/core";
import { MissingAIModelMappingError, resolveWithConvexCtx } from "@shared/ai/modelResolver";
import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

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

        // 2. Prepare the prompt
        const systemPrompt = `You are an expert AI tutor for the eCastAcademy platform.
    Your goal is to help students understand the course material.
    
    Context:
    ${context || "No specific context provided."}
    
    Instructions:
    - Be helpful, encouraging, and concise.
    - Use markdown for formatting.
    - If the user asks about the video/content, refer to the provided context.
    `;

        const lastMessage = messages[messages.length - 1];
        if (lastMessage.role !== "user") {
            throw new Error("Last message must be from user");
        }

        // 3. Save User Message (if not already saved by frontend - but better to do it here or ensure it's done)
        // Ideally, the frontend calls a mutation to save the user message, THEN calls this action.
        // But to be safe and atomic, we could call a mutation here. 
        // However, usually frontend optimistically adds it. 
        // Let's assume frontend saves USER message, but we are responsible for ASSISTANT message.

        // Actually, for security, we should probably handle the API call to the LLM here.

        try {
            const modelConfig = await resolveWithConvexCtx(ctx, "tutor_chat");
            const { text } = await generateText({
                model: getAIClient(modelConfig),
                system: systemPrompt,
                prompt: lastMessage.content,
            });
            const aiText = text?.trim() || "I'm sorry, I couldn't generate a response.";

            // 4. Save Assistant Message
            // We need to call a mutation to save the message.
            // We can't call `ctx.db` directly in an action. We must use `ctx.runMutation`.

            // We need to find the session ID first. 
            // The frontend passes `chatId` which is a string (UUID), but our tables use `v.id`.
            // We need a mutation to look up the session and add the message.

            await ctx.runMutation(api.messages.saveAIResponse, {
                userId: userId,
                chatId: chatId,
                content: aiText,
            });

            return aiText;

        } catch (error: any) {
            console.error("AI Generation Error:", error);
            if (error instanceof MissingAIModelMappingError) {
                throw new Error(error.message);
            }
            const message = error instanceof Error ? error.message : "Unknown error";
            throw new Error("Failed to generate response: " + message);
        }
    },
});
