import { clerkMiddleware, createRouteMatcher, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from "next/server";

/**
 * Clerk Middleware with Security Features
 * 
 * Includes:
 * - Request ID for tracing
 * - CSRF protection for state-changing requests
 * - Request body size limits
 * - Security headers
 * - Real-time admin role verification (not cached)
 */

// Request ID header name
const REQUEST_ID_HEADER = "X-Request-ID";

// CSRF Configuration
const CSRF_COOKIE_NAME = "csrf-token";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_EXEMPT_PATHS = [
  "/api/webhooks",           // External webhooks
  "/api/health",             // Health checks
];

// Protected routes requiring authentication
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/learnspace(.*)',
  '/admin(.*)',
]);

// Admin-only routes
const isAdminRoute = createRouteMatcher(['/admin(.*)']);

// Routes requiring CSRF protection (state-changing API routes)
// Note: /api/ai routes are protected by admin auth check in the route handlers
const CSRF_PROTECTED_PATHS = [
  "/api/course", 
  "/api/capsule", 
  "/api/videos", 
  // Certificates download is session-protected; exclude from CSRF to allow client POST download
  // "/api/certificates",   // removed to avoid CSRF errors on generate-pdf
];

// Body size limits (in bytes)
const SIZE_LIMITS: Record<string, number> = {
  "/api/ai": 512 * 1024, // 512KB for AI endpoints
  "/api/capsule/upload-pdf": 15 * 1024 * 1024, // 15MB for PDFs
  "/api/videos": 1 * 1024 * 1024, // 1MB
  "/api": 1 * 1024 * 1024, // 1MB default for API
};

/**
 * Generate a cryptographically secure CSRF token
 */
function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate a unique request ID for tracing
 */
function generateRequestId(): string {
  // Use crypto.randomUUID if available (most modern environments)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: timestamp + random string
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Get size limit for a route
 */
function getSizeLimit(pathname: string): number {
  for (const [route, limit] of Object.entries(SIZE_LIMITS)) {
    if (pathname.startsWith(route)) {
      return limit;
    }
  }
  return SIZE_LIMITS["/api"];
}

/**
 * Build Content Security Policy header
 * Configured for Next.js app with YouTube embeds, Convex, and AI services
 */
function buildCSP(): string {
  const directives = [
    // Default fallback - restrict to same origin
    "default-src 'self'",
    
    // Scripts - allow YouTube + Clerk loader + Cloudflare Turnstile (CAPTCHA); keep inline/eval in dev
    process.env.NODE_ENV === "production"
      ? "script-src 'self' 'unsafe-inline' https://www.youtube.com https://www.youtube-nocookie.com https://s.ytimg.com https://*.clerk.com https://*.clerk.accounts.dev https://clerk.ecastacademy.tech https://challenges.cloudflare.com"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://www.youtube-nocookie.com https://s.ytimg.com https://*.clerk.com https://*.clerk.accounts.dev https://clerk.ecastacademy.tech https://challenges.cloudflare.com",
    
    // Styles - self and inline (needed for styled components/CSS-in-JS)
    "style-src 'self' 'unsafe-inline'",
    
    // Images - self, data URIs, YouTube thumbnails, Convex storage, Clerk assets
    "img-src 'self' data: blob: https://i.ytimg.com https://*.convex.cloud https://lh3.googleusercontent.com https://avatars.githubusercontent.com https://*.clerk.com https://*.clerk.accounts.dev https://clerk.ecastacademy.tech https://img.clerk.com",
    
    // Fonts - self only
    "font-src 'self' data:",
    
    // Connect - API calls to self, Convex, AI services, Clerk, and Cloudflare
      "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://generativelanguage.googleapis.com https://api.openai.com https://www.youtube.com https://www.youtube-nocookie.com https://*.googlevideo.com https://*.clerk.com https://*.clerk.accounts.dev https://clerk.ecastacademy.tech https://challenges.cloudflare.com",
    
    // Media - self and YouTube (regular + nocookie)
        "media-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://*.googlevideo.com",
    
    // Frames - YouTube embeds, Clerk, and Cloudflare Turnstile (CAPTCHA)
    "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://*.clerk.com https://*.clerk.accounts.dev https://clerk.ecastacademy.tech https://challenges.cloudflare.com",
    
    // Form actions - self only
    "form-action 'self'",
    
    // Base URI - self only
    "base-uri 'self'",
    
    // Frame ancestors - none (prevent embedding)
    "frame-ancestors 'none'",
    
    // Object/embed - none
    "object-src 'none'",
    
    // Upgrade insecure requests in production
    ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
  ];
  
  return directives.join("; ");
}

/**
 * Add security headers to response
 */
function addSecurityHeaders(response: NextResponse): void {
  // Content Security Policy
  response.headers.set("Content-Security-Policy", buildCSP());
  
  // Prevent clickjacking (also covered by CSP frame-ancestors)
  response.headers.set("X-Frame-Options", "DENY");
  
  // Prevent MIME type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");
  
  // XSS protection (legacy, but still useful)
  response.headers.set("X-XSS-Protection", "1; mode=block");
  
  // Referrer policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Permissions policy (restrict browser features)
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );
  
  // Strict Transport Security (HTTPS only in production)
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }
}

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;
  const method = request.method;
  
  // Generate or use existing request ID for tracing
  const requestId = request.headers.get(REQUEST_ID_HEADER) || generateRequestId();

  // 1. Check body size for API routes with bodies
  if (
    pathname.startsWith("/api/") &&
    !["GET", "HEAD", "OPTIONS"].includes(method)
  ) {
    const contentLength = request.headers.get("content-length");
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      const limit = getSizeLimit(pathname);
      
      if (size > limit) {
        return NextResponse.json(
          {
            error: "Payload too large",
            message: `Request body exceeds the ${(limit / 1024 / 1024).toFixed(1)}MB limit`,
          },
          { status: 413 }
        );
      }
    }
  }

  // 2. CSRF Protection for state-changing API requests
  const requiresCsrf =
    !["GET", "HEAD", "OPTIONS"].includes(method) &&
    CSRF_PROTECTED_PATHS.some((path) => pathname.startsWith(path)) &&
    !CSRF_EXEMPT_PATHS.some((path) => pathname === path || pathname.startsWith(path + "/"));

  if (requiresCsrf) {
    const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
    const headerToken = request.headers.get(CSRF_HEADER_NAME);

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      return NextResponse.json(
        {
          error: "Invalid CSRF token",
          message: "Request rejected due to invalid or missing CSRF token",
        },
        { status: 403 }
      );
    }
  }

  // 3. Check if route requires authentication
  if (isProtectedRoute(request)) {
    const { userId } = await auth();
    
    if (!userId) {
      // No valid session - Clerk will handle redirect
      await auth.protect();
      return;
    }

    // 4. Admin check for admin paths
    if (isAdminRoute(request)) {
      // Fetch fresh user data from Clerk API to get real-time role
      // This ensures demoted users are immediately blocked, not relying on cached session claims
      try {
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(userId);
        
        // Check role from Clerk's publicMetadata (source of truth)
        const role = clerkUser.publicMetadata?.role as string | undefined;
        
        // Require explicit admin role - redirect if missing or non-admin
        if (role !== "admin") {
          return NextResponse.redirect(new URL("/dashboard", request.url));
        }
      } catch (error) {
        // Distinguish between operational errors and legitimate access denials
        if (error && typeof error === "object" && "status" in error) {
          // Clerk API error with status code
          const status = (error as { status: number }).status;
          if (status === 404) {
            // User not found: treat as access denial
            console.warn(`Admin check failed: user ${userId} not found.`);
          } else {
            // Operational error (e.g., network, Clerk API down)
            console.error(`Operational error during admin verification for user ${userId}:`, error);
          }
        } else {
          // Unknown error type
          console.error(`Unknown error during admin verification for user ${userId}:`, error);
        }
        // If we can't verify admin status, deny access to be safe
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
  }

  // 5. Create response and add security headers
  const response = NextResponse.next();
  addSecurityHeaders(response);
  
  // Add request ID header for tracing
  response.headers.set(REQUEST_ID_HEADER, requestId);

  // 6. Set/refresh CSRF cookie for authenticated users on page loads
  if (!pathname.startsWith("/api/") && isProtectedRoute(request)) {
    const existingToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
    const csrfToken = existingToken || generateCsrfToken();
    
    response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
      httpOnly: false, // Must be readable by JavaScript
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });
  }

  return response;
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};

