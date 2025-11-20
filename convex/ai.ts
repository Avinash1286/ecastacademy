import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const generateTutorResponse = action({
    args: {
        chatId: v.string(),
        messages: v.array(
            v.object({
                role: v.union(v.literal("user"), v.literal("assistant")),
                content: v.string(),
            })
        ),
        context: v.optional(v.string()),
        model: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { chatId, messages, context, model } = args;

        // 1. Get the user identity
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Unauthorized");
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
            // We'll use the fetch API to call the Google Gemini API directly or via Vercel AI SDK if configured on server.
            // Since we don't have the Vercel AI SDK setup for Convex Actions explicitly shown in context, 
            // and we see use of 'google' provider in env, let's try to use the standard fetch or a library if available.
            // BUT, looking at the project, it uses 'ai' sdk. 
            // We can use the `google` provider if we install it, but we might not have it in convex runtime.
            // A safer bet for Convex is to use `fetch` to an external API or the Vercel AI SDK's `streamText` if supported in this environment.

            // For now, let's assume we call the Next.js API route which handles the AI generation, 
            // OR we implement the generation here.
            // Given the instructions "Create a Convex Action... Calls the AI provider", we should do it here.

            // Let's check if we have the API key.
            const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
            if (!apiKey) {
                throw new Error("Missing API Key");
            }

            // Simple fetch to Gemini API (REST)
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        contents: [
                            {
                                role: "user",
                                parts: [{ text: systemPrompt + "\n\n" + lastMessage.content }]
                            }
                        ]
                    }),
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`AI API Error: ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();
            const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't generate a response.";

            // 4. Save Assistant Message
            // We need to call a mutation to save the message.
            // We can't call `ctx.db` directly in an action. We must use `ctx.runMutation`.

            // We need to find the session ID first. 
            // The frontend passes `chatId` which is a string (UUID), but our tables use `v.id`.
            // We need a mutation to look up the session and add the message.

            await ctx.runMutation(api.messages.saveAIResponse, {
                chatId: chatId,
                content: aiText,
            });

            return aiText;

        } catch (error: any) {
            console.error("AI Generation Error:", error);
            throw new Error("Failed to generate response: " + error.message);
        }
    },
});
