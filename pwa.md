# Progressive Web App (PWA) Implementation Guide for ECAST Academy

## Executive Summary

This document provides a comprehensive guide to transform ECAST Academy (a Next.js 15 application) into a Progressive Web App (PWA) that supports installation on mobile devices, offline functionality, and native app-like experiences.

---

## Table of Contents

1. [Current Application Analysis](#1-current-application-analysis)
2. [PWA Requirements](#2-pwa-requirements)
3. [Implementation Steps](#3-implementation-steps)
4. [Configuration Files](#4-configuration-files)
5. [Testing & Deployment](#5-testing--deployment)
6. [Best Practices](#6-best-practices)

---

## 1. Current Application Analysis

### Tech Stack
| Component | Technology |
|-----------|------------|
| Framework | Next.js 15.3.4 with Turbopack |
| Frontend | React 19 |
| Backend | Convex (BaaS) |
| Authentication | NextAuth.js v5 |
| Styling | Tailwind CSS v4 |
| UI Components | Radix UI, shadcn/ui |
| State Management | React Context |
| Animations | Framer Motion |

### Current PWA Status
- ❌ No Web App Manifest (`manifest.json`)
- ❌ No Service Worker
- ❌ No offline support
- ❌ No app icons for installation
- ❌ No PWA metadata in layout

### Application Features to Support Offline
- Course browsing and content viewing
- Capsule learning content
- Quiz functionality
- Certificate viewing
- Dashboard access

---

## 2. PWA Requirements

### Core Requirements
1. **Web App Manifest** - Defines app metadata for installation
2. **Service Worker** - Enables offline functionality and caching
3. **HTTPS** - Required for service worker (handled by Vercel)
4. **Responsive Design** - ✅ Already implemented
5. **App Icons** - Multiple sizes for different devices

### PWA Criteria Checklist
| Criteria | Status | Action Needed |
|----------|--------|---------------|
| Valid manifest.json | ❌ | Create manifest |
| Service Worker registered | ❌ | Implement SW |
| Icons (192px, 512px min) | ❌ | Create icons |
| Start URL defined | ❌ | Add to manifest |
| Display mode standalone | ❌ | Add to manifest |
| Theme color | ❌ | Add meta tags |
| Viewport meta tag | ✅ | Already present |
| HTTPS | ✅ | Vercel provides |

---

## 3. Implementation Steps

### Step 1: Install next-pwa Package

```bash
npm install next-pwa
```

### Step 2: Create Web App Manifest

Create file: `public/manifest.json`

```json
{
  "name": "ECAST Academy",
  "short_name": "ECAST",
  "description": "AI-Powered Learning Platform - Learn smarter with personalized courses and capsules",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0b",
  "theme_color": "#7c3aed",
  "orientation": "portrait-primary",
  "scope": "/",
  "lang": "en",
  "categories": ["education", "productivity"],
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable any"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/desktop-home.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide",
      "label": "ECAST Academy Dashboard"
    },
    {
      "src": "/screenshots/mobile-home.png",
      "sizes": "750x1334",
      "type": "image/png",
      "form_factor": "narrow",
      "label": "ECAST Academy Mobile View"
    }
  ],
  "shortcuts": [
    {
      "name": "Dashboard",
      "short_name": "Dashboard",
      "description": "Go to your learning dashboard",
      "url": "/dashboard",
      "icons": [{ "src": "/icons/dashboard-shortcut.png", "sizes": "96x96" }]
    },
    {
      "name": "My Courses",
      "short_name": "Courses",
      "description": "View your enrolled courses",
      "url": "/dashboard/courses",
      "icons": [{ "src": "/icons/courses-shortcut.png", "sizes": "96x96" }]
    }
  ],
  "related_applications": [],
  "prefer_related_applications": false
}
```

### Step 3: Update Next.js Configuration

Update `next.config.ts`:

```typescript
import type { NextConfig } from "next";
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
  /* existing config options */
  
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        port: '',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        port: '',
        pathname: '**',
      },
    ],
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV === 'production' ? '' : '*'),
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-CSRF-Token',
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400',
          },
        ],
      },
    ];
  },
  
  poweredByHeader: false,
};

const withPWAConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts-webfonts',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
        },
      },
    },
    {
      urlPattern: /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'google-fonts-stylesheets',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 1 week
        },
      },
    },
    {
      urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-font-assets',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 7 * 24 * 60 * 60,
        },
      },
    },
    {
      urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-image-assets',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      urlPattern: /\/_next\/image\?url=.+$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-image',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60,
        },
      },
    },
    {
      urlPattern: /\.(?:mp3|wav|ogg)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-audio-assets',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60,
        },
      },
    },
    {
      urlPattern: /\.(?:js)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-js-assets',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60,
        },
      },
    },
    {
      urlPattern: /\.(?:css|less)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-style-assets',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60,
        },
      },
    },
    {
      urlPattern: /\/_next\/data\/.+\/.+\.json$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-data',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60,
        },
      },
    },
    {
      urlPattern: /\.(?:json|xml|csv)$/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'static-data-assets',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60,
        },
      },
    },
    {
      urlPattern: ({ url }) => {
        const isSameOrigin = self.origin === url.origin;
        if (!isSameOrigin) return false;
        const pathname = url.pathname;
        // Exclude API routes from caching
        if (pathname.startsWith('/api/')) return false;
        return true;
      },
      handler: 'NetworkFirst',
      options: {
        cacheName: 'others',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60,
        },
        networkTimeoutSeconds: 10,
      },
    },
    {
      urlPattern: ({ url }) => {
        const isSameOrigin = self.origin === url.origin;
        return !isSameOrigin;
      },
      handler: 'NetworkFirst',
      options: {
        cacheName: 'cross-origin',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 60 * 60, // 1 hour
        },
        networkTimeoutSeconds: 10,
      },
    },
  ],
});

export default withPWAConfig(nextConfig);
```

### Step 4: Update Root Layout with PWA Metadata

Update `src/app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Nunito } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { ConvexProvider } from "@/components/ConvexProvider";
import { SessionProvider } from "next-auth/react";
import { SoundProvider } from "@/context/SoundContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#7c3aed" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "ECAST Academy",
  description: "AI-Powered Learning Platform - Learn smarter with personalized courses and capsules",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ECAST Academy",
    startupImage: [
      {
        url: "/splash/apple-splash-2048-2732.png",
        media: "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)",
      },
      {
        url: "/splash/apple-splash-1668-2388.png",
        media: "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)",
      },
      {
        url: "/splash/apple-splash-1536-2048.png",
        media: "(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)",
      },
      {
        url: "/splash/apple-splash-1125-2436.png",
        media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/splash/apple-splash-1242-2688.png",
        media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/splash/apple-splash-750-1334.png",
        media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)",
      },
      {
        url: "/splash/apple-splash-640-1136.png",
        media: "(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)",
      },
    ],
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "ECAST Academy",
    title: "ECAST Academy - AI-Powered Learning Platform",
    description: "Learn smarter with personalized courses and capsules powered by AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "ECAST Academy",
    description: "AI-Powered Learning Platform",
  },
  keywords: ["learning", "education", "AI", "courses", "online learning", "ECAST"],
  authors: [{ name: "ECAST Academy" }],
  creator: "ECAST Academy",
  publisher: "ECAST Academy",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* PWA Meta Tags */}
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="ECAST Academy" />
        <meta name="application-name" content="ECAST Academy" />
        <meta name="msapplication-TileColor" content="#7c3aed" />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${nunito.variable} antialiased`}
      >
        <SessionProvider>
          <ConvexProvider>
            <SoundProvider>
              <ThemeProvider
                attribute="class"
                defaultTheme="dark"
                enableSystem
                disableTransitionOnChange
              >
                {children}
                <Toaster />
              </ThemeProvider>
            </SoundProvider>
          </ConvexProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
```

### Step 5: Create App Icons

Create the following directory structure:
```
public/
├── icons/
│   ├── icon-72x72.png
│   ├── icon-96x96.png
│   ├── icon-128x128.png
│   ├── icon-144x144.png
│   ├── icon-152x152.png
│   ├── icon-192x192.png
│   ├── icon-384x384.png
│   ├── icon-512x512.png
│   ├── dashboard-shortcut.png (96x96)
│   └── courses-shortcut.png (96x96)
├── splash/
│   ├── apple-splash-640-1136.png
│   ├── apple-splash-750-1334.png
│   ├── apple-splash-1125-2436.png
│   ├── apple-splash-1242-2688.png
│   ├── apple-splash-1536-2048.png
│   ├── apple-splash-1668-2388.png
│   └── apple-splash-2048-2732.png
└── screenshots/
    ├── desktop-home.png (1280x720)
    └── mobile-home.png (750x1334)
```

**Icon Generation Tools:**
- [Real Favicon Generator](https://realfavicongenerator.net/)
- [PWA Asset Generator](https://github.com/nicholascelestin/pwa-asset-generator)
- [Maskable.app](https://maskable.app/editor) - For creating maskable icons

### Step 6: Create Offline Fallback Page

Create `src/app/offline/page.tsx`:

```tsx
"use client";

import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 p-8">
        <div className="flex justify-center">
          <div className="rounded-full bg-muted p-6">
            <WifiOff className="h-16 w-16 text-muted-foreground" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            You're Offline
          </h1>
          <p className="text-muted-foreground max-w-md">
            It looks like you've lost your internet connection. 
            Some features may not be available until you're back online.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button onClick={handleRetry} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
          <Button variant="outline" onClick={() => window.history.back()}>
            Go Back
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Cached content may still be available
        </p>
      </div>
    </div>
  );
}
```

### Step 7: Create PWA Install Prompt Component

Create `src/components/pwa/InstallPrompt.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Check if user dismissed previously
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      const threeDays = 3 * 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedTime < threeDays) {
        return;
      }
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Listen for successful install
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
  };

  if (isInstalled || !showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50"
      >
        <div className="bg-card border rounded-lg shadow-lg p-4">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 p-2 bg-primary/10 rounded-lg">
              <Download className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Install ECAST Academy</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Install our app for a better experience with offline access.
              </p>
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={handleInstall}>
                  Install
                </Button>
                <Button size="sm" variant="ghost" onClick={handleDismiss}>
                  Not now
                </Button>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
```

### Step 8: Create useOnlineStatus Hook

Create `src/hooks/useOnlineStatus.ts`:

```typescript
"use client";

import { useState, useEffect } from "react";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Set initial status
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
```

### Step 9: Create Offline Indicator Component

Create `src/components/pwa/OfflineIndicator.tsx`:

```tsx
"use client";

import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-yellow-950 py-2 px-4 text-center text-sm font-medium flex items-center justify-center gap-2"
        >
          <WifiOff className="h-4 w-4" />
          You're offline. Some features may be limited.
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

### Step 10: Update Layout to Include PWA Components

Add to `src/app/layout.tsx` (inside the body):

```tsx
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { OfflineIndicator } from "@/components/pwa/OfflineIndicator";

// Inside the body, after ThemeProvider children:
<OfflineIndicator />
<InstallPrompt />
```

---

## 4. Configuration Files

### Package.json - Add PWA Scripts

```json
{
  "scripts": {
    "dev": "npm-run-all --parallel dev:*",
    "dev:next": "next dev --turbopack",
    "dev:convex": "convex dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "pwa:generate-icons": "pwa-asset-generator ./public/icons/icon-512x512.png ./public/icons -i ./src/app/layout.tsx -m ./public/manifest.json"
  }
}
```

### .gitignore Additions

```
# PWA generated files
public/sw.js
public/sw.js.map
public/workbox-*.js
public/workbox-*.js.map
```

### TypeScript Declaration for PWA

Create `src/types/pwa.d.ts`:

```typescript
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
    appinstalled: Event;
  }
}

export {};
```

---

## 5. Testing & Deployment

### Testing Checklist

1. **Lighthouse PWA Audit**
   - Open Chrome DevTools → Lighthouse
   - Run PWA audit
   - Aim for 100% PWA score

2. **Manual Testing**
   - [ ] Manifest loads correctly
   - [ ] Service worker registers
   - [ ] App is installable
   - [ ] Offline page works
   - [ ] Cache works correctly
   - [ ] Icons display properly

3. **Mobile Testing**
   - [ ] iOS Safari - Add to Home Screen
   - [ ] Android Chrome - Install App
   - [ ] Splash screens display
   - [ ] Standalone mode works

### Testing Commands

```bash
# Build and test locally
npm run build
npm run start

# Check manifest
curl http://localhost:3000/manifest.json

# Check service worker
# Visit chrome://serviceworker-internals/
```

### Deployment Notes

1. **Vercel Deployment**
   - PWA works out of the box with Vercel
   - HTTPS is automatically provided
   - Service worker is served correctly

2. **Headers to Add (if needed)**
   ```
   /sw.js
   Cache-Control: public, max-age=0, must-revalidate
   
   /manifest.json
   Cache-Control: public, max-age=0, must-revalidate
   Content-Type: application/manifest+json
   ```

---

## 6. Best Practices

### Performance Optimization

1. **Preload Critical Assets**
   ```tsx
   <link rel="preload" href="/fonts/nunito.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
   ```

2. **Lazy Load Non-Critical Components**
   ```tsx
   const InstallPrompt = dynamic(() => import("@/components/pwa/InstallPrompt"), {
     ssr: false,
   });
   ```

3. **Optimize Images for PWA**
   - Use WebP format
   - Implement proper srcset
   - Use Next.js Image component

### Security Considerations

1. **Service Worker Scope**
   - Limit service worker scope to necessary paths
   - Don't cache sensitive API responses

2. **Content Security Policy**
   - Update CSP for service worker
   - Allow service worker source

### User Experience

1. **Update Notifications**
   ```tsx
   // Notify users when new version is available
   if ('serviceWorker' in navigator) {
     navigator.serviceWorker.addEventListener('controllerchange', () => {
       // Show update notification
     });
   }
   ```

2. **Graceful Degradation**
   - App works without service worker
   - Clear offline messaging
   - Data sync when back online

### Maintenance

1. **Cache Versioning**
   - Update cache version on deployments
   - Clear old caches automatically

2. **Analytics**
   - Track PWA installations
   - Monitor offline usage
   - Track update adoption

---

## Summary

Implementing PWA for ECAST Academy involves:

| Step | Task | Priority |
|------|------|----------|
| 1 | Install next-pwa package | High |
| 2 | Create manifest.json | High |
| 3 | Update next.config.ts | High |
| 4 | Update layout.tsx with metadata | High |
| 5 | Generate app icons | High |
| 6 | Create offline page | Medium |
| 7 | Add install prompt | Medium |
| 8 | Add online status hook | Medium |
| 9 | Add offline indicator | Low |
| 10 | Testing & optimization | High |

### Estimated Implementation Time
- Basic PWA setup: 2-3 hours
- Icon generation: 30 minutes
- Testing & refinement: 1-2 hours
- **Total: 4-6 hours**

### Expected Benefits
- ✅ Installable on mobile devices
- ✅ Offline content access
- ✅ Faster load times (cached assets)
- ✅ Native app-like experience
- ✅ Push notification ready (future)
- ✅ Improved engagement metrics

---

*Document created: November 30, 2025*
*ECAST Academy - AI-Powered Learning Platform*
