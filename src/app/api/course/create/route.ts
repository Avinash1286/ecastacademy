import { NextRequest, NextResponse } from "next/server";
import { createCourseWithProgress } from "@/lib/services/courseServiceConvex";
import { CreateCourseSchema } from "@/lib/validators/courseValidator";
import { ZodError } from "zod";
import { requireAdmin } from "@/lib/auth/auth.config";
import { withRateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { logger } from "@/lib/logging/logger";

export async function POST(request: NextRequest) {
  // Apply rate limiting for course creation
  const rateLimitResponse = await withRateLimit(request, RATE_LIMIT_PRESETS.COURSE_CREATE);
  if (rateLimitResponse) return rateLimitResponse;

  // Require admin authentication for course creation
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json(
      { error: "Admin authentication required" },
      { status: 401 }
    );
  }

  const readableStream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const sendEvent = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      let body;
      try {
        body = await request.json();
      } catch {
        sendEvent({ error: "Invalid JSON in request body" });
        controller.close();
        return;
      }

      try {
        const validatedData = CreateCourseSchema.parse(body);

        const onProgress = (progressUpdate: { message: string; progress: number }) => {
          sendEvent(progressUpdate);
        };

        const courseId = await createCourseWithProgress(validatedData, onProgress);

        sendEvent({ message: "Course creation complete!", progress: 100, courseId });
        controller.close();

      } catch (error) {
        logger.error('Course creation failed', { userId: session?.user?.id }, error as Error);
        let errorMessage = "An unknown error occurred.";

        if (error instanceof ZodError) {
          // Provide more specific validation errors
          errorMessage = `Invalid input: ${error.errors.map(e => e.message).join(', ')}`;
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }

        sendEvent({ error: `Failed to create course: ${errorMessage}` });
        controller.close();
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}