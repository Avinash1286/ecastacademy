import { NextResponse } from "next/server";
import { createConvexClient } from "@/lib/convexClient";
import { api } from "../../../../convex/_generated/api";
import { withRateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { NextRequest } from "next/server";

/**
 * Health Check Endpoint (Public)
 * 
 * Used by load balancers, monitoring systems, and deployment pipelines
 * to verify the application is running and responsive.
 * 
 * SECURITY: This endpoint returns MINIMAL information to prevent reconnaissance.
 * Detailed health information is available at /api/admin/health (requires admin auth).
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Public health response - minimal information only
 */
interface PublicHealthStatus {
  status: "healthy" | "unhealthy";
  timestamp: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Apply rate limiting to prevent health check abuse
  const rateLimitResponse = await withRateLimit(request, RATE_LIMIT_PRESETS.PUBLIC_API);
  if (rateLimitResponse) return rateLimitResponse;

  let isHealthy = true;

  // Check 1: Required environment variables exist (don't reveal which ones)
  const requiredEnvVars = [
    "NEXT_PUBLIC_CONVEX_URL",
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  ];
  
  const missingEnvVars = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]
  );
  
  if (missingEnvVars.length > 0) {
    isHealthy = false;
  }

  // Check 2: Database connectivity (simple check, no timing info)
  try {
    const convex = createConvexClient();
    await convex.query(api.courses.getAllCourses, { limit: 1 });
  } catch {
    isHealthy = false;
  }

  const response: PublicHealthStatus = {
    status: isHealthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response, {
    status: isHealthy ? 200 : 503,
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Content-Type": "application/json",
    },
  });
}
