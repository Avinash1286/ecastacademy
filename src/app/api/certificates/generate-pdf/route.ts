import { NextRequest, NextResponse } from "next/server";
import { withRateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { auth } from "@/lib/auth/auth.config";
import { createConvexClient } from "@/lib/convexClient";
import { api } from "../../../../../convex/_generated/api";

const convex = createConvexClient();

/**
 * PDF Certificate Generation API
 * 
 * Generates a downloadable PDF certificate for verified users.
 * Uses SVG-to-PDF conversion for high-quality output.
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
 * Generate SVG certificate template
 */
function generateCertificateSVG(data: CertificateData): string {
  const formattedDate = new Date(data.completionDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const grade = Math.round(data.overallGrade);
  
  // A4 size in pixels at 96 DPI (landscape)
  const width = 1122;
  const height = 794;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FFFBEB;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#FFFFFF;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#FFFBEB;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#F59E0B;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#FBBF24;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#F59E0B;stop-opacity:1" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000" flood-opacity="0.1"/>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="${width}" height="${height}" fill="url(#bgGradient)"/>
  
  <!-- Border -->
  <rect x="20" y="20" width="${width - 40}" height="${height - 40}" 
        fill="none" stroke="url(#goldGradient)" stroke-width="8" rx="8"/>
  <rect x="35" y="35" width="${width - 70}" height="${height - 70}" 
        fill="none" stroke="#F59E0B" stroke-width="2" rx="4" opacity="0.5"/>
  
  <!-- Corner Decorations -->
  <g fill="#F59E0B" opacity="0.3">
    <circle cx="60" cy="60" r="20"/>
    <circle cx="${width - 60}" cy="60" r="20"/>
    <circle cx="60" cy="${height - 60}" r="20"/>
    <circle cx="${width - 60}" cy="${height - 60}" r="20"/>
  </g>
  
  <!-- Award Icon Circle -->
  <circle cx="${width / 2}" cy="100" r="45" fill="url(#goldGradient)" filter="url(#shadow)"/>
  <text x="${width / 2}" y="115" font-family="Arial, sans-serif" font-size="40" 
        fill="white" text-anchor="middle">★</text>
  
  <!-- Title -->
  <text x="${width / 2}" y="190" font-family="Georgia, serif" font-size="42" font-weight="bold" 
        fill="#78350F" text-anchor="middle" letter-spacing="4">
    CERTIFICATE OF COMPLETION
  </text>
  
  <!-- Decorative Line -->
  <rect x="${width / 2 - 150}" y="210" width="300" height="4" fill="url(#goldGradient)" rx="2"/>
  
  <!-- "This certifies that" -->
  <text x="${width / 2}" y="270" font-family="Georgia, serif" font-size="18" 
        fill="#6B7280" text-anchor="middle" font-style="italic">
    This certifies that
  </text>
  
  <!-- User Name -->
  <text x="${width / 2}" y="330" font-family="Georgia, serif" font-size="38" font-weight="bold" 
        fill="#1F2937" text-anchor="middle">
    ${escapeXml(data.userName)}
  </text>
  
  <!-- "has successfully completed" -->
  <text x="${width / 2}" y="380" font-family="Georgia, serif" font-size="18" 
        fill="#6B7280" text-anchor="middle" font-style="italic">
    has successfully completed
  </text>
  
  <!-- Course Name -->
  <text x="${width / 2}" y="440" font-family="Georgia, serif" font-size="32" font-weight="bold" 
        fill="#78350F" text-anchor="middle">
    ${escapeXml(truncateText(data.courseName, 50))}
  </text>
  
  <!-- Stats Row -->
  <g transform="translate(${width / 2 - 200}, 480)">
    <!-- Grade -->
    <g transform="translate(0, 0)">
      <rect x="0" y="0" width="180" height="80" rx="8" fill="#FEF3C7" stroke="#F59E0B" stroke-width="2"/>
      <text x="90" y="35" font-family="Arial, sans-serif" font-size="28" font-weight="bold" 
            fill="#78350F" text-anchor="middle">${grade}%</text>
      <text x="90" y="60" font-family="Arial, sans-serif" font-size="14" 
            fill="#92400E" text-anchor="middle">Overall Grade</text>
    </g>
    
    <!-- Items Passed -->
    <g transform="translate(220, 0)">
      <rect x="0" y="0" width="180" height="80" rx="8" fill="#D1FAE5" stroke="#10B981" stroke-width="2"/>
      <text x="90" y="35" font-family="Arial, sans-serif" font-size="28" font-weight="bold" 
            fill="#065F46" text-anchor="middle">${data.passedItems}/${data.totalGradedItems}</text>
      <text x="90" y="60" font-family="Arial, sans-serif" font-size="14" 
            fill="#047857" text-anchor="middle">Items Completed</text>
    </g>
  </g>
  
  <!-- Bottom Section -->
  <line x1="100" y1="610" x2="${width - 100}" y2="610" stroke="#E5E7EB" stroke-width="2"/>
  
  <!-- Date -->
  <g transform="translate(200, 640)">
    <text x="0" y="0" font-family="Arial, sans-serif" font-size="14" fill="#6B7280">Date of Completion</text>
    <text x="0" y="28" font-family="Georgia, serif" font-size="18" font-weight="bold" fill="#1F2937">
      ${formattedDate}
    </text>
  </g>
  
  <!-- Signature -->
  <g transform="translate(${width - 350}, 640)">
    <text x="100" y="0" font-family="Arial, sans-serif" font-size="14" fill="#6B7280" text-anchor="middle">
      ECAST Academy
    </text>
    <line x1="0" y1="28" x2="200" y2="28" stroke="#1F2937" stroke-width="1"/>
    <text x="100" y="48" font-family="Arial, sans-serif" font-size="12" fill="#9CA3AF" text-anchor="middle">
      Authorized Signature
    </text>
  </g>
  
  <!-- Certificate ID -->
  <g transform="translate(${width / 2}, 720)">
    <text x="0" y="0" font-family="Arial, sans-serif" font-size="12" fill="#9CA3AF" text-anchor="middle">
      Certificate ID
    </text>
    <text x="0" y="20" font-family="monospace" font-size="11" fill="#6B7280" text-anchor="middle">
      ${escapeXml(data.certificateId)}
    </text>
    <text x="0" y="42" font-family="Arial, sans-serif" font-size="10" fill="#9CA3AF" text-anchor="middle">
      Verify at: ${escapeXml(data.verificationUrl)}
    </text>
  </g>
</svg>`;
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

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
      const certificate = await convex.query(api.certificates.getCertificate, {
        certificateId,
      });
      
      if (certificate.userId !== session.user.id) {
        return NextResponse.json(
          { error: "Forbidden: You can only generate certificates for your own courses" },
          { status: 403 }
        );
      }
    } catch {
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

    // Generate SVG certificate
    const svg = generateCertificateSVG(certificateData);

    // Return SVG as downloadable file
    const response = new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Content-Disposition": `attachment; filename="certificate-${certificateId}.svg"`,
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
