import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Enhanced Middleware with Security Features
 * 
 * Includes:
 * - Request ID for tracing
 * - Session validation (not just cookie presence)
 * - CSRF protection for state-changing requests
 * - Request body size limits
 * - Security headers
 */

// Request ID header name
const REQUEST_ID_HEADER = "X-Request-ID";

// CSRF Configuration
const CSRF_COOKIE_NAME = "csrf-token";
const CSRF_HEADER_NAME = "x-csrf-token";
// HIGH-5 FIX: More specific CSRF exemptions to prevent bypass
// Only exempt specific auth paths needed for OAuth flows, not the entire /api/auth namespace
const CSRF_EXEMPT_PATHS = [
  "/api/auth/callback",      // OAuth callbacks need exemption
  "/api/auth/signin",        // NextAuth signin
  "/api/auth/signout",       // NextAuth signout  
  "/api/auth/session",       // NextAuth session check
  "/api/auth/csrf",          // NextAuth CSRF endpoint
  "/api/auth/providers",     // NextAuth providers list
  "/api/webhooks",           // External webhooks
  "/api/health",             // Health checks
];

// Protected routes requiring authentication
const PROTECTED_PATHS = ["/dashboard", "/learnspace", "/admin"];

// Admin-only routes
const ADMIN_PATHS = ["/admin"];

// Routes requiring CSRF protection (state-changing API routes)
// HIGH-5 FIX: Added /api/auth to protect forgot-password and reset-password
const CSRF_PROTECTED_PATHS = [
  "/api/ai", 
  "/api/course", 
  "/api/capsule", 
  "/api/videos", 
  "/api/certificates",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
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
    
    // Scripts - self, inline for Next.js, and eval for development
    process.env.NODE_ENV === "production"
      ? "script-src 'self' 'unsafe-inline'"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    
    // Styles - self and inline (needed for styled components/CSS-in-JS)
    "style-src 'self' 'unsafe-inline'",
    
    // Images - self, data URIs, YouTube thumbnails, Convex storage
    "img-src 'self' data: blob: https://i.ytimg.com https://*.convex.cloud https://lh3.googleusercontent.com https://avatars.githubusercontent.com",
    
    // Fonts - self only
    "font-src 'self' data:",
    
    // Connect - API calls to self, Convex, and AI services
    "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://generativelanguage.googleapis.com https://api.openai.com",
    
    // Media - self and YouTube
    "media-src 'self' https://www.youtube.com",
    
    // Frames - YouTube embeds only
    "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
    
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

export async function middleware(request: NextRequest) {
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
    // HIGH-5 FIX: Use exact match for exempt paths to prevent bypass
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

  // 3. Authentication check for protected paths
  const isProtectedPath = PROTECTED_PATHS.some((path) =>
    pathname.startsWith(path)
  );

  if (isProtectedPath) {
    // Validate session using next-auth JWT
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      // No valid session - redirect to signin
      const url = new URL("/auth/signin", request.url);
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }

    // 4. Admin check for admin paths
    const isAdminPath = ADMIN_PATHS.some((path) => pathname.startsWith(path));
    if (isAdminPath && token.role !== "admin") {
      // User is not admin - redirect to dashboard
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // 5. Create response and add security headers
  const response = NextResponse.next();
  addSecurityHeaders(response);
  
  // Add request ID header for tracing
  response.headers.set(REQUEST_ID_HEADER, requestId);

  // 6. Set/refresh CSRF cookie for authenticated users on page loads
  if (!pathname.startsWith("/api/") && isProtectedPath) {
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
}

export const config = {
  matcher: [
    // Protected pages
    "/dashboard/:path*",
    "/learnspace/:path*",
    "/admin/:path*",
    // API routes that need protection
    "/api/ai/:path*",
    "/api/course/:path*",
    "/api/courses/:path*",
    "/api/capsule/:path*",
    "/api/videos/:path*",
    "/api/certificates/:path*",
    "/api/users/:path*",
  ],
};

