import { NextRequest, NextResponse } from "next/server";
import { createConvexClient } from "@/lib/convexClient";
import { api } from "../../../../../convex/_generated/api";
import { auth } from "@/lib/auth/auth.config";
import { withRateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";

/**
 * Admin Health Check Endpoint
 * 
 * Provides DETAILED health information for administrators only.
 * This includes sensitive information like memory usage, response times,
 * environment status, and database latency.
 * 
 * SECURITY: Requires admin authentication.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface DetailedHealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    name: string;
    status: "pass" | "fail";
    message?: string;
  }[];
  system: {
    nodeVersion: string;
    platform: string;
    memory: {
      heapUsedMB: number;
      heapTotalMB: number;
      heapUsedPercent: number;
      rssMB: number;
    };
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Apply rate limiting
  const rateLimitResponse = await withRateLimit(request, RATE_LIMIT_PRESETS.ADMIN);
  if (rateLimitResponse) return rateLimitResponse;

  // Require admin authentication
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  if (session.user.role !== "admin") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  const startTime = process.hrtime();
  const checks: DetailedHealthStatus["checks"] = [];
  
  // Check 1: Basic runtime
  checks.push({
    name: "runtime",
    status: "pass",
  });

  // Check 2: Environment variables
  const requiredEnvVars = [
    "NEXT_PUBLIC_CONVEX_URL",
    "NEXTAUTH_SECRET",
    "CONVEX_DEPLOY_KEY",
  ];
  
  const optionalEnvVars = [
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "GEMINI_API_KEY",
    "OPENAI_API_KEY",
  ];
  
  const missingRequired = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]
  );
  
  const missingOptional = optionalEnvVars.filter(
    (envVar) => !process.env[envVar]
  );
  
  if (missingRequired.length > 0) {
    checks.push({
      name: "environment",
      status: "fail",
      message: `Missing required: ${missingRequired.join(", ")}`,
    });
  } else if (missingOptional.length > 0) {
    checks.push({
      name: "environment",
      status: "pass",
      message: `Missing optional: ${missingOptional.join(", ")}`,
    });
  } else {
    checks.push({
      name: "environment",
      status: "pass",
      message: "All environment variables configured",
    });
  }

  // Check 3: Memory usage
  const memoryUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
  const rssMB = Math.round(memoryUsage.rss / 1024 / 1024);
  const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
  
  checks.push({
    name: "memory",
    status: heapUsedPercent > 90 ? "fail" : "pass",
    message: `Heap: ${heapUsedPercent.toFixed(1)}% (${heapUsedMB}MB / ${heapTotalMB}MB)`,
  });

  // Check 4: Database (Convex) connectivity
  let dbCheckTime = 0;
  try {
    const convex = createConvexClient();
    const dbCheckStart = performance.now();
    await convex.query(api.courses.getAllCourses, { limit: 1 });
    dbCheckTime = Math.round(performance.now() - dbCheckStart);
    
    checks.push({
      name: "database",
      status: dbCheckTime < 5000 ? "pass" : "fail",
      message: `Convex: ${dbCheckTime}ms`,
    });
  } catch (error) {
    checks.push({
      name: "database",
      status: "fail",
      message: `Convex: ${error instanceof Error ? error.message : "Connection failed"}`,
    });
  }

  // Check 5: Redis (if configured)
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const redisStart = performance.now();
      const response = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/ping`, {
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      });
      const redisTime = Math.round(performance.now() - redisStart);
      
      checks.push({
        name: "redis",
        status: response.ok ? "pass" : "fail",
        message: response.ok ? `Redis: ${redisTime}ms` : "Redis: Connection failed",
      });
    } catch (error) {
      checks.push({
        name: "redis",
        status: "fail",
        message: `Redis: ${error instanceof Error ? error.message : "Connection failed"}`,
      });
    }
  } else {
    checks.push({
      name: "redis",
      status: "fail",
      message: "Redis: Not configured (using in-memory rate limiting)",
    });
  }

  // Determine overall status
  const failedChecks = checks.filter((c) => c.status === "fail");
  let overallStatus: DetailedHealthStatus["status"] = "healthy";
  
  if (failedChecks.length > 0) {
    const criticalFailures = failedChecks.filter(
      (c) => c.name === "runtime" || c.name === "environment" || c.name === "database"
    );
    overallStatus = criticalFailures.length > 0 ? "unhealthy" : "degraded";
  }

  const [seconds, nanoseconds] = process.hrtime(startTime);
  const responseTimeMs = seconds * 1000 + nanoseconds / 1e6;

  checks.push({
    name: "responseTime",
    status: responseTimeMs < 100 ? "pass" : "fail",
    message: `${responseTimeMs.toFixed(2)}ms`,
  });

  const response: DetailedHealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    uptime: process.uptime(),
    checks,
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      memory: {
        heapUsedMB,
        heapTotalMB,
        heapUsedPercent: Math.round(heapUsedPercent * 10) / 10,
        rssMB,
      },
    },
  };

  const httpStatus = overallStatus === "unhealthy" ? 503 : 200;

  return NextResponse.json(response, {
    status: httpStatus,
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Content-Type": "application/json",
    },
  });
}
