import { auth as clerkAuth, currentUser, clerkClient } from "@clerk/nextjs/server";
import { createConvexClient } from "../convexClient";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

export type AppRole = "admin" | "user";

export interface SessionUser {
  id?: Id<"users">; // Convex user id
  clerkId: string;
  role?: AppRole;
  email?: string;
}

export interface AppSession {
  user: SessionUser;
}

type ClaimsWithRole = {
  metadata?: { role?: unknown };
  publicMetadata?: { role?: unknown };
};

type ClerkUserLike = {
  publicMetadata?: Record<string, unknown>;
  privateMetadata?: Record<string, unknown>;
  emailAddresses?: { emailAddress: string }[];
};

export function roleFromSessionClaims(claims: Record<string, unknown> | null | undefined): AppRole | undefined {
  const typed = claims as ClaimsWithRole | null | undefined;
  const metadataRole = typed?.metadata?.role;
  const publicMetadataRole = typed?.publicMetadata?.role;
  return (metadataRole ?? publicMetadataRole) as AppRole | undefined;
}

function roleFromClerkUser(user: ClerkUserLike | null | undefined): AppRole | undefined {
  const publicRole = user?.publicMetadata?.role as AppRole | undefined;
  const privateRole = user?.privateMetadata?.role as AppRole | undefined;
  return publicRole ?? privateRole;
}

async function fetchConvexUserByEmail(email: string) {
  try {
    // Use admin auth since this is server-side auth resolution (no user context yet)
    const convex = createConvexClient({ useAdminAuth: true });
    return await convex.query(api.clerkAuth.getUserByEmailAdmin, { email });
  } catch (error) {
    console.error("Failed to fetch Convex user by email", error);
    return null;
  }
}

async function resolveUserAndRole(clerkUserId: string, sessionClaims: Record<string, unknown> | null | undefined) {
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses?.[0]?.emailAddress;

  // Try role from claims -> Clerk metadata -> Convex user
  const role =
    roleFromSessionClaims(sessionClaims) ||
    roleFromClerkUser(clerkUser) ||
    undefined;

  const convexUser = email ? await fetchConvexUserByEmail(email) : null;
  const finalRole = (role || convexUser?.role) as AppRole | undefined;

  return {
    clerkUser,
    email,
    convexUser,
    role: finalRole,
  };
}

export async function auth(): Promise<AppSession | null> {
  const { userId, sessionClaims } = await clerkAuth();

  if (!userId) {
    return null;
  }

  const { email, convexUser, role } = await resolveUserAndRole(userId, sessionClaims as Record<string, unknown>);

  return {
    user: {
      id: convexUser?._id as Id<"users"> | undefined,
      clerkId: userId,
      role,
      email: email || undefined,
    },
  };
}

export async function requireAuth(): Promise<AppSession> {
  const session = await auth();

  if (!session || !session.user?.clerkId) {
    throw new Error("Unauthorized");
  }

  return session;
}

export async function requireAdmin(): Promise<AppSession & { user: SessionUser & { role: AppRole; id?: Id<"users"> } }> {
  const session = await requireAuth();
  let role = session.user.role;
  let convexUserId = session.user.id;

  // If role is missing, resolve via Clerk metadata or Convex user record
  if (!role) {
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(session.user.clerkId);
    role = roleFromClerkUser(clerkUser);

    if (!role) {
      const email = clerkUser.emailAddresses?.[0]?.emailAddress;
      const convexUser = email ? await fetchConvexUserByEmail(email) : null;
      role = convexUser?.role as AppRole | undefined;
      convexUserId = convexUser?._id as Id<"users"> | undefined;
    }
  }

  if (role !== "admin") {
    console.warn("[requireAdmin] non-admin access", {
      clerkId: session.user.clerkId,
      email: session.user.email,
      resolvedRole: role,
      convexUserId,
    });
    throw new Error("Admin access required");
  }

  // Ensure Clerk metadata carries the resolved role for future session claims
  await syncClerkRoleMetadata(session.user.clerkId, role);

  return {
    user: {
      ...session.user,
      id: convexUserId,
      role,
    },
  };
}

export async function syncClerkRoleMetadata(clerkUserId: string, role: AppRole): Promise<void> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(clerkUserId);
    const currentRole = roleFromClerkUser(user);

    if (currentRole !== role) {
      await client.users.updateUserMetadata(clerkUserId, {
        publicMetadata: {
          ...user.publicMetadata,
          role,
        },
      });
    }
  } catch (error) {
    console.error("Failed to sync Clerk role metadata", error);
  }
}
