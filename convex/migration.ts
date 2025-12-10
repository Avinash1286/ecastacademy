/**
 * Migration Script: Clear all legacy users
 * 
 * This script deletes all users and their related data from the database so we can start fresh with Clerk.
 * Run this ONLY if you're ready to delete all existing users.
 * 
 * Usage: Call this internal mutation from Convex dashboard or via scheduled job
 * This is an internal mutation and cannot be called directly from clients.
 */

import { internalMutation } from "./_generated/server";

export const clearAllUsers = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get all users
    const allUsers = await ctx.db.query("users").collect();
    
    console.log(`Found ${allUsers.length} users to delete`);

    let deletedRelatedRecords = 0;

    // Delete related data first to avoid orphaned records
    for (const user of allUsers) {
      // Delete progress records
      const progressRecords = await ctx.db
        .query("progress")
        .withIndex("by_userId_courseId", (q) => q.eq("userId", user._id))
        .collect();
      for (const record of progressRecords) {
        await ctx.db.delete(record._id);
        deletedRelatedRecords++;
      }

      // Delete enrollments
      const enrollments = await ctx.db
        .query("enrollments")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect();
      for (const record of enrollments) {
        await ctx.db.delete(record._id);
        deletedRelatedRecords++;
      }

      // Delete certificates
      const certificates = await ctx.db
        .query("certificates")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect();
      for (const record of certificates) {
        await ctx.db.delete(record._id);
        deletedRelatedRecords++;
      }

      // Delete capsule progress
      const capsuleProgress = await ctx.db
        .query("capsuleProgress")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect();
      for (const record of capsuleProgress) {
        await ctx.db.delete(record._id);
        deletedRelatedRecords++;
      }

      // Delete chat sessions and their messages
      const chatSessions = await ctx.db
        .query("chatSessions")
        .withIndex("by_userId_lastMessageAt", (q) => q.eq("userId", user._id))
        .collect();
      for (const session of chatSessions) {
        // Delete messages for this session
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
          .collect();
        for (const message of messages) {
          await ctx.db.delete(message._id);
          deletedRelatedRecords++;
        }
        await ctx.db.delete(session._id);
        deletedRelatedRecords++;
      }

      // Delete quiz attempts
      const quizAttempts = await ctx.db
        .query("quizAttempts")
        .withIndex("by_userId_courseId", (q) => q.eq("userId", user._id))
        .collect();
      for (const record of quizAttempts) {
        await ctx.db.delete(record._id);
        deletedRelatedRecords++;
      }

      // Delete bookmarks
      const bookmarks = await ctx.db
        .query("bookmarks")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect();
      for (const record of bookmarks) {
        await ctx.db.delete(record._id);
        deletedRelatedRecords++;
      }

      // Delete audit logs
      const auditLogs = await ctx.db
        .query("auditLogs")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect();
      for (const record of auditLogs) {
        await ctx.db.delete(record._id);
        deletedRelatedRecords++;
      }
    }

    // Delete each user (no PII in logs)
    for (const user of allUsers) {
      await ctx.db.delete(user._id);
      console.log(`Deleted user: ${user._id}`);
    }
    
    return {
      success: true,
      deletedCount: allUsers.length,
      deletedRelatedRecords,
      message: `Successfully deleted ${allUsers.length} users and ${deletedRelatedRecords} related records`,
    };
  },
});
