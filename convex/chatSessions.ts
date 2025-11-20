import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

export const saveChatHistory = mutation({
  args: {
    userId: v.id("users"),
    chatId: v.string(),
    chapterId: v.optional(v.string()),
    contentItemId: v.optional(v.string()),
    courseId: v.optional(v.string()),
    title: v.optional(v.string()),
    messages: v.any(),
  },
  handler: async (ctx, args) => {
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
