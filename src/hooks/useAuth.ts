import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * Unified auth hook that replaces NextAuth's useSession
 * This provides a consistent interface across the application
 * 
 * Returns the Convex user ID (not Clerk ID) for database operations
 */
export function useAuth() {
  const clerk = useUser();
  const convex = useConvexAuth();
  
  // Track if we've ever been authenticated to avoid flashing sign-in during navigation
  const wasAuthenticated = useRef(false);

  const isSignedIn = clerk.isSignedIn;
  const isAuthenticated = convex?.isAuthenticated;
  
  // Once authenticated, remember it to avoid false negatives during navigation
  if (isSignedIn && isAuthenticated) {
    wasAuthenticated.current = true;
  }

  // Get the Convex user that matches this Clerk user
  // Only query if both Clerk and Convex are authenticated
  const convexUser = useQuery(
    api.clerkAuth.getCurrentUser,
    isSignedIn && isAuthenticated ? {} : "skip"
  );

  // Map Clerk user to session-like format for compatibility
  // Use Convex user ID if available, otherwise return null
  const session = isSignedIn && isAuthenticated && clerk.user && convexUser ? {
    user: {
      id: convexUser._id, // Use Convex ID for database operations
      email: convexUser.email,
      name: convexUser.name || clerk.user.fullName || clerk.user.firstName || "",
      image: convexUser.image || clerk.user.imageUrl || "",
      role: convexUser.role,
    }
  } : null;

  // Map loading state to status
  // Consider loading if:
  // 1. Clerk hasn't loaded yet
  // 2. User is signed in with Clerk but Convex user hasn't loaded
  // 3. User was previously authenticated but Convex is temporarily disconnected (navigation)
  const isLoading = !clerk.isLoaded || 
    (isSignedIn && !convexUser) ||
    (wasAuthenticated.current && isSignedIn && !isAuthenticated);
  
  const status = isLoading
    ? "loading"
    : isSignedIn && convexUser
      ? "authenticated"
      : "unauthenticated";

  // Surface context issues once to aid debugging without crashing the UI
  useEffect(() => {
    // If either provider is missing, the hooks would throw before here.
    // This effect remains for potential future diagnostics.
  }, []);

  return {
    data: session,
    status,
    // Also expose isAuthenticated for backwards compatibility, but use the improved logic
    isAuthenticated: status === "authenticated" || (wasAuthenticated.current && isSignedIn && status === "loading"),
    update: async () => {
      // Clerk handles session updates automatically
      // This is here for compatibility with NextAuth's API
    }
  };
}
