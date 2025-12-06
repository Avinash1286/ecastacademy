"use client";

import { WifiOff, RefreshCw, Home, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export default function OfflinePage() {
  const [cachedPages, setCachedPages] = useState<string[]>([]);

  useEffect(() => {
    // Try to get cached pages from the service worker cache
    const getCachedPages = async () => {
      if ('caches' in window) {
        try {
          const cache = await caches.open('pages');
          const keys = await cache.keys();
          const urls = keys.map(req => new URL(req.url).pathname);
          setCachedPages(urls.filter(url => url !== '/offline'));
        } catch {
          // Cache API not available or error
        }
      }
    };
    getCachedPages();
  }, []);

  const handleRetry = () => {
    window.location.reload();
  };

  const navigateTo = (path: string) => {
    window.location.href = path;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 p-8 max-w-md">
        <div className="flex justify-center">
          <div className="rounded-full bg-muted p-6">
            <WifiOff className="h-16 w-16 text-muted-foreground" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            You&apos;re Offline
          </h1>
          <p className="text-muted-foreground">
            It looks like you&apos;ve lost your internet connection. 
            ECAST Academy requires an internet connection to load course data.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={handleRetry} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
          <Button variant="outline" onClick={() => window.history.back()}>
            Go Back
          </Button>
        </div>

        {cachedPages.length > 0 && (
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-3">
              Previously visited pages may still work:
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {cachedPages.includes('/') && (
                <Button variant="ghost" size="sm" onClick={() => navigateTo('/')} className="gap-1">
                  <Home className="h-3 w-3" />
                  Home
                </Button>
              )}
              {cachedPages.includes('/dashboard') && (
                <Button variant="ghost" size="sm" onClick={() => navigateTo('/dashboard')} className="gap-1">
                  <BookOpen className="h-3 w-3" />
                  Dashboard
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="pt-4">
          <p className="text-xs text-muted-foreground">
            💡 Tip: Course content and progress sync automatically when you&apos;re back online.
          </p>
        </div>
      </div>
    </div>
  );
}
