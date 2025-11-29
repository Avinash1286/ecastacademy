import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { generateToken } from "@/lib/auth/utils";
import { sendEmail } from "@/lib/email/send";
import { getPasswordResetEmailHTML } from "@/lib/email/templates";
import { createConvexClient } from "@/lib/convexClient";
import { withRateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";

const convex = createConvexClient();

export async function POST(request: NextRequest) {
  // Apply strict rate limiting to prevent brute-force and email bombing
  const rateLimitResponse = await withRateLimit(request, RATE_LIMIT_PRESETS.AUTH);
  if (rateLimitResponse) return rateLimitResponse;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  try {
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await convex.query(api.auth.getUserByEmail, { email });

    // Always return success for security (don't reveal if email exists)
    if (!user) {
      return NextResponse.json({
        success: true,
        message: "If an account exists, a password reset email has been sent",
      });
    }

    // Check if user has a password (might be OAuth only)
    if (!user.password) {
      return NextResponse.json({
        success: true,
        message: "If an account exists, a password reset email has been sent",
      });
    }

    // Generate reset token
    const token = generateToken();
    const expires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    // Store token in database
    await convex.mutation(api.auth.createVerificationToken, {
      identifier: email,
      token,
      expires,
      type: "passwordReset",
    });

    // Send password reset email
    const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}`;
    const html = getPasswordResetEmailHTML(resetUrl, user.name);

    await sendEmail({
      to: email,
      subject: "Reset Your Password - ECAST Academy",
      html,
    });

    return NextResponse.json({
      success: true,
      message: "If an account exists, a password reset email has been sent",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "An error occurred. Please try again later." },
      { status: 500 }
    );
  }
}

