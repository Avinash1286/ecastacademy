import { NextRequest } from "next/server";
import { createCourseWithProgress } from "@/lib/services/courseServiceConvex";
import { CreateCourseSchema } from "@/lib/validators/courseValidator";
import { ZodError } from "zod";

export async function POST(request: NextRequest) {
  const readableStream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const sendEvent = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const body = await request.json();
        
        const validatedData = CreateCourseSchema.parse(body);

        const onProgress = (progressUpdate: { message: string; progress: number }) => {
          sendEvent(progressUpdate);
        };

        const courseId = await createCourseWithProgress(validatedData, onProgress);

        sendEvent({ message: "Course creation complete!", progress: 100, courseId });
        controller.close();

      } catch (error) {
        console.error("[COURSE_CREATE_API_ERROR]", error);
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