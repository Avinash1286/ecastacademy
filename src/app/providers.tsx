"use client";

import { ReactNode } from "react";
import { ClerkProvider, ClerkLoaded, ClerkLoading } from "@clerk/nextjs";
import { ConvexProvider } from "@/components/ConvexProvider";
import { ClerkConvexSync } from "@/components/ClerkConvexSync";
import { SoundProvider } from "@/context/SoundContext";
import { ThemeProvider } from "@/components/theme-provider";
import { OfflineIndicator } from "@/components/pwa/OfflineIndicator";
import { Toaster } from "@/components/ui/sonner";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";

// Centralized app providers wrapped in ClerkLoaded to ensure auth context
// is ready before any Convex/Clerk-dependent hooks run.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <ClerkLoading>
        {/* Keep markup minimal during Clerk bootstrap to avoid hydration churn */}
        <div />
      </ClerkLoading>
      <ClerkLoaded>
        <ConvexProvider>
          <ClerkConvexSync />
          <SoundProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="dark"
              enableSystem
              disableTransitionOnChange
            >
              <OfflineIndicator />
              {children}
              <Toaster />
              <InstallPrompt />
            </ThemeProvider>
          </SoundProvider>
        </ConvexProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
