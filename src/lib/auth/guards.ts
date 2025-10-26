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
 * Ensures the current session belongs to an admin user.
 *
 * If the authenticated user is missing or does not have the `admin` role, redirects to `/dashboard`.
 *
 * @returns An object with `session` (the authenticated session) and `user` (the fetched user record)
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
 * Determines whether the current authenticated user has the "admin" role.
 *
 * @returns `true` if the current session corresponds to a user whose `role` is `"admin"`, `false` otherwise.
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
 * Retrieves the current authenticated user's record using the active session.
 *
 * @returns The user record corresponding to the session's user id, or `null` if no session or user id is present.
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
