import { NextResponse } from "next/server";
import { auth as clerkAuth, currentUser } from "@clerk/nextjs/server";
import { requireAdmin, roleFromSessionClaims } from "@/lib/auth/auth.config";
import { createConvexClient } from "@/lib/convexClient";
import { api } from "../../../../../convex/_generated/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Only allow this debug endpoint in development/staging environments
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_DEBUG_ENDPOINTS !== "true") {
    return NextResponse.json(
      { error: "Debug endpoint is disabled in production" },
      { status: 404 }
    );
  }

  // Require admin access for debug endpoint
  let adminSession;
  try {
    adminSession = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { sessionClaims }: { sessionClaims: unknown } = await clerkAuth();
  const user = await currentUser();

  const email = user?.emailAddresses?.[0]?.emailAddress;
  const convex = createConvexClient();
  const convexUser = email ? await convex.query(api.clerkAuth.getOwnUserByEmail, { email }) : null;

  return NextResponse.json({
    clerkUserId: adminSession.user.clerkId,
    email,
    roleFromSessionClaims: roleFromSessionClaims(sessionClaims as Record<string, unknown> | null | undefined),
    roleFromClerkPublicMetadata: typeof user?.publicMetadata?.role === "string" ? user.publicMetadata.role : undefined,
    roleFromClerkPrivateMetadata: typeof user?.privateMetadata?.role === "string" ? user.privateMetadata.role : undefined,
    roleFromConvexUser: typeof convexUser?.role === "string" ? convexUser.role : undefined,
    convexUserId: convexUser?._id,
    sessionUser: adminSession.user,
  });
}
