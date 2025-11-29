import { NextResponse } from "next/server";
import { createConvexClient } from "@/lib/convexClient";
import { api } from "../../../../convex/_generated/api";

/**
 * Health Check Endpoint
 * 
 * Used by load balancers, monitoring systems, and deployment pipelines
 * to verify the application is running and responsive.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    name: string;
    status: "pass" | "fail";
    message?: string;
  }[];
}

export async function GET(): Promise<NextResponse<HealthStatus>> {
  const startTime = process.hrtime();
  const checks: HealthStatus["checks"] = [];
  
  // Check 1: Basic runtime
  checks.push({
    name: "runtime",
    status: "pass",
  });

  // Check 2: Environment variables
  const requiredEnvVars = [
    "NEXT_PUBLIC_CONVEX_URL",
    "NEXTAUTH_SECRET",
  ];
  
  const missingEnvVars = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]
  );
  
  if (missingEnvVars.length > 0) {
    checks.push({
      name: "environment",
      status: "fail",
      message: `Missing: ${missingEnvVars.join(", ")}`,
    });
  } else {
    checks.push({
      name: "environment",
      status: "pass",
    });
  }

  // Check 3: Memory usage (warn if > 90%)
  const memoryUsage = process.memoryUsage();
  const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
  
  checks.push({
    name: "memory",
    status: heapUsedPercent > 90 ? "fail" : "pass",
    message: `Heap: ${heapUsedPercent.toFixed(1)}% used`,
  });

  // Check 4: Database (Convex) connectivity
  try {
    const convex = createConvexClient();
    // Simple query to verify connectivity - get any course (limit 1)
    const dbCheckStart = performance.now();
    await convex.query(api.courses.getAllCourses, { limit: 1 });
    const dbCheckTime = Math.round(performance.now() - dbCheckStart);
    
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

  // Determine overall status
  const failedChecks = checks.filter((c) => c.status === "fail");
  let overallStatus: HealthStatus["status"] = "healthy";
  
  if (failedChecks.length > 0) {
    // If only non-critical checks fail, mark as degraded
    const criticalFailures = failedChecks.filter(
      (c) => c.name === "runtime" || c.name === "environment" || c.name === "database"
    );
    overallStatus = criticalFailures.length > 0 ? "unhealthy" : "degraded";
  }

  const [seconds, nanoseconds] = process.hrtime(startTime);
  const responseTimeMs = seconds * 1000 + nanoseconds / 1e6;

  const response: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    uptime: process.uptime(),
    checks: [
      ...checks,
      {
        name: "responseTime",
        status: responseTimeMs < 100 ? "pass" : "fail",
        message: `${responseTimeMs.toFixed(2)}ms`,
      },
    ],
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
