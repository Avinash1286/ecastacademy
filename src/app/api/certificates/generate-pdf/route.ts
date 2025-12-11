import { NextRequest, NextResponse } from "next/server";
import { withRateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { auth as appAuth } from "@/lib/auth/auth.config";
import { createConvexClient } from "@/lib/convexClient";
import { api } from "../../../../../convex/_generated/api";
import { jsPDF } from "jspdf";

/**
 * PDF Certificate Generation API
 * 
 * Generates a downloadable PDF certificate for verified users.
 * Uses jsPDF for high-quality PDF output.
 */

interface CertificateData {
  certificateId: string;
  userName: string;
  courseName: string;
  overallGrade: number;
  completionDate: number;
  passedItems: number;
  totalGradedItems: number;
  verificationUrl: string;
}

/**
 * Generate PDF certificate
 */
function generateCertificatePDF(data: CertificateData): ArrayBuffer {
  const formattedDate = new Date(data.completionDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const grade = Math.round(data.overallGrade);
  
  // Create PDF in landscape A4
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const width = 297; // A4 landscape width in mm
  const height = 210; // A4 landscape height in mm
  const centerX = width / 2;

  // Background - cream/warm white
  doc.setFillColor(255, 251, 235); // #FFFBEB
  doc.rect(0, 0, width, height, "F");

  // Outer border - gold
  doc.setDrawColor(245, 158, 11); // #F59E0B
  doc.setLineWidth(2);
  doc.roundedRect(5, 5, width - 10, height - 10, 3, 3, "S");

  // Inner border - lighter gold
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.5);
  doc.roundedRect(10, 10, width - 20, height - 20, 2, 2, "S");

  // Corner decorations - gold circles (lighter shade to simulate opacity)
  doc.setFillColor(251, 211, 141); // Lighter gold to simulate 0.3 opacity
  doc.circle(15, 15, 5, "F");
  doc.circle(width - 15, 15, 5, "F");
  doc.circle(15, height - 15, 5, "F");
  doc.circle(width - 15, height - 15, 5, "F");

  // Title
  doc.setTextColor(120, 53, 15); // #78350F
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("CERTIFICATE OF COMPLETION", centerX, 55, { align: "center" });

  // Decorative line under title
  doc.setFillColor(245, 158, 11);
  doc.rect(centerX - 40, 60, 80, 1.5, "F");

  // "This certifies that"
  doc.setTextColor(107, 114, 128); // #6B7280
  doc.setFontSize(11);
  doc.setFont("helvetica", "italic");
  doc.text("This certifies that", centerX, 75, { align: "center" });

  // User Name
  doc.setTextColor(31, 41, 55); // #1F2937
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(data.userName, centerX, 90, { align: "center" });

  // "has successfully completed"
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(11);
  doc.setFont("helvetica", "italic");
  doc.text("has successfully completed", centerX, 102, { align: "center" });

  // Course Name
  doc.setTextColor(120, 53, 15);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  const courseName = truncateText(data.courseName, 50);
  doc.text(courseName, centerX, 115, { align: "center" });

  // Stats boxes
  const boxY = 125;
  const boxWidth = 50;
  const boxHeight = 22;
  const boxGap = 15;

  // Grade box
  const gradeBoxX = centerX - boxWidth - boxGap / 2;
  doc.setFillColor(254, 243, 199); // #FEF3C7
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.5);
  doc.roundedRect(gradeBoxX, boxY, boxWidth, boxHeight, 2, 2, "FD");

  doc.setTextColor(120, 53, 15);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`${grade}%`, gradeBoxX + boxWidth / 2, boxY + 10, { align: "center" });

  doc.setTextColor(146, 64, 14); // #92400E
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Overall Grade", gradeBoxX + boxWidth / 2, boxY + 17, { align: "center" });

  // Items Completed box
  const itemsBoxX = centerX + boxGap / 2;
  doc.setFillColor(209, 250, 229); // #D1FAE5
  doc.setDrawColor(16, 185, 129); // #10B981
  doc.roundedRect(itemsBoxX, boxY, boxWidth, boxHeight, 2, 2, "FD");

  doc.setTextColor(6, 95, 70); // #065F46
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`${data.passedItems}/${data.totalGradedItems}`, itemsBoxX + boxWidth / 2, boxY + 10, { align: "center" });

  doc.setTextColor(4, 120, 87); // #047857
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Items Completed", itemsBoxX + boxWidth / 2, boxY + 17, { align: "center" });

  // Horizontal line
  doc.setDrawColor(229, 231, 235); // #E5E7EB
  doc.setLineWidth(0.5);
  doc.line(30, 160, width - 30, 160);

  // Date section (left)
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Date of Completion", 50, 170);

  doc.setTextColor(31, 41, 55);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(formattedDate, 50, 178);

  // Signature section (right)
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("ECAST Academy", width - 50, 170, { align: "center" });

  doc.setDrawColor(31, 41, 55);
  doc.setLineWidth(0.3);
  doc.line(width - 80, 175, width - 20, 175);

  doc.setTextColor(156, 163, 175); // #9CA3AF
  doc.setFontSize(8);
  doc.text("Authorized Signature", width - 50, 182, { align: "center" });

  // Certificate ID (bottom center)
  doc.setTextColor(156, 163, 175);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Certificate ID", centerX, 192, { align: "center" });

  doc.setTextColor(107, 114, 128);
  doc.setFontSize(7);
  doc.setFont("courier", "normal");
  doc.text(data.certificateId, centerX, 197, { align: "center" });

  doc.setTextColor(156, 163, 175);
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.text(`Verify at: ${data.verificationUrl}`, centerX, 202, { align: "center" });

  return doc.output("arraybuffer");
}

/**
 * Truncate text with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

async function handler(req: NextRequest): Promise<NextResponse> {
  if (req.method !== "POST") {
    return NextResponse.json(
      { error: "Method not allowed" },
      { status: 405 }
    );
  }

  // Require authentication for certificate generation
  // Allow either Convex user id or email to be present; don't block when id is missing
  const session = await appAuth();
  if (!session?.user?.clerkId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  // Create Convex client with admin auth for internal ownership verification
  // User is already authenticated via Clerk session above
  const convex = createConvexClient({ useAdminAuth: true });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  try {
    const {
      certificateId,
      userName,
      courseName,
      overallGrade,
      completionDate,
      passedItems,
      totalGradedItems,
    } = body as Partial<CertificateData>;

    // Validate required fields
    if (!certificateId || !userName || !courseName) {
      return NextResponse.json(
        { error: "Missing required fields: certificateId, userName, courseName" },
        { status: 400 }
      );
    }

    // Verify certificate ownership - user can only generate their own certificates
    try {
      // Use verifyCertificateOwnership for lightweight ownership check
      const { isOwner, userEmail } = await convex.query(
        api.certificates.verifyCertificateOwnership,
        {
          certificateId,
          clerkId: session.user.clerkId,
        }
      );

      // Allow admins as well
      const isAdmin = session.user.role === "admin";

      // For email-based fallback, compare emails directly if we have both
      let isOwnerByEmail = false;
      if (!isOwner && !isAdmin && session.user.email && userEmail) {
        isOwnerByEmail = userEmail.toLowerCase() === session.user.email.toLowerCase();
      }

      if (!isOwner && !isOwnerByEmail && !isAdmin) {
        return NextResponse.json(
          { error: "Forbidden: You can only generate certificates for your own courses" },
          { status: 403 }
        );
      }
    } catch (error) {
      console.error("Certificate verification error:", error);
      return NextResponse.json(
        { error: "Certificate not found" },
        { status: 404 }
      );
    }

    // Build verification URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const verificationUrl = `${baseUrl}/certificates/${certificateId}`;

    const certificateData: CertificateData = {
      certificateId,
      userName,
      courseName,
      overallGrade: overallGrade ?? 0,
      completionDate: completionDate ?? Date.now(),
      passedItems: passedItems ?? 0,
      totalGradedItems: totalGradedItems ?? 0,
      verificationUrl,
    };

    // Generate PDF certificate
    const pdfBuffer = generateCertificatePDF(certificateData);

    // Return PDF as downloadable file
    const response = new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="certificate-${certificateId}.pdf"`,
        "Cache-Control": "private, max-age=3600",
      },
    });

    return response;
  } catch (error) {
    console.error("Certificate generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate certificate" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Apply rate limiting
  const rateLimitResponse = await withRateLimit(request, RATE_LIMIT_PRESETS.CERTIFICATE);
  if (rateLimitResponse) return rateLimitResponse;

  return handler(request);
}