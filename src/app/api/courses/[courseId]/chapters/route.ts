import { NextRequest, NextResponse } from "next/server";
import { getCourseChapters } from "@/lib/services/courseService";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ courseId: string }> }
) {
  try {
    const params=await context.params
    const { courseId } = params;

    if (!courseId) {
      return new NextResponse("Bad Request: Course ID is required", { status: 400 });
    }
    const chapters = await getCourseChapters(courseId);

    if (!chapters || chapters.length === 0) {
        return new NextResponse("Not Found: No chapters found for this course", { status: 404 });
    }

    return NextResponse.json(chapters, { status: 200 });
  } catch (error) {
    console.error("[GET_COURSE_CHAPTERS_API_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}