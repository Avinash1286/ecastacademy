import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Helper to check if user is admin
async function requireAdmin(ctx: any, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  if (!user || user.role !== "admin") {
    throw new Error("Unauthorized: Admin access required");
  }
  return user;
}

// List all users (admin only)
export const listUsers = query({
  args: {
    currentUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify current user is admin
    await requireAdmin(ctx, args.currentUserId);
    
    const users = await ctx.db.query("users").collect();
    
    // Get statistics for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        // Count enrollments (progress entries)
        const enrollments = await ctx.db
          .query("progress")
          .filter((q) => q.eq(q.field("userId"), user._id))
          .collect();
        
        const uniqueCourses = new Set(enrollments.map(e => e.courseId));
        
        return {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          image: user.image,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
          enrollmentCount: uniqueCourses.size,
        };
      })
    );
    
    return usersWithStats;
  },
});

// Update user role (admin only)
export const updateUserRole = mutation({
  args: {
    currentUserId: v.id("users"),
    targetUserId: v.id("users"),
    newRole: v.union(v.literal("user"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    // Verify current user is admin
    await requireAdmin(ctx, args.currentUserId);
    
    // Don't allow users to demote themselves
    if (args.currentUserId === args.targetUserId && args.newRole === "user") {
      throw new Error("You cannot demote yourself");
    }
    
    // Update target user's role
    const targetUser = await ctx.db.get(args.targetUserId);
    if (!targetUser) {
      throw new Error("Target user not found");
    }
    
    await ctx.db.patch(args.targetUserId, {
      role: args.newRole,
      updatedAt: Date.now(),
    });
    
    return await ctx.db.get(args.targetUserId);
  },
});

// Delete user (admin only)
export const deleteUser = mutation({
  args: {
    currentUserId: v.id("users"),
    targetUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify current user is admin
    await requireAdmin(ctx, args.currentUserId);
    
    // Don't allow users to delete themselves
    if (args.currentUserId === args.targetUserId) {
      throw new Error("You cannot delete yourself");
    }
    
    const targetUser = await ctx.db.get(args.targetUserId);
    if (!targetUser) {
      throw new Error("Target user not found");
    }
    
    // Delete user's accounts
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_userId", (q) => q.eq("userId", args.targetUserId))
      .collect();
    
    for (const account of accounts) {
      await ctx.db.delete(account._id);
    }
    
    // Delete user's sessions
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.targetUserId))
      .collect();
    
    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }
    
    // Delete user's progress
    const progressEntries = await ctx.db
      .query("progress")
      .filter((q) => q.eq(q.field("userId"), args.targetUserId))
      .collect();
    
    for (const progress of progressEntries) {
      await ctx.db.delete(progress._id);
    }
    
    // Finally, delete the user
    await ctx.db.delete(args.targetUserId);
    
    return { success: true, deletedUserId: args.targetUserId };
  },
});

// Get admin statistics
export const getAdminStats = query({
  args: {
    currentUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify current user is admin
    await requireAdmin(ctx, args.currentUserId);
    
    const users = await ctx.db.query("users").collect();
    const courses = await ctx.db.query("courses").collect();
    const videos = await ctx.db.query("videos").collect();
    
    const adminCount = users.filter(u => u.role === "admin").length;
    const userCount = users.filter(u => u.role === "user").length;
    const publishedCourses = courses.filter(c => c.isPublished).length;
    
    return {
      totalUsers: users.length,
      adminCount,
      userCount,
      totalCourses: courses.length,
      publishedCourses,
      totalVideos: videos.length,
    };
  },
});

