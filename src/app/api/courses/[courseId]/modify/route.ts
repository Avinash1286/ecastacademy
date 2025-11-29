import { NextRequest, NextResponse } from "next/server";
import { updateCourse, deleteCourse, getCourseOwnership } from "@/lib/services/courseServiceConvex";
import { UpdateCourseSchema } from "@/lib/validators/courseValidator";
import { ZodError } from "zod";
import type { Id } from '../../../../../../convex/_generated/dataModel';
import { auth } from "@/lib/auth/auth.config";
import { withRateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ courseId: string }> }
) {
  // Apply rate limiting
  const rateLimitResponse = await withRateLimit(request, RATE_LIMIT_PRESETS.COURSE_CREATE);
  if (rateLimitResponse) return rateLimitResponse;

  // Require authentication
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const params = await context.params;
  const { courseId } = params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }

  try {
    // Authorization check: verify user owns the course or is admin
    const ownership = await getCourseOwnership(courseId as Id<"courses">);
    if (!ownership) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }
    
    const isOwner = ownership.createdBy === session.user.id;
    const isAdmin = session.user.role === "admin";
    
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: You can only modify your own courses" },
        { status: 403 }
      );
    }

    const validatedData = UpdateCourseSchema.parse(body);

    const updatedCourse = await updateCourse(courseId as Id<"courses">, validatedData);

    return NextResponse.json(updatedCourse, { status: 200 });
  } catch (error) {
    console.error("[PATCH_COURSE_API_ERROR]", error);

    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Course not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ courseId: string }> }
) {
  // Apply rate limiting
  const rateLimitResponse = await withRateLimit(request, RATE_LIMIT_PRESETS.COURSE_CREATE);
  if (rateLimitResponse) return rateLimitResponse;

  // Require authentication
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const params=await context.params;
    const { courseId } = params;
    
    // Authorization check: verify user owns the course or is admin
    const ownership = await getCourseOwnership(courseId as Id<"courses">);
    if (!ownership) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }
    
    const isOwner = ownership.createdBy === session.user.id;
    const isAdmin = session.user.role === "admin";
    
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: You can only delete your own courses" },
        { status: 403 }
      );
    }

    await deleteCourse(courseId as Id<"courses">);

    return NextResponse.json(
      { message: "Course deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[DELETE_COURSE_API_ERROR]", error);

    if (error instanceof Error && error.message === "Course not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}