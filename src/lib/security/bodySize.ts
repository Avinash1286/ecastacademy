/**
 * Request Body Size Limiting Middleware
 * 
 * Provides protection against memory exhaustion attacks by limiting
 * the size of incoming request bodies.
 */

import { NextRequest, NextResponse } from "next/server";

/**
 * Default size limits for different content types (in bytes)
 */
export const SIZE_LIMITS = {
  /** Default limit for JSON payloads (1MB) */
  JSON: 1 * 1024 * 1024,
  /** Limit for file uploads (10MB) */
  FILE_UPLOAD: 10 * 1024 * 1024,
  /** Limit for PDF uploads (15MB) - matches existing capsule limit */
  PDF_UPLOAD: 15 * 1024 * 1024,
  /** Limit for AI generation requests (512KB) */
  AI_GENERATION: 512 * 1024,
  /** Limit for chat messages (64KB) */
  CHAT: 64 * 1024,
  /** Very small limit for simple requests (16KB) */
  SMALL: 16 * 1024,
} as const;

/**
 * Route-specific size limits
 */
const ROUTE_SIZE_LIMITS: Record<string, number> = {
  "/api/ai/generate-notes": SIZE_LIMITS.AI_GENERATION,
  "/api/ai/generate-quiz": SIZE_LIMITS.AI_GENERATION,
  "/api/ai/generate-text-quiz": SIZE_LIMITS.AI_GENERATION,
  "/api/ai/tutor-chat": SIZE_LIMITS.CHAT,
  "/api/chat": SIZE_LIMITS.CHAT,
  "/api/capsule/upload-pdf": SIZE_LIMITS.PDF_UPLOAD,
  "/api/videos/create": SIZE_LIMITS.JSON,
  "/api/courses": SIZE_LIMITS.JSON,
  "/api/course/create": SIZE_LIMITS.JSON,
  "/api/course/create-from-videos": SIZE_LIMITS.JSON,
  "/api/certificates/generate-pdf": SIZE_LIMITS.SMALL,
  "/api/auth/forgot-password": SIZE_LIMITS.SMALL,
  "/api/auth/reset-password": SIZE_LIMITS.SMALL,
};

/**
 * Get the size limit for a specific route
 */
export function getSizeLimit(pathname: string): number {
  // Check for exact match first
  if (ROUTE_SIZE_LIMITS[pathname]) {
    return ROUTE_SIZE_LIMITS[pathname];
  }

  // Check for prefix matches
  for (const [route, limit] of Object.entries(ROUTE_SIZE_LIMITS)) {
    if (pathname.startsWith(route)) {
      return limit;
    }
  }

  // Default to JSON limit
  return SIZE_LIMITS.JSON;
}

/**
 * Check if request body exceeds the size limit
 * Returns the content length or -1 if not determinable
 */
export function getContentLength(request: NextRequest): number {
  const contentLength = request.headers.get("content-length");
  if (!contentLength) {
    return -1;
  }
  return parseInt(contentLength, 10);
}

/**
 * Body size limiting middleware
 * Returns null if valid, NextResponse with error if body is too large
 */
export function bodySizeLimit(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Only check body size for methods that have bodies
  if (["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) {
    return null;
  }

  const contentLength = getContentLength(request);
  
  // If no content-length header, we'll rely on streaming limits
  // or let the route handler deal with it
  if (contentLength === -1) {
    return null;
  }

  const sizeLimit = getSizeLimit(pathname);

  if (contentLength > sizeLimit) {
    const limitMB = (sizeLimit / (1024 * 1024)).toFixed(1);
    const actualMB = (contentLength / (1024 * 1024)).toFixed(1);

    return NextResponse.json(
      {
        error: "Payload too large",
        message: `Request body exceeds the ${limitMB}MB limit (received ${actualMB}MB)`,
        limit: sizeLimit,
        received: contentLength,
      },
      {
        status: 413,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  return null;
}

/**
 * Utility to check body size within a route handler
 * Use this for streaming uploads where content-length may not be set
 */
export async function checkBodySize(
  request: NextRequest,
  maxSize: number
): Promise<{ valid: boolean; error?: string; body?: ArrayBuffer }> {
  try {
    const body = await request.arrayBuffer();
    
    if (body.byteLength > maxSize) {
      const limitMB = (maxSize / (1024 * 1024)).toFixed(1);
      const actualMB = (body.byteLength / (1024 * 1024)).toFixed(1);
      
      return {
        valid: false,
        error: `Request body exceeds the ${limitMB}MB limit (received ${actualMB}MB)`,
      };
    }

    return { valid: true, body };
  } catch {
    return {
      valid: false,
      error: "Failed to read request body",
    };
  }
}
