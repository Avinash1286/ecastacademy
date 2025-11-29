/**
 * Audit Logging Module
 * 
 * Provides structured audit logging for security and compliance.
 * Logs significant user actions, especially around capsule generation.
 * 
 * Usage:
 *   await ctx.runMutation(internal.audit.logEvent, {
 *     userId: user._id,
 *     action: "capsule_generation_started",
 *     resourceType: "capsule",
 *     resourceId: capsuleId,
 *     success: true,
 *   });
 */

import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { requireAdminUser } from "./utils/auth";

// =============================================================================
// Audit Action Types
// =============================================================================

export const AUDIT_ACTIONS = {
  // Capsule lifecycle
  CAPSULE_CREATED: "capsule_created",
  CAPSULE_GENERATION_STARTED: "capsule_generation_started",
  CAPSULE_GENERATION_COMPLETED: "capsule_generation_completed",
  CAPSULE_GENERATION_FAILED: "capsule_generation_failed",
  CAPSULE_DELETED: "capsule_deleted",
  
  // Lesson operations
  LESSON_REGENERATION_STARTED: "lesson_regeneration_started",
  LESSON_REGENERATION_COMPLETED: "lesson_regeneration_completed",
  LESSON_REGENERATION_FAILED: "lesson_regeneration_failed",
  
  // User operations
  USER_LOGIN: "user_login",
  USER_LOGOUT: "user_logout",
  
  // Security events
  AUTH_FAILURE: "auth_failure",
  RATE_LIMIT_EXCEEDED: "rate_limit_exceeded",
  UNAUTHORIZED_ACCESS_ATTEMPT: "unauthorized_access_attempt",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

// =============================================================================
// Internal Mutations - Only callable from other Convex functions
// =============================================================================

/**
 * Log an audit event
 * This is an internal mutation to ensure only trusted code can create audit logs.
 */
export const logEvent = internalMutation({
  args: {
    userId: v.id("users"),
    action: v.string(),
    resourceType: v.string(),
    resourceId: v.string(),
    metadata: v.optional(v.any()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Sanitize metadata to prevent storing sensitive data
    const sanitizedMetadata = args.metadata 
      ? sanitizeMetadata(args.metadata)
      : undefined;
    
    await ctx.db.insert("auditLogs", {
      userId: args.userId,
      action: args.action,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      metadata: sanitizedMetadata,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      success: args.success,
      errorMessage: args.errorMessage,
      timestamp: Date.now(),
    });
  },
});

/**
 * Log a security event (unauthorized access, rate limiting, etc.)
 */
export const logSecurityEvent = internalMutation({
  args: {
    userId: v.optional(v.id("users")),
    action: v.string(),
    resourceType: v.string(),
    resourceId: v.string(),
    metadata: v.optional(v.any()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // For security events without a userId, we still want to log
    // Use a placeholder ID or skip userId requirement
    if (!args.userId) {
      console.warn(`[Audit] Security event logged without userId: ${args.action}`);
      // Log to console for now - in production, might want dedicated security log
      console.log(`[SECURITY] Action: ${args.action}, Resource: ${args.resourceType}/${args.resourceId}`);
      return;
    }
    
    await ctx.db.insert("auditLogs", {
      userId: args.userId,
      action: args.action,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      metadata: args.metadata,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      success: false,
      errorMessage: args.errorMessage,
      timestamp: Date.now(),
    });
  },
});

// =============================================================================
// Queries - For admin dashboard
// =============================================================================

/**
 * Get audit logs for a specific user (admin only)
 */
export const getLogsForUser = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Verify admin authorization
    await requireAdminUser(ctx);
    
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit || 100);
    
    return logs;
  },
});

/**
 * Get recent audit logs (admin only)
 */
export const getRecentLogs = query({
  args: {
    limit: v.optional(v.number()),
    action: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify admin authorization
    await requireAdminUser(ctx);
    
    const limitValue = args.limit || 100;
    
    if (args.action) {
      const logs = await ctx.db
        .query("auditLogs")
        .withIndex("by_action", (q) => q.eq("action", args.action!))
        .order("desc")
        .take(limitValue);
      return logs;
    } else {
      const logs = await ctx.db
        .query("auditLogs")
        .withIndex("by_timestamp")
        .order("desc")
        .take(limitValue);
      return logs;
    }
  },
});

/**
 * Get audit logs for a specific resource
 */
export const getLogsForResource = query({
  args: {
    resourceId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // For now, only admins can view resource logs
    // Future enhancement: allow users to view logs for their own resources
    await requireAdminUser(ctx);
    
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_resourceId", (q) => q.eq("resourceId", args.resourceId))
      .order("desc")
      .take(args.limit || 50);
    
    return logs;
  },
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Sanitize metadata to remove sensitive fields before logging
 */
function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const sensitiveFields = [
    "password",
    "token",
    "apiKey",
    "secret",
    "pdfBase64",
    "pdfData",
    "sourcePdfData",
  ];
  
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(metadata)) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "string" && value.length > 1000) {
      // Truncate long strings
      sanitized[key] = value.substring(0, 1000) + "...[TRUNCATED]";
    } else if (typeof value === "object" && value !== null) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}
