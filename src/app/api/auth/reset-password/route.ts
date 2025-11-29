import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { hashPassword, validatePassword } from "@/lib/auth/utils";
import { Id } from "../../../../../convex/_generated/dataModel";
import { createConvexClient } from "@/lib/convexClient";
import { withRateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";

const convex = createConvexClient();

export async function POST(request: NextRequest) {
  // Apply strict rate limiting to prevent brute-force attacks on reset tokens
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
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required" },
        { status: 400 }
      );
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.errors[0] },
        { status: 400 }
      );
    }

    // Verify token
    const verificationToken = await convex.query(
      api.auth.getVerificationToken,
      { token }
    );

    if (!verificationToken) {
      return NextResponse.json(
        { error: "Invalid or expired reset token" },
        { status: 400 }
      );
    }

    if (verificationToken.type !== "passwordReset") {
      return NextResponse.json(
        { error: "Invalid token type" },
        { status: 400 }
      );
    }

    // Get user by email
    const user = await convex.query(api.auth.getUserByEmail, {
      email: verificationToken.identifier,
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Hash new password
    const hashedPassword = await hashPassword(password);

    // Update user password
    await convex.mutation(api.auth.updateUser, {
      id: user._id as Id<"users">,
      password: hashedPassword,
    });

    // Delete the used token
    await convex.mutation(api.auth.deleteVerificationToken, { token });

    return NextResponse.json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "An error occurred. Please try again later." },
      { status: 500 }
    );
  }
}

