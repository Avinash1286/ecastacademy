/**
 * Certificate Verification API
 * 
 * Public endpoint to verify certificate authenticity.
 * Rate-limited to prevent abuse.
 */

import { NextRequest, NextResponse } from "next/server";
import { withRateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { createConvexClient } from "@/lib/convexClient";
import { api } from "../../../../../convex/_generated/api";

const convex = createConvexClient();

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await withRateLimit(request, RATE_LIMIT_PRESETS.CERTIFICATE);
  if (rateLimitResponse) return rateLimitResponse;

  const { searchParams } = new URL(request.url);
  const certificateId = searchParams.get("id");

  if (!certificateId) {
    return NextResponse.json(
      { error: "Certificate ID is required" },
      { status: 400 }
    );
  }

  // Validate certificate ID format (CERT-{timestamp}-{hash}-{signature})
  if (!/^CERT-\d+-[a-f0-9]+-[a-zA-Z0-9_-]+$/.test(certificateId)) {
    return NextResponse.json(
      { 
        valid: false,
        error: "Invalid certificate ID format" 
      },
      { status: 400 }
    );
  }

  try {
    // Verify certificate using Convex
    const result = await convex.query(api.certificates.verifyCertificate, {
      certificateId,
    });

    if (!result.valid) {
      return NextResponse.json({
        valid: false,
        reason: result.reason,
      });
    }

    // Return verified certificate details
    return NextResponse.json({
      valid: true,
      certificate: {
        courseName: result.certificate?.courseName,
        recipientName: result.certificate?.userName,
        completionDate: result.certificate?.completionDate,
        grade: result.certificate?.overallGrade,
        issuedAt: result.certificate?.issuedAt,
      },
    });

  } catch (error) {
    console.error("[CERTIFICATE_VERIFY_ERROR]", error);
    return NextResponse.json(
      { 
        valid: false,
        error: "Failed to verify certificate" 
      },
      { status: 500 }
    );
  }
}
