"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useState } from "react";

/**
 * Automatically syncs Clerk user to Convex database
 * Place this component in the root layout
 */
export function ClerkConvexSync() {
  const { user, isSignedIn } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const syncUser = useMutation(api.clerkAuth.syncUser);
  const [hasSynced, setHasSynced] = useState(false);

  useEffect(() => {
    // Only sync when:
    // 1. User is signed in with Clerk
    // 2. Convex is authenticated
    // 3. Haven't synced yet this session
    if (isSignedIn && isAuthenticated && !hasSynced && user) {
      syncUser()
        .then(() => {
          setHasSynced(true);
          console.log("User synced to Convex successfully");
        })
        .catch((error) => {
          console.error("Failed to sync user to Convex:", error);
        });
    }
  }, [isSignedIn, isAuthenticated, user, syncUser, hasSynced]);

  return null; // This component doesn't render anything
}
