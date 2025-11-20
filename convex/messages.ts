import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";

export const send = mutation({
    args: {
        sessionId: v.id("chatSessions"),
        userId: v.id("users"),
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
    },
    handler: async (ctx, args) => {
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
