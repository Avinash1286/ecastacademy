import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

/**
 * Save or update chat history
 * Accepts userId directly from client (consistent with other mutations)
 */
export const saveChatHistory = mutation({
  args: {
    userId: v.id("users"),
    chatId: v.string(),
    chapterId: v.optional(v.string()),
    contentItemId: v.optional(v.string()),
    courseId: v.optional(v.string()),
    title: v.optional(v.string()),
    messages: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Verify the user exists
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    const now = Date.now();
    const existing = await ctx.db
      .query("chatSessions")
      .withIndex("by_userId_chatId", (q) => q.eq("userId", args.userId).eq("chatId", args.chatId))
      .first();

    const payload = {
      chapterId: args.chapterId,
      contentItemId: args.contentItemId,
      courseId: args.courseId,
      title: args.title,
      messages: args.messages,
      lastMessageAt: now,
    } satisfies Partial<Doc<"chatSessions">>;

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("chatSessions", {
      userId: args.userId,
      chatId: args.chatId,
      createdAt: now,
      ...payload,
    });
  },
});

/**
 * Get or create a chat session
 * Accepts userId directly from client (consistent with other mutations like messages.send)
 */
export const getOrCreateSession = mutation({
  args: {
    userId: v.id("users"),
    chatId: v.string(),
    chapterId: v.optional(v.string()),
    contentItemId: v.optional(v.string()),
    courseId: v.optional(v.string()),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify the user exists
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    const existing = await ctx.db
      .query("chatSessions")
      .withIndex("by_userId_chatId", (q) => q.eq("userId", args.userId).eq("chatId", args.chatId))
      .first();

    if (existing) {
      return existing._id;
    }

    const now = Date.now();
    return await ctx.db.insert("chatSessions", {
      userId: args.userId,
      chatId: args.chatId,
      chapterId: args.chapterId,
      contentItemId: args.contentItemId,
      courseId: args.courseId,
      title: args.title,
      createdAt: now,
      lastMessageAt: now,
    });
  },
});

/**
 * Get chat history for a user
 * Accepts userId directly from client (consistent with other queries/mutations)
 */
export const getChatHistory = query({
  args: {
    userId: v.id("users"),
    chatId: v.string(),
  },
  handler: async (ctx, args) => {
    const history = await ctx.db
      .query("chatSessions")
      .withIndex("by_userId_chatId", (q) => q.eq("userId", args.userId).eq("chatId", args.chatId))
      .first();

    return history ?? null;
  },
});
