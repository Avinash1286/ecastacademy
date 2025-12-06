import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

/**
 * IMPORTANT: This file provides custom Convex database operations for NextAuth.js
 * 
 * This is NOT the @convex-dev/auth package (Convex Auth).
 * This file contains custom Convex queries and mutations that NextAuth.js uses
 * to interact with the Convex database for user management, sessions, accounts, etc.
 * 
 * Authentication is handled by NextAuth.js (next-auth package).
 * Convex serves as the database backend through these helper functions.
 * 
 * SECURITY: Sensitive mutations that manage user accounts, sessions, and tokens
 * require a server secret key to prevent unauthorized access. This key should
 * only be known by the server-side NextAuth.js integration.
 */

// Server secret for protecting auth mutations - must match CONVEX_AUTH_SECRET env var
const AUTH_SECRET = process.env.CONVEX_AUTH_SECRET;

/**
 * Validates the server secret for auth operations.
 * This prevents malicious clients from calling these mutations directly.
 */
function validateAuthSecret(providedSecret: string | undefined): void {
  // In development, allow if no secret is configured (for easier testing)
  // In production, this should always be set
  if (!AUTH_SECRET) {
    console.warn("CONVEX_AUTH_SECRET is not set - auth mutations are unprotected!");
    return;
  }
  
  if (!providedSecret || providedSecret !== AUTH_SECRET) {
    throw new Error("Unauthorized: Invalid auth secret");
  }
}

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
// SECURITY: Requires auth secret to prevent unauthorized user creation
export const createUser = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.string(),
    password: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerified: v.optional(v.number()),
    _authSecret: v.optional(v.string()), // Server secret for validation
  },
  handler: async (ctx, args) => {
    validateAuthSecret(args._authSecret);
    
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
// SECURITY: Requires auth secret to prevent unauthorized user updates
export const updateUser = mutation({
  args: {
    id: v.id("users"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    password: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerified: v.optional(v.number()),
    _authSecret: v.optional(v.string()), // Server secret for validation
  },
  handler: async (ctx, args) => {
    validateAuthSecret(args._authSecret);
    
    const { id, _authSecret, ...providedUpdates } = args;
    
    // Only include fields that are actually provided (not undefined)
    // This prevents overwriting existing values with undefined
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (providedUpdates.name !== undefined) updates.name = providedUpdates.name;
    if (providedUpdates.email !== undefined) updates.email = providedUpdates.email;
    if (providedUpdates.password !== undefined) updates.password = providedUpdates.password;
    if (providedUpdates.image !== undefined) updates.image = providedUpdates.image;
    if (providedUpdates.emailVerified !== undefined) updates.emailVerified = providedUpdates.emailVerified;
    
    await ctx.db.patch(id, updates);
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
    
    // SECURITY: Verify the authenticated user matches the userId being modified
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.email) {
      throw new Error("Not authenticated");
    }
    
    const authenticatedUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();
    
    if (!authenticatedUser || authenticatedUser._id !== userId) {
      throw new Error("Unauthorized: You can only update your own profile");
    }
    
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
    
    // Update user name
    await ctx.db.patch(userId, {
      name: trimmedName,
      updatedAt: Date.now(),
    });
    
    return { success: true, name: trimmedName };
  },
});

// Update user profile image (for syncing OAuth profile picture)
export const updateUserImage = mutation({
  args: {
    userId: v.id("users"),
    image: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, image } = args;
    
    // SECURITY: Verify the authenticated user matches the userId being modified
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.email) {
      throw new Error("Not authenticated");
    }
    
    const authenticatedUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();
    
    if (!authenticatedUser || authenticatedUser._id !== userId) {
      throw new Error("Unauthorized: You can only update your own profile");
    }
    
    // Update user image
    await ctx.db.patch(userId, {
      image,
      updatedAt: Date.now(),
    });
    
    return { success: true, image };
  },
});

// ============= ACCOUNT OPERATIONS =============

// Link account (OAuth)
// SECURITY: Requires auth secret to prevent unauthorized account linking
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
    _authSecret: v.optional(v.string()), // Server secret for validation
  },
  handler: async (ctx, args) => {
    validateAuthSecret(args._authSecret);
    
    const { _authSecret, ...accountData } = args;
    const accountId = await ctx.db.insert("accounts", accountData);
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
// SECURITY: Requires auth secret to prevent unauthorized account unlinking
export const unlinkAccount = mutation({
  args: {
    provider: v.string(),
    providerAccountId: v.string(),
    _authSecret: v.optional(v.string()), // Server secret for validation
  },
  handler: async (ctx, args) => {
    validateAuthSecret(args._authSecret);
    
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
// SECURITY: Requires auth secret to prevent session hijacking
export const createSession = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
    expires: v.number(),
    _authSecret: v.optional(v.string()), // Server secret for validation
  },
  handler: async (ctx, args) => {
    validateAuthSecret(args._authSecret);
    
    const { _authSecret, ...sessionData } = args;
    const sessionId = await ctx.db.insert("sessions", sessionData);
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
// SECURITY: Requires auth secret to prevent session manipulation
export const updateSession = mutation({
  args: {
    sessionToken: v.string(),
    expires: v.optional(v.number()),
    _authSecret: v.optional(v.string()), // Server secret for validation
  },
  handler: async (ctx, args) => {
    validateAuthSecret(args._authSecret);
    
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
// SECURITY: Requires auth secret to prevent unauthorized session deletion
export const deleteSession = mutation({
  args: { 
    sessionToken: v.string(),
    _authSecret: v.optional(v.string()), // Server secret for validation
  },
  handler: async (ctx, args) => {
    validateAuthSecret(args._authSecret);
    
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
// SECURITY: Internal mutation - can only be called from server (cron jobs, other server functions)
export const deleteExpiredSessions = internalMutation({
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
// SECURITY: Requires auth secret to prevent token creation attacks
export const createVerificationToken = mutation({
  args: {
    identifier: v.string(),
    token: v.string(),
    expires: v.number(),
    type: v.union(v.literal("passwordReset"), v.literal("emailVerification")),
    _authSecret: v.optional(v.string()), // Server secret for validation
  },
  handler: async (ctx, args) => {
    validateAuthSecret(args._authSecret);
    
    const { _authSecret, ...tokenData } = args;
    const tokenId = await ctx.db.insert("verificationTokens", tokenData);
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
// SECURITY: Requires auth secret to prevent malicious token deletion
export const deleteVerificationToken = mutation({
  args: { 
    token: v.string(),
    _authSecret: v.optional(v.string()), // Server secret for validation
  },
  handler: async (ctx, args) => {
    validateAuthSecret(args._authSecret);
    
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
// SECURITY: Internal mutation - can only be called from server (cron jobs, other server functions)
export const deleteExpiredVerificationTokens = internalMutation({
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

