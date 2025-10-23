import { NextRequest, NextResponse } from "next/server";
import { updateCourse, deleteCourse } from "@/lib/services/courseServiceConvex";
import { UpdateCourseSchema } from "@/lib/validators/courseValidator";
import { ZodError } from "zod";
import type { Id } from '../../../../../../convex/_generated/dataModel';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ courseId: string }> }
) {
  try {
    const params=await context.params;
    const { courseId } = params;
    const body = await request.json();

    const validatedData = UpdateCourseSchema.parse(body);

    const updatedCourse = await updateCourse(courseId as Id<"courses">, validatedData);

    return NextResponse.json(updatedCourse, { status: 200 });
  } catch (error) {
    console.error("[PATCH_COURSE_API_ERROR]", error);

    if (error instanceof ZodError) {
      return new NextResponse(error.message, { status: 400 });
    }
    if (error instanceof Error && error.message === "Course not found") {
      return new NextResponse(error.message, { status: 404 });
    }

    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ courseId: string }> }
) {
  try {
    const params=await context.params;
    const { courseId } = params;
    
    await deleteCourse(courseId as Id<"courses">);

    return NextResponse.json(
      { message: "Course deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[DELETE_COURSE_API_ERROR]", error);

    if (error instanceof Error && error.message === "Course not found") {
      return new NextResponse(error.message, { status: 404 });
    }

    return new NextResponse("Internal Server Error", { status: 500 });
  }
}