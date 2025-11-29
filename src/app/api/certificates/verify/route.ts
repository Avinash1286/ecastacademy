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

/**
 * MEDIUM-1 FIX: Mask name to protect PII
 * "John Doe" -> "J. Doe"
 */
function maskName(name?: string): string {
  if (!name) return "Certificate Holder";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0) + "***";
  }
  // First initial + last name
  return `${parts[0].charAt(0)}. ${parts[parts.length - 1]}`;
}

/**
 * MEDIUM-1 FIX: Convert exact grade to a range
 */
function getGradeRange(grade?: number): string {
  if (grade === undefined || grade === null) return "Completed";
  if (grade >= 90) return "90-100% (Excellent)";
  if (grade >= 80) return "80-89% (Very Good)";
  if (grade >= 70) return "70-79% (Good)";
  if (grade >= 60) return "60-69% (Satisfactory)";
  return "Below 60%";
}

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

    // MEDIUM-1 FIX: Return minimal certificate info to prevent PII enumeration
    // Only return enough info to confirm validity, not full personal details
    return NextResponse.json({
      valid: true,
      certificate: {
        // Only show course name and completion date - no personal info
        courseName: result.certificate?.courseName,
        completionDate: result.certificate?.completionDate,
        // Show only first name initial + last name for privacy
        recipientName: maskName(result.certificate?.userName),
        // Show grade as a range, not exact number
        gradeRange: getGradeRange(result.certificate?.overallGrade),
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
