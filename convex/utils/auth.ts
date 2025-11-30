import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

export type AuthenticatedCtx = QueryCtx | MutationCtx;

export async function requireAuthenticatedUser(ctx: AuthenticatedCtx): Promise<{
  user: Doc<"users">;
  identityEmail: string;
}> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.email) {
    throw new Error("Not authenticated");
  }

  const userEmail = identity.email;

  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", userEmail))
    .first();

  if (!user) {
    throw new Error("User not found");
  }

  return { user, identityEmail: userEmail };
}

/**
 * Attempts session-based auth first, falls back to currentUserId for client-side auth.
 * This is useful when NextAuth session is verified on the client but Convex doesn't have the auth context.
 */
export async function requireAuthenticatedUserWithFallback(
  ctx: AuthenticatedCtx,
  currentUserId?: Id<"users">
): Promise<{
  user: Doc<"users">;
  identityEmail: string;
}> {
  // First, try session-based authentication
  try {
    return await requireAuthenticatedUser(ctx);
  } catch {
    // If session auth fails and we have a currentUserId (from client-side auth),
    // verify the user exists
    if (currentUserId) {
      const user = await ctx.db.get(currentUserId);
      if (!user) {
        throw new Error("User not found");
      }
      return { user, identityEmail: user.email };
    }
    // If no currentUserId provided and session auth failed, throw original error
    throw new Error("Not authenticated");
  }
}

export async function requireAdminUser(ctx: AuthenticatedCtx): Promise<Doc<"users">> {
  const { user } = await requireAuthenticatedUser(ctx);
  if (user.role !== "admin") {
    throw new Error("Admin access required");
  }
  return user;
}

/**
 * Attempts session-based admin auth first, falls back to currentUserId for client-side auth.
 */
export async function requireAdminUserWithFallback(
  ctx: AuthenticatedCtx,
  currentUserId?: Id<"users">
): Promise<Doc<"users">> {
  const { user } = await requireAuthenticatedUserWithFallback(ctx, currentUserId);
  if (user.role !== "admin") {
    throw new Error("Admin access required");
  }
  return user;
}
