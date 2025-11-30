import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * IMPORTANT: This file provides custom Convex database operations for NextAuth.js
 * 
 * This is NOT the @convex-dev/auth package (Convex Auth).
 * This file contains custom Convex queries and mutations that NextAuth.js uses
 * to interact with the Convex database for user management, sessions, accounts, etc.
 * 
 * Authentication is handled by NextAuth.js (next-auth package).
 * Convex serves as the database backend through these helper functions.
 */

// ============= USER OPERATIONS =============

// Get user by email
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

// Get user by ID
export const getUserById = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Create new user
export const createUser = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.string(),
    password: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerified: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      name: args.name,
      email: args.email,
      password: args.password,
      image: args.image,
      emailVerified: args.emailVerified,
      role: "user", // Default role
      createdAt: now,
      updatedAt: now,
    });
    return userId;
  },
});

// Update user
export const updateUser = mutation({
  args: {
    id: v.id("users"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    password: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerified: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    return await ctx.db.get(id);
  },
});

// Secure update user profile (user can only update their own profile)
export const updateUserProfile = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, name } = args;
    
    // Validate name
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      throw new Error("Name must be at least 2 characters long");
    }
    if (trimmedName.length > 100) {
      throw new Error("Name must be less than 100 characters");
    }
    // Basic sanitization - only allow letters, spaces, hyphens, apostrophes, and periods
    const nameRegex = /^[a-zA-Z\s\-'.]+$/;
    if (!nameRegex.test(trimmedName)) {
      throw new Error("Name can only contain letters, spaces, hyphens, apostrophes, and periods");
    }
    
    // Verify user exists
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // Update user name
    await ctx.db.patch(userId, {
      name: trimmedName,
      updatedAt: Date.now(),
    });
    
    return { success: true, name: trimmedName };
  },
});

// ============= ACCOUNT OPERATIONS =============

// Link account (OAuth)
export const linkAccount = mutation({
  args: {
    userId: v.id("users"),
    type: v.string(),
    provider: v.string(),
    providerAccountId: v.string(),
    refresh_token: v.optional(v.string()),
    access_token: v.optional(v.string()),
    expires_at: v.optional(v.number()),
    token_type: v.optional(v.string()),
    scope: v.optional(v.string()),
    id_token: v.optional(v.string()),
    session_state: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const accountId = await ctx.db.insert("accounts", args);
    return accountId;
  },
});

// Get account by provider
export const getAccountByProvider = query({
  args: {
    provider: v.string(),
    providerAccountId: v.string(),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_provider_providerAccountId", (q) =>
        q.eq("provider", args.provider).eq("providerAccountId", args.providerAccountId)
      )
      .first();
    return account;
  },
});

// Get accounts by user ID
export const getAccountsByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    return accounts;
  },
});

// Unlink account
export const unlinkAccount = mutation({
  args: {
    provider: v.string(),
    providerAccountId: v.string(),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_provider_providerAccountId", (q) =>
        q.eq("provider", args.provider).eq("providerAccountId", args.providerAccountId)
      )
      .first();
    
    if (account) {
      await ctx.db.delete(account._id);
    }
    return account;
  },
});

// ============= SESSION OPERATIONS =============

// Create session
export const createSession = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
    expires: v.number(),
  },
  handler: async (ctx, args) => {
    const sessionId = await ctx.db.insert("sessions", args);
    return sessionId;
  },
});

// Get session by token
export const getSessionByToken = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_sessionToken", (q) => q.eq("sessionToken", args.sessionToken))
      .first();
    
    if (!session) return null;
    
    // Check if session is expired
    if (session.expires < Date.now()) {
      return null;
    }
    
    // Get user data
    const user = await ctx.db.get(session.userId);
    if (!user) return null;
    
    return {
      session,
      user,
    };
  },
});

// Update session
export const updateSession = mutation({
  args: {
    sessionToken: v.string(),
    expires: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_sessionToken", (q) => q.eq("sessionToken", args.sessionToken))
      .first();
    
    if (!session) return null;
    
    if (args.expires) {
      await ctx.db.patch(session._id, { expires: args.expires });
    }
    
    return await ctx.db.get(session._id);
  },
});

// Delete session
export const deleteSession = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_sessionToken", (q) => q.eq("sessionToken", args.sessionToken))
      .first();
    
    if (session) {
      await ctx.db.delete(session._id);
      return session;
    }
    return null;
  },
});

// Delete expired sessions (cleanup)
export const deleteExpiredSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expiredSessions = await ctx.db
      .query("sessions")
      .filter((q) => q.lt(q.field("expires"), now))
      .collect();
    
    for (const session of expiredSessions) {
      await ctx.db.delete(session._id);
    }
    
    return { deleted: expiredSessions.length };
  },
});

// ============= VERIFICATION TOKEN OPERATIONS =============

// Create verification token
export const createVerificationToken = mutation({
  args: {
    identifier: v.string(),
    token: v.string(),
    expires: v.number(),
    type: v.union(v.literal("passwordReset"), v.literal("emailVerification")),
  },
  handler: async (ctx, args) => {
    const tokenId = await ctx.db.insert("verificationTokens", args);
    return tokenId;
  },
});

// Get verification token
export const getVerificationToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const verificationToken = await ctx.db
      .query("verificationTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    
    if (!verificationToken) return null;
    
    // Check if token is expired
    if (verificationToken.expires < Date.now()) {
      return null;
    }
    
    return verificationToken;
  },
});

// Delete verification token (after use)
export const deleteVerificationToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const verificationToken = await ctx.db
      .query("verificationTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    
    if (verificationToken) {
      await ctx.db.delete(verificationToken._id);
      return verificationToken;
    }
    return null;
  },
});

// Delete expired verification tokens (cleanup)
export const deleteExpiredVerificationTokens = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expiredTokens = await ctx.db
      .query("verificationTokens")
      .filter((q) => q.lt(q.field("expires"), now))
      .collect();
    
    for (const token of expiredTokens) {
      await ctx.db.delete(token._id);
    }
    
    return { deleted: expiredTokens.length };
  },
});

