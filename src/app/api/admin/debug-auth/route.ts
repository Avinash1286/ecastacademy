import { NextResponse } from "next/server";
import { auth as clerkAuth, currentUser } from "@clerk/nextjs/server";
import { auth } from "@/lib/auth/auth.config";
import { createConvexClient } from "@/lib/convexClient";
import { api } from "../../../../../convex/_generated/api";

type ClaimsWithRole = {
  publicMetadata?: { role?: unknown };
  metadata?: { role?: unknown };
};

function roleFromSessionClaims(claims: unknown): string | undefined {
  const typed = claims as ClaimsWithRole | null | undefined;
  const role = typed?.publicMetadata?.role ?? typed?.metadata?.role;
  return typeof role === "string" ? role : undefined;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Require any signed-in user
  const session: { user?: { clerkId?: string } } | null = await auth();
  if (!session?.user?.clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionClaims }: { sessionClaims: unknown } = await clerkAuth();
  const user = await currentUser();

  const email = user?.emailAddresses?.[0]?.emailAddress;
  const convex = createConvexClient();
  const convexUser = email ? await convex.query(api.clerkAuth.getUserByEmail, { email }) : null;

  return NextResponse.json({
    clerkUserId: session.user.clerkId,
    email,
    roleFromSessionClaims: roleFromSessionClaims(sessionClaims),
    roleFromClerkPublicMetadata: typeof user?.publicMetadata?.role === "string" ? user.publicMetadata.role : undefined,
    roleFromClerkPrivateMetadata: typeof user?.privateMetadata?.role === "string" ? user.privateMetadata.role : undefined,
    roleFromConvexUser: typeof convexUser?.role === "string" ? convexUser.role : undefined,
    convexUserId: convexUser?._id,
    sessionUser: session.user,
  });
}
