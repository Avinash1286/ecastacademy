import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { requireAuthenticatedUser } from "./utils/auth";

export const send = mutation({
    args: {
        sessionId: v.id("chatSessions"),
        userId: v.id("users"),
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
    },
    handler: async (ctx, args) => {
        // SECURITY: Verify the authenticated user matches the userId parameter
        const { user } = await requireAuthenticatedUser(ctx);
        if (user._id !== args.userId) {
            throw new Error("Unauthorized: You can only send messages as yourself");
        }

        // SECURITY: Verify the session belongs to this user
        const session = await ctx.db.get(args.sessionId);
        if (!session || session.userId !== args.userId) {
            throw new Error("Unauthorized: Session does not belong to you");
        }

        const messageId = await ctx.db.insert("messages", {
            sessionId: args.sessionId,
            userId: args.userId,
            role: args.role,
            content: args.content,
            createdAt: Date.now(),
        });

        // Update the session's lastMessageAt
        await ctx.db.patch(args.sessionId, {
            lastMessageAt: Date.now(),
        });

        return messageId;
    },
});

export const list = query({
    args: {
        sessionId: v.id("chatSessions"),
        paginationOpts: paginationOptsValidator,
    },
    handler: async (ctx, args) => {
        const messages = await ctx.db
            .query("messages")
            .withIndex("by_sessionId_createdAt", (q) =>
                q.eq("sessionId", args.sessionId)
            )
            .order("desc") // Newest first for chat interface usually, or we can reverse on client
            .paginate(args.paginationOpts);

        return messages;
    },
});

export const saveAIResponse = mutation({
    args: {
        userId: v.id("users"),
        chatId: v.string(),
        content: v.string(),
    },
    handler: async (ctx, args) => {
        // SECURITY: Verify the authenticated user matches the userId parameter
        const { user } = await requireAuthenticatedUser(ctx);
        if (user._id !== args.userId) {
            throw new Error("Unauthorized: You can only save AI responses for your own chats");
        }

        // Find the session
        const session = await ctx.db
            .query("chatSessions")
            .withIndex("by_userId_chatId", (q) =>
                q.eq("userId", args.userId).eq("chatId", args.chatId)
            )
            .first();

        if (!session) {
            throw new Error("Session not found");
        }

        // Insert the message
        await ctx.db.insert("messages", {
            sessionId: session._id,
            userId: args.userId, // Technically the AI is speaking, but we associate it with the user's session. 
            // Ideally we should have a 'role' field which we do.
            role: "assistant",
            content: args.content,
            createdAt: Date.now(),
        });

        // Update last message time
        await ctx.db.patch(session._id, {
            lastMessageAt: Date.now(),
        });
    },
});
