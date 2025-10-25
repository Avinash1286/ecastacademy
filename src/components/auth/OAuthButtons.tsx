"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { FaGoogle, FaGithub } from "react-icons/fa";

export function OAuthButtons() {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isGithubLoading, setIsGithubLoading] = useState(false);

  const handleOAuthSignIn = async (provider: "google" | "github") => {
    if (provider === "google") {
      setIsGoogleLoading(true);
    } else {
      setIsGithubLoading(true);
    }

    try {
      await signIn(provider, { callbackUrl: "/dashboard" });
    } catch (error) {
      console.error(`${provider} sign in error:`, error);
    } finally {
      if (provider === "google") {
        setIsGoogleLoading(false);
      } else {
        setIsGithubLoading(false);
      }
    }
  };

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => handleOAuthSignIn("google")}
        disabled={isGoogleLoading || isGithubLoading}
      >
        {isGoogleLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FaGoogle className="mr-2 h-4 w-4" />
        )}
        Continue with Google
      </Button>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => handleOAuthSignIn("github")}
        disabled={isGoogleLoading || isGithubLoading}
      >
        {isGithubLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FaGithub className="mr-2 h-4 w-4" />
        )}
        Continue with GitHub
      </Button>
    </div>
  );
}

