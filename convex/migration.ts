/**
 * Migration Script: Clear all legacy users
 * 
 * This script deletes all users from the database so we can start fresh with Clerk.
 * Run this ONLY if you're ready to delete all existing users.
 * 
 * Usage: Call this mutation from Convex dashboard
 */

import { mutation } from "./_generated/server";

export const clearAllUsers = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all users
    const allUsers = await ctx.db.query("users").collect();
    
    console.log(`Found ${allUsers.length} users to delete`);
    
    // Delete each user
    for (const user of allUsers) {
      await ctx.db.delete(user._id);
      console.log(`Deleted user: ${user.email}`);
    }
    
    return {
      success: true,
      deletedCount: allUsers.length,
      message: `Successfully deleted ${allUsers.length} users`,
    };
  },
});
