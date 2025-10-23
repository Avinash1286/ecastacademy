"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { Github, Loader2, LogIn, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const redirectFallback = "/dashboard";

type AuthMode = "signIn" | "signUp";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useAuthActions();
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [providerLoading, setProviderLoading] = useState<string | null>(null);

  const redirectTo = searchParams.get("redirectTo") ?? redirectFallback;

  const handleEmailPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email || !password) {
      toast.error("Email and password are required");
      return;
    }

    if (mode === "signUp" && !name.trim()) {
      toast.error("Please provide your name to create an account");
      return;
    }

    setSubmitting(true);
    try {
      const params: Record<string, string> = {
        flow: mode,
        email,
        password,
        redirectTo,
      };

      if (mode === "signUp") {
        params.name = name.trim();
      }

      const result = await signIn("password", params);

      if (result.redirect) {
        window.location.href = result.redirect.toString();
        return;
      }

      if (result.signingIn) {
        toast.success(mode === "signUp" ? "Account created" : "Signed in successfully");
        router.replace(redirectTo);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to sign in with email and password";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOAuth = async (provider: "google" | "github") => {
    setProviderLoading(provider);
    try {
      const result = await signIn(provider, { redirectTo });
      if (result.redirect) {
        window.location.href = result.redirect.toString();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : `Unable to sign in with ${provider}`;
      toast.error(message);
    } finally {
      setProviderLoading(null);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <LogIn className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-semibold tracking-tight">
            {mode === "signIn" ? "Welcome back" : "Create your account"}
          </CardTitle>
          <CardDescription>
            {mode === "signIn"
              ? "Access your personalised learning dashboard"
              : "Start your learning journey with ECAST Academy"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form className="space-y-4" onSubmit={handleEmailPassword}>
            {mode === "signUp" && (
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ada Lovelace"
                  disabled={submitting}
                  autoComplete="name"
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                disabled={submitting}
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                disabled={submitting}
                autoComplete={mode === "signUp" ? "new-password" : "current-password"}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "signIn" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <div className="grid gap-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => handleOAuth("google")}
              disabled={providerLoading !== null}
            >
              {providerLoading === "google" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              Continue with Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => handleOAuth("github")}
              disabled={providerLoading !== null}
            >
              {providerLoading === "github" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Github className="mr-2 h-4 w-4" />
              )}
              Continue with GitHub
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            {mode === "signIn" ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  className="text-primary underline-offset-4 transition hover:underline"
                  onClick={() => setMode("signUp")}
                >
                  Create one
                </button>
              </>
            ) : (
              <>
                Already registered?{" "}
                <button
                  type="button"
                  className="text-primary underline-offset-4 transition hover:underline"
                  onClick={() => setMode("signIn")}
                >
                  Sign in instead
                </button>
              </>
            )}
          </p>

          <p className="text-center text-xs text-muted-foreground">
            By continuing you agree to our{" "}
            <Link href="/legal/privacy" className="underline hover:text-foreground">
              privacy policy
            </Link>
            {" "}and{" "}
            <Link href="/legal/terms" className="underline hover:text-foreground">
              terms of use
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}