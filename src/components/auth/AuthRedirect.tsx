"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Client component that handles authenticated user redirect.
 * Non-blocking: Shows landing page content immediately while checking auth.
 * Only shows loading overlay when redirect is confirmed.
 */
export function AuthRedirect() {
  const { status } = useAuth();
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      setIsRedirecting(true);
      router.push('/dashboard');
    }
  }, [status, router]);

  // Only show loading overlay when we're actually redirecting
  // This is non-blocking - users see the landing page while auth loads
  if (isRedirecting) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  // Non-blocking: render nothing while loading or unauthenticated
  // Landing page content shows immediately
  return null;
}
