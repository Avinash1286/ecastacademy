import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc } from "../_generated/dataModel";

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

export async function requireAdminUser(ctx: AuthenticatedCtx): Promise<Doc<"users">> {
  const { user } = await requireAuthenticatedUser(ctx);
  if (user.role !== "admin") {
    throw new Error("Admin access required");
  }
  return user;
}
