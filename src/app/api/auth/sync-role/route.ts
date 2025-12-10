import { NextResponse } from "next/server";
import { auth as clerkAuth, currentUser, clerkClient } from "@clerk/nextjs/server";
import { createConvexClient } from "@/lib/convexClient";
import { api } from "../../../../../convex/_generated/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/sync-role
 * 
 * Syncs the user's role from Convex database to Clerk's publicMetadata.
 * This is needed because the middleware checks Clerk's session claims for the role,
 * but the role is stored in Convex. This endpoint bridges that gap.
 * 
 * Call this endpoint after manually setting a user's role in Convex database.
 */
export async function POST() {
  const clerkAuthResult = await clerkAuth();
  const { userId } = clerkAuthResult;

  if (!userId) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;

  if (!email) {
    return NextResponse.json(
      { error: "No email address found" },
      { status: 400 }
    );
  }

  // Get user token for authenticated Convex query
  const userToken = await clerkAuthResult.getToken({ template: "convex" });

  if (!userToken) {
    return NextResponse.json(
      { error: "Could not get Convex token" },
      { status: 500 }
    );
  }

  // Fetch the user's role from Convex
  const convex = createConvexClient({ userToken });
  const convexUser = await convex.query(api.clerkAuth.getOwnUserByEmail, { email });

  if (!convexUser) {
    return NextResponse.json(
      { error: "User not found in Convex database" },
      { status: 404 }
    );
  }

  const convexRole = convexUser.role;
  const currentClerkRole = user?.publicMetadata?.role;

  // If roles match, no sync needed
  if (currentClerkRole === convexRole) {
    return NextResponse.json({
      message: "Role already synced",
      role: convexRole,
      synced: false,
    });
  }

  // Sync the role to Clerk's publicMetadata
  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...user?.publicMetadata,
        role: convexRole,
      },
    });

    return NextResponse.json({
      message: "Role synced successfully",
      previousRole: currentClerkRole || "none",
      newRole: convexRole,
      synced: true,
      note: "Please sign out and sign back in for changes to take full effect in session claims.",
    });
  } catch (error) {
    console.error("Failed to sync role to Clerk:", error);
    return NextResponse.json(
      { error: "Failed to sync role to Clerk" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/sync-role
 * 
 * Check current role status without syncing.
 */
export async function GET() {
  const clerkAuthResult = await clerkAuth();
  const { userId } = clerkAuthResult;

  if (!userId) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;

  if (!email) {
    return NextResponse.json(
      { error: "No email address found" },
      { status: 400 }
    );
  }

  // Get user token for authenticated Convex query
  const userToken = await clerkAuthResult.getToken({ template: "convex" });

  if (!userToken) {
    return NextResponse.json(
      { error: "Could not get Convex token" },
      { status: 500 }
    );
  }

  // Fetch the user's role from Convex
  const convex = createConvexClient({ userToken });
  const convexUser = await convex.query(api.clerkAuth.getOwnUserByEmail, { email });

  return NextResponse.json({
    clerkUserId: userId,
    email,
    clerkPublicMetadataRole: user?.publicMetadata?.role || null,
    convexRole: convexUser?.role || null,
    convexUserId: convexUser?._id || null,
    isSynced: user?.publicMetadata?.role === convexUser?.role,
  });
}
