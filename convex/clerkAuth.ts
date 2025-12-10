import { v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";

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

// Get user by ID (requires authentication, returns safe subset of fields)
export const getUserById = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    // Require authentication to prevent anonymous enumeration
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    const user = await ctx.db.get(args.id);
    if (!user) {
      return null;
    }

    // Return only safe public profile fields (exclude sensitive data like email for non-owners)
    const requestingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    const isOwner = requestingUser?._id === user._id;
    const isAdmin = requestingUser?.role === "admin";

    if (isOwner || isAdmin) {
      // Full access for owner or admin
      return user;
    }

    // Return limited public profile for other authenticated users
    return {
      _id: user._id,
      _creationTime: user._creationTime,
      name: user.name,
      image: user.image,
      // Omit: email, clerkId, role, and other sensitive fields
    };
  },
});

// Internal query for server-side user lookup by email
// Not exposed to clients - use only from server actions, internal mutations, or auth resolution
export const getUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    return user;
  },
});

// Admin query for server-side user lookup by email (accessible via deploy key auth)
// Used by server-side auth resolution where we don't have user context yet
// SECURITY: This should only be called from trusted server-side code with admin auth
export const getUserByEmailAdmin = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    // This query is intended to be called with admin/deploy key auth
    // No user identity check - the security comes from requiring admin auth on the client
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    return user;
  },
});

// Authenticated query for looking up own user by email (for auth resolution)
// Only returns the user if the email matches the authenticated user's identity
export const getOwnUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    // Only allow looking up your own email to prevent enumeration
    if (identity.email !== args.email) {
      throw new Error("Can only look up your own user record");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    return user;
  },
});
