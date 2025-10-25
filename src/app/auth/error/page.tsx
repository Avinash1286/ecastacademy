"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const errorMessages: Record<string, { title: string; description: string }> = {
  Configuration: {
    title: "Configuration Error",
    description:
      "There is a problem with the server configuration. Please contact support.",
  },
  AccessDenied: {
    title: "Access Denied",
    description: "You do not have permission to sign in.",
  },
  Verification: {
    title: "Verification Error",
    description:
      "The verification link is invalid or has expired. Please try again.",
  },
  OAuthSignin: {
    title: "OAuth Sign In Error",
    description: "Error occurred during OAuth sign in. Please try again.",
  },
  OAuthCallback: {
    title: "OAuth Callback Error",
    description: "Error occurred during OAuth callback. Please try again.",
  },
  OAuthCreateAccount: {
    title: "OAuth Account Creation Error",
    description: "Could not create OAuth account. Please try again.",
  },
  EmailCreateAccount: {
    title: "Email Account Creation Error",
    description: "Could not create email account. Please try again.",
  },
  Callback: {
    title: "Callback Error",
    description: "Error occurred during callback. Please try again.",
  },
  OAuthAccountNotLinked: {
    title: "Account Not Linked",
    description:
      "To confirm your identity, sign in with the same account you used originally.",
  },
  EmailSignin: {
    title: "Email Sign In Error",
    description: "The sign in link is invalid or has expired.",
  },
  CredentialsSignin: {
    title: "Sign In Error",
    description: "Invalid email or password. Please try again.",
  },
  SessionRequired: {
    title: "Session Required",
    description: "Please sign in to access this page.",
  },
  Default: {
    title: "Authentication Error",
    description: "An error occurred during authentication. Please try again.",
  },
};

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams?.get("error") || "Default";

  const errorInfo = errorMessages[error] || errorMessages.Default;

  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{errorInfo.title}</AlertTitle>
      <AlertDescription>{errorInfo.description}</AlertDescription>
    </Alert>
  );
}

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border rounded-lg shadow-lg p-8">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              ECAST Academy
            </h1>
            <p className="text-muted-foreground mt-2">Authentication Error</p>
          </div>

          {/* Error Alert */}
          <Suspense fallback={<div>Loading...</div>}>
            <ErrorContent />
          </Suspense>

          {/* Action Buttons */}
          <div className="mt-6 space-y-3">
            <Button asChild className="w-full">
              <Link href="/auth/signin">Try Again</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/">Go to Home</Link>
            </Button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          © {new Date().getFullYear()} ECAST Academy. All rights reserved.
        </p>
      </div>
    </div>
  );
}

