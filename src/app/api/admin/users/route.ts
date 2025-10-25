import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { createConvexClient } from "@/lib/convexClient";

const convex = createConvexClient();

// GET - List all users (admin only)
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

// PATCH - Update user role (admin only)
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

// DELETE - Delete user (admin only)
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

