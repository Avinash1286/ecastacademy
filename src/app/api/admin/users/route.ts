import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { createConvexClient } from "@/lib/convexClient";

const convex = createConvexClient();

/**
 * Retrieve a list of users with aggregated stats for administrator accounts.
 *
 * Performs an authentication check and returns a JSON response: on success the
 * response body contains `{ users }`; if the caller is unauthenticated, the
 * response is a 401 Unauthorized error; if the caller lacks admin privileges,
 * the response is a 403 Admin access required error; unexpected failures
 * produce a 500 error.
 *
 * @returns A NextResponse containing `{ users }` on success, or a JSON error
 * message with HTTP status 401, 403, or 500 on failure.
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserId = session.user.id as Id<"users">;

    // Fetch users with stats
    const users = await convex.query(api.admin.listUsers, {
      currentUserId,
    });

    return NextResponse.json({ users });
  } catch (error: unknown) {
    console.error("Error fetching users:", error);

    if (error instanceof Error && error.message?.includes("Unauthorized")) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    return NextResponse.json(
      { error: "An error occurred while fetching users" },
      { status: 500 }
    );
  }
}

/**
 * Update a user's role to either "user" or "admin" (admin only).
 *
 * Expects the request body to be JSON with `targetUserId` (the user's Id) and `newRole` (either `"user"` or `"admin"`). Validates inputs and requires the caller to be an authenticated admin; returns the updated user on success.
 *
 * @returns `{ user: Object }` containing the updated user on success, or `{ error: string }` describing the failure on error (returned with an appropriate HTTP status code).
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserId = session.user.id as Id<"users">;
    const { targetUserId, newRole } = await request.json();

    if (!targetUserId || !newRole) {
      return NextResponse.json(
        { error: "Target user ID and new role are required" },
        { status: 400 }
      );
    }

    if (newRole !== "user" && newRole !== "admin") {
      return NextResponse.json(
        { error: "Invalid role. Must be 'user' or 'admin'" },
        { status: 400 }
      );
    }

    // Update user role
    const updatedUser = await convex.mutation(api.admin.updateUserRole, {
      currentUserId,
      targetUserId: targetUserId as Id<"users">,
      newRole,
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error: unknown) {
    console.error("Error updating user role:", error);

    if (error instanceof Error && (error.message?.includes("Unauthorized") || error.message?.includes("Admin"))) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    if (error instanceof Error && error.message?.includes("cannot demote yourself")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "An error occurred while updating user role" },
      { status: 500 }
    );
  }
}

/**
 * Delete a user specified by the `userId` query parameter (admin only).
 *
 * @param request - The incoming request whose URL must include a `userId` query parameter.
 * @returns A JSON NextResponse containing the deletion result on success, or an error object with one of:
 * - 401 when the caller is not authenticated,
 * - 400 when `userId` is missing or the operation is invalid (e.g., cannot delete yourself),
 * - 403 when the caller lacks admin privileges,
 * - 500 for other unexpected errors.
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserId = session.user.id as Id<"users">;
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("userId");

    if (!targetUserId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Delete user
    const result = await convex.mutation(api.admin.deleteUser, {
      currentUserId,
      targetUserId: targetUserId as Id<"users">,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Error deleting user:", error);

    if (error instanceof Error && (error.message?.includes("Unauthorized") || error.message?.includes("Admin"))) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    if (error instanceof Error && error.message?.includes("cannot delete yourself")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "An error occurred while deleting user" },
      { status: 500 }
    );
  }
}
