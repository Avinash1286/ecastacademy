/**
 * CSRF Protection Middleware
 * 
 * Implements CSRF protection using the double-submit cookie pattern.
 * This is suitable for SPAs where the frontend can read cookies and
 * include tokens in headers.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const CSRF_COOKIE_NAME = "csrf-token";
const CSRF_HEADER_NAME = "x-csrf-token";
const TOKEN_LENGTH = 32;

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(TOKEN_LENGTH).toString("hex");
}

/**
 * Validate CSRF token from request
 * Compares cookie token with header token using timing-safe comparison
 */
export function validateCsrfToken(request: NextRequest): boolean {
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const headerToken = request.headers.get(CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken) {
    return false;
  }

  // Use timing-safe comparison to prevent timing attacks
  try {
    const cookieBuffer = Buffer.from(cookieToken, "utf-8");
    const headerBuffer = Buffer.from(headerToken, "utf-8");

    if (cookieBuffer.length !== headerBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(cookieBuffer, headerBuffer);
  } catch {
    return false;
  }
}

/**
 * Check if the request method requires CSRF protection
 */
export function requiresCsrfProtection(method: string): boolean {
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  return !safeMethods.includes(method.toUpperCase());
}

/**
 * Check if the route should be exempt from CSRF protection
 * Some routes like webhooks or external API callbacks need to be exempt
 */
export function isCsrfExempt(pathname: string): boolean {
  const exemptPaths = [
    "/api/auth", // NextAuth handles its own CSRF
    "/api/webhooks", // Webhooks from external services
    "/api/health", // Health checks
  ];

  return exemptPaths.some((path) => pathname.startsWith(path));
}

/**
 * Set CSRF cookie on response
 */
export function setCsrfCookie(response: NextResponse, token: string): void {
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Must be readable by JavaScript
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  });
}

/**
 * CSRF protection middleware function
 * Returns null if valid, NextResponse with error if invalid
 */
export function csrfProtection(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Skip CSRF check for safe methods
  if (!requiresCsrfProtection(method)) {
    return null;
  }

  // Skip CSRF check for exempt paths
  if (isCsrfExempt(pathname)) {
    return null;
  }

  // Only check CSRF for API routes (non-auth)
  if (!pathname.startsWith("/api/")) {
    return null;
  }

  // Validate CSRF token
  if (!validateCsrfToken(request)) {
    return NextResponse.json(
      {
        error: "Invalid CSRF token",
        message: "Request rejected due to invalid or missing CSRF token",
      },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Get CSRF token from cookies or generate a new one
 */
export function getOrCreateCsrfToken(request: NextRequest): string {
  const existingToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  if (existingToken && existingToken.length === TOKEN_LENGTH * 2) {
    return existingToken;
  }
  return generateCsrfToken();
}
