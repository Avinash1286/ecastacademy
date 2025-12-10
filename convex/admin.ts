import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id, Doc } from "./_generated/dataModel";
import { requireAuthenticatedUser } from "./utils/auth";

// Maximum limits for queries
const MAX_USERS_PER_PAGE = 100;
const MAX_FAILURES_LIMIT = 100;

// Audit action constants
const AUDIT_ACTIONS = {
  USER_ROLE_CHANGED: "user_role_changed",
  USER_DELETED: "user_deleted",
  COURSE_DELETED: "course_deleted",
  ADMIN_ACCESS: "admin_access",
} as const;

// Helper to check if user is admin
// Tries session-based auth first, falls back to userId parameter for server-side admin auth
async function requireAdmin(ctx: QueryCtx | MutationCtx, currentUserId?: Id<"users">): Promise<Doc<"users">> {
  // First, try session-based authentication
  try {
    const { user } = await requireAuthenticatedUser(ctx);
    if (user.role !== "admin") {
      throw new Error("Unauthorized: Admin access required");
    }
    return user;
  } catch {
    // If session auth fails and we have a currentUserId (from server-side admin auth),
    // verify the user exists and is an admin
    if (currentUserId) {
      const user = await ctx.db.get(currentUserId);
      if (!user) {
        throw new Error("User not found");
      }
      if (user.role !== "admin") {
        throw new Error("Unauthorized: Admin access required");
      }
      return user;
    }
    // If no currentUserId provided and session auth failed, throw original error
    throw new Error("Not authenticated");
  }
}

// List all users (admin only) - with pagination
export const listUsers = query({
  args: {
    currentUserId: v.optional(v.id("users")), // Used for server-side admin auth fallback
    limit: v.optional(v.number()),
    cursor: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    // Use session-based auth, with fallback to currentUserId for server-side admin auth
    await requireAdmin(ctx, args.currentUserId);
    
    const limit = Math.min(args.limit ?? MAX_USERS_PER_PAGE, MAX_USERS_PER_PAGE);
    
    // Get users with pagination
    let usersQuery = ctx.db.query("users").order("desc");
    
    const users = await usersQuery.take(limit + 1);
    
    const hasMore = users.length > limit;
    const pageUsers = hasMore ? users.slice(0, limit) : users;
    const nextCursor = hasMore ? pageUsers[pageUsers.length - 1]._id : null;
    
    // Get all enrollments for these users in a single query (batch approach)
    const userIds = pageUsers.map(u => u._id);
    const allEnrollments = await ctx.db
      .query("enrollments")
      .filter((q) => 
        q.or(...userIds.map(id => q.eq(q.field("userId"), id)))
      )
      .take(10000); // Reasonable limit
    
    // Group enrollments by user
    const enrollmentsByUser = new Map<string, Set<string>>();
    for (const enrollment of allEnrollments) {
      const userId = enrollment.userId.toString();
      if (!enrollmentsByUser.has(userId)) {
        enrollmentsByUser.set(userId, new Set());
      }
      enrollmentsByUser.get(userId)!.add(enrollment.courseId.toString());
    }
    
    // Build response without N+1 queries
    const usersWithStats = pageUsers.map((user) => {
      const userEnrollments = enrollmentsByUser.get(user._id.toString());
      return {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        image: user.image,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        enrollmentCount: userEnrollments?.size ?? 0,
      };
    });
    
    return {
      users: usersWithStats,
      nextCursor,
      hasMore,
    };
  },
});

// Update user role (admin only)
export const updateUserRole = mutation({
  args: {
    currentUserId: v.optional(v.id("users")), // Used for server-side admin auth fallback
    targetUserId: v.id("users"),
    newRole: v.union(v.literal("user"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    // Use session-based auth, with fallback to currentUserId for server-side admin auth
    const adminUser = await requireAdmin(ctx, args.currentUserId);
    
    // Don't allow users to demote themselves
    if (adminUser._id === args.targetUserId && args.newRole === "user") {
      throw new Error("You cannot demote yourself");
    }
    
    // Update target user's role
    const targetUser = await ctx.db.get(args.targetUserId);
    if (!targetUser) {
      throw new Error("Target user not found");
    }
    
    const previousRole = targetUser.role;
    
    await ctx.db.patch(args.targetUserId, {
      role: args.newRole,
      updatedAt: Date.now(),
    });
    
    // Log the role change for audit
    await ctx.scheduler.runAfter(0, internal.audit.logEvent, {
      userId: adminUser._id,
      action: AUDIT_ACTIONS.USER_ROLE_CHANGED,
      resourceType: "user",
      resourceId: args.targetUserId.toString(),
      metadata: {
        targetUserEmail: targetUser.email,
        previousRole,
        newRole: args.newRole,
      },
      success: true,
    });
    
    return await ctx.db.get(args.targetUserId);
  },
});

// Delete user (admin only)
export const deleteUser = mutation({
  args: {
    currentUserId: v.optional(v.id("users")), // Used for server-side admin auth fallback
    targetUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Use session-based auth, with fallback to currentUserId for server-side admin auth
    const adminUser = await requireAdmin(ctx, args.currentUserId);
    
    // Don't allow users to delete themselves
    if (adminUser._id === args.targetUserId) {
      throw new Error("You cannot delete yourself");
    }
    
    const targetUser = await ctx.db.get(args.targetUserId);
    if (!targetUser) {
      throw new Error("Target user not found");
    }
    
    // Store user info for audit before deletion
    const deletedUserEmail = targetUser.email;
    const deletedUserRole = targetUser.role;
    
    // With Clerk, accounts and sessions are handled by Clerk
    // We only need to delete the Convex user record
    // Note: The user's Clerk account should be deleted separately via Clerk Dashboard or API
    
    // Delete user from Convex database
    
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
    
    // Log the deletion for audit
    await ctx.scheduler.runAfter(0, internal.audit.logEvent, {
      userId: adminUser._id,
      action: AUDIT_ACTIONS.USER_DELETED,
      resourceType: "user",
      resourceId: args.targetUserId.toString(),
      metadata: {
        deletedUserEmail,
        deletedUserRole,
        progressEntriesDeleted: progressEntries.length,
      },
      success: true,
    });
    
    return { success: true, deletedUserId: args.targetUserId };
  },
});

// Get admin statistics - optimized version
export const getAdminStats = query({
  args: {
    currentUserId: v.optional(v.id("users")), // Used for server-side admin auth fallback
  },
  handler: async (ctx, args) => {
    // Use session-based auth, with fallback to currentUserId for server-side admin auth
    await requireAdmin(ctx, args.currentUserId);
    
    // Use take() with limits instead of collect() to prevent memory issues
    // In a production system, you would use pre-computed aggregates
    const users = await ctx.db.query("users").take(10000);
    const courses = await ctx.db.query("courses").take(1000);
    const videos = await ctx.db.query("videos").take(5000);
    
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

// ===========================================================================
// Generation Failure Analysis (Dead Letter Queue)
// ===========================================================================

/**
 * List failed generations for analysis (admin only)
 */
export const listGenerationFailures = query({
  args: {
    currentUserId: v.optional(v.id("users")), // Used for server-side admin auth fallback
    resolvedFilter: v.optional(v.boolean()), // undefined = all, true = resolved only, false = unresolved only
    errorCodeFilter: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.currentUserId);
    
    // Get failures based on resolved filter
    let failures;
    if (args.resolvedFilter !== undefined) {
      failures = await ctx.db
        .query("generationFailures")
        .withIndex("by_resolved", (q) => q.eq("resolved", args.resolvedFilter!))
        .order("desc")
        .take(args.limit || 50);
    } else {
      failures = await ctx.db
        .query("generationFailures")
        .order("desc")
        .take(args.limit || 50);
    }
    
    // Filter by error code if specified
    const filteredFailures = args.errorCodeFilter
      ? failures.filter(f => f.errorCode === args.errorCodeFilter)
      : failures;
    
    // Enrich with capsule and user info
    const enrichedFailures = await Promise.all(
      filteredFailures.map(async (failure) => {
        const capsule = await ctx.db.get(failure.capsuleId);
        const user = failure.userId ? await ctx.db.get(failure.userId) : null;
        
        return {
          ...failure,
          capsuleTitle: capsule?.title || "Unknown",
          capsuleStatus: capsule?.status || "Unknown",
          userName: user?.name || "Unknown",
          userEmail: user?.email || "Unknown",
        };
      })
    );
    
    return enrichedFailures;
  },
});

/**
 * Get failure statistics by error code (admin only)
 */
export const getFailureStats = query({
  args: {
    currentUserId: v.optional(v.id("users")), // Used for server-side admin auth fallback
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.currentUserId);
    
    const failures = await ctx.db.query("generationFailures").collect();
    
    // Group by error code
    const byErrorCode: Record<string, number> = {};
    const byStage: Record<string, number> = {};
    let totalUnresolved = 0;
    let totalResolved = 0;
    let totalTokensWasted = 0;
    
    for (const failure of failures) {
      byErrorCode[failure.errorCode] = (byErrorCode[failure.errorCode] || 0) + 1;
      byStage[failure.failedStage] = (byStage[failure.failedStage] || 0) + 1;
      
      if (failure.resolved) {
        totalResolved++;
      } else {
        totalUnresolved++;
      }
      
      totalTokensWasted += failure.totalTokensUsed;
    }
    
    return {
      totalFailures: failures.length,
      totalUnresolved,
      totalResolved,
      totalTokensWasted,
      byErrorCode,
      byStage,
    };
  },
});

/**
 * Mark a failure as resolved (admin only)
 */
export const resolveGenerationFailure = mutation({
  args: {
    currentUserId: v.optional(v.id("users")), // Used for server-side admin auth fallback
    failureId: v.id("generationFailures"),
    resolution: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.currentUserId);
    
    const failure = await ctx.db.get(args.failureId);
    if (!failure) {
      throw new Error("Failure record not found");
    }
    
    await ctx.db.patch(args.failureId, {
      resolved: true,
      resolvedAt: Date.now(),
      resolution: args.resolution,
    });
    
    return { success: true };
  },
});

/**
 * Bulk resolve failures by error code (admin only)
 */
export const bulkResolveByErrorCode = mutation({
  args: {
    currentUserId: v.optional(v.id("users")), // Used for server-side admin auth fallback
    errorCode: v.string(),
    resolution: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.currentUserId);
    
    const failures = await ctx.db
      .query("generationFailures")
      .withIndex("by_errorCode", (q) => q.eq("errorCode", args.errorCode))
      .filter((q) => q.eq(q.field("resolved"), false))
      .collect();
    
    const now = Date.now();
    let resolvedCount = 0;
    
    for (const failure of failures) {
      await ctx.db.patch(failure._id, {
        resolved: true,
        resolvedAt: now,
        resolution: args.resolution,
      });
      resolvedCount++;
    }
    
    return { success: true, resolvedCount };
  },
});


