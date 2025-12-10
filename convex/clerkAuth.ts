import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Clerk-based authentication helpers for Convex
 * 
 * These functions work with Clerk's authentication system.
 * Users are automatically created when they first authenticate with Clerk.
 */

// Get or create user from Clerk auth
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    // Look up user by Clerk subject (sub)
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    return user;
  },
});

// Sync user from Clerk (create or update)
export const syncUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const clerkId = identity.subject;
    const email = identity.email;
    if (!email) {
      throw new Error(
        "Email is required for user sync. Clerk user is missing an email address."
      );
    }
    const name = identity.name || identity.givenName || "";
    const image = identity.pictureUrl || "";

    // Check if user exists
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();

    const now = Date.now();

    if (user) {
      // Update existing user
      await ctx.db.patch(user._id, {
        name,
        email,
        image,
        updatedAt: now,
      });
      return user._id;
    } else {
      // Create new user
      const userId = await ctx.db.insert("users", {
        clerkId,
        email,
        name,
        image,
        role: "user",
        createdAt: now,
        updatedAt: now,
        emailVerified: now, // Clerk handles email verification
      });
      return userId;
    }
  },
});

// Update user profile (currently only name)
export const updateUserProfile = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Ensure the caller is updating their own record
    if (user.clerkId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    const trimmedName = args.name.trim();
    const now = Date.now();

    await ctx.db.patch(user._id, {
      name: trimmedName,
      updatedAt: now,
    });

    return {
      ...user,
      name: trimmedName,
      updatedAt: now,
    };
  },
});

// Get user by ID (public query)
export const getUserById = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Legacy compatibility: Get user by email
export const getUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    return user;
  },
});
