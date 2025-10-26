import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { hashPassword, validatePassword } from "@/lib/auth/utils";
import { Id } from "../../../../../convex/_generated/dataModel";
import { createConvexClient } from "@/lib/convexClient";

const convex = createConvexClient();

/**
 * Handle password reset using a verification token and a new password.
 *
 * Expects the request body to be JSON with `token` and `password`. Validates the password,
 * verifies the token, looks up the user by the token's identifier, updates the user's hashed
 * password, and removes the used verification token.
 *
 * @param request - Next.js request whose JSON body must include `{ token: string, password: string }`
 * @returns A JSON NextResponse: on success `{ success: true, message: "Password has been reset successfully" }`; on error `{ error: string }` with an appropriate HTTP status (400 for bad input or invalid/expired token, 404 if user not found, 500 for server errors)
 */
export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

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
