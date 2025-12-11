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

async function fetchConvexUserByEmail(email: string, userToken: string | null) {
  if (!userToken) {
    // Can't look up user without auth token
    return null;
  }
  try {
    // Use user's own token to authenticate - getOwnUserByEmail validates caller email matches
    const convex = createConvexClient({ userToken });
    return await convex.query(api.clerkAuth.getOwnUserByEmail, { email });
  } catch (error) {
    console.error("Failed to fetch Convex user by email", error);
    return null;
  }
}

async function resolveUserAndRole(clerkUserId: string, sessionClaims: Record<string, unknown> | null | undefined, userToken: string | null) {
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses?.[0]?.emailAddress;

  // Try role from claims -> Clerk metadata -> Convex user
  const role =
    roleFromSessionClaims(sessionClaims) ||
    roleFromClerkUser(clerkUser) ||
    undefined;

  const convexUser = email ? await fetchConvexUserByEmail(email, userToken) : null;
  const finalRole = (role || convexUser?.role) as AppRole | undefined;

  return {
    clerkUser,
    email,
    convexUser,
    role: finalRole,
  };
}

export async function auth(): Promise<AppSession | null> {
  const clerkAuthResult = await clerkAuth();
  const { userId, sessionClaims } = clerkAuthResult;

  if (!userId) {
    return null;
  }

  // Get user token for authenticated Convex queries
  const userToken = await clerkAuthResult.getToken({ template: "convex" });

  const { email, convexUser, role } = await resolveUserAndRole(userId, sessionClaims as Record<string, unknown>, userToken);

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

  // If role or convexUserId is missing, resolve via Clerk metadata or Convex user record
  if (!role || !convexUserId) {
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(session.user.clerkId);
    
    // Get role from Clerk metadata if not already set
    if (!role) {
      role = roleFromClerkUser(clerkUser);
    }

    // If we still need role or convexUserId, fetch from Convex
    if (!role || !convexUserId) {
      const email = clerkUser.emailAddresses?.[0]?.emailAddress;
      // Get user token for authenticated Convex query
      const clerkAuthResult = await clerkAuth();
      const userToken = await clerkAuthResult.getToken({ template: "convex" });
      const convexUser = email ? await fetchConvexUserByEmail(email, userToken) : null;
      
      if (!role) {
        role = convexUser?.role as AppRole | undefined;
      }
      if (!convexUserId) {
        convexUserId = convexUser?._id as Id<"users"> | undefined;
      }
    }
  }

  if (role !== "admin") {
    console.warn("[requireAdmin] non-admin access", {
      hasClerkId: !!session.user.clerkId,
      hasEmail: !!session.user.email,
      resolvedRole: role,
      hasConvexUserId: !!convexUserId,
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
