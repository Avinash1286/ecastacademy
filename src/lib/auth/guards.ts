import { auth } from "./auth.config";
import { redirect } from "next/navigation";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { createConvexClient } from "@/lib/convexClient";

const convex = createConvexClient();

/**
 * Get the current server session
 */
export async function getSession() {
  return await auth();
}

/**
 * Require authentication - redirects to signin if not authenticated
 */
export async function requireAuth() {
  const session = await getSession();

  if (!session || !session.user) {
    redirect("/auth/signin");
  }

  return session;
}

/**
 * Require admin role - redirects if not admin
 */
export async function requireAdmin() {
  const session = await requireAuth();

  const userId = session.user.id as Id<"users">;
  const user = await convex.query(api.auth.getUserById, { id: userId });

  if (!user || user.role !== "admin") {
    redirect("/dashboard");
  }

  return { session, user };
}

/**
 * Check if user is admin (doesn't redirect)
 */
export async function isAdmin(): Promise<boolean> {
  const session = await getSession();

  if (!session || !session.user?.id) {
    return false;
  }

  const userId = session.user.id as Id<"users">;
  const user = await convex.query(api.auth.getUserById, { id: userId });

  return user?.role === "admin";
}

/**
 * Get current user from session
 */
export async function getCurrentUser() {
  const session = await getSession();

  if (!session || !session.user?.id) {
    return null;
  }

  const userId = session.user.id as Id<"users">;
  const user = await convex.query(api.auth.getUserById, { id: userId });

  return user;
}

