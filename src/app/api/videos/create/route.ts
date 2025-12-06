import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { createConvexClient } from "@/lib/convexClient";
import { withRateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { auth } from "@/lib/auth/auth.config";
import { logger } from "@/lib/logging/logger";

const convex = createConvexClient();

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await withRateLimit(request, RATE_LIMIT_PRESETS.VIDEO_CREATE);
  if (rateLimitResponse) return rateLimitResponse;

  // Require authentication for video creation
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

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
    const { videos } = body;

    if (!videos || !Array.isArray(videos) || videos.length === 0) {
      return NextResponse.json(
        { error: "No videos provided" },
        { status: 400 }
      );
    }

    // Validate video array size (prevent abuse)
    if (videos.length > 50) {
      return NextResponse.json(
        { error: "Maximum 50 videos per request" },
        { status: 400 }
      );
    }

    // Validate each video has required fields
    for (const video of videos) {
      if (!video.id || typeof video.id !== 'string') {
        return NextResponse.json(
          { error: "Each video must have a valid 'id' field" },
          { status: 400 }
        );
      }
      if (!/^[a-zA-Z0-9_-]{11}$/.test(video.id)) {
        return NextResponse.json(
          { error: `Invalid YouTube video ID format: ${video.id}` },
          { status: 400 }
        );
      }
    }

    let created = 0;
    let existing = 0;
    let skippedProcessing = 0;
    const createdVideoIds: Id<"videos">[] = [];
    const currentUserId = session.user.id as Id<"users">;

    // First, create all videos with pending status (don't trigger processing yet)
    for (const video of videos) {
      // Check if video already exists
      const existingVideo = await convex.query(api.videos.findVideoByYoutubeId, {
        youtubeVideoId: video.id,
      });

      if (existingVideo) {
        existing++;
      } else {
        const shouldSkipProcessing = Boolean(video.skipTranscript);

        // Create video with pending status
        const videoId = await convex.mutation(api.videos.createVideo, {
          youtubeVideoId: video.id,
          title: video.title,
          url: `https://www.youtube.com/watch?v=${video.id}`,
          thumbnailUrl: video.thumbnail,
          channelTitle: video.channelTitle,
          publishedAt: video.publishedAt ? new Date(video.publishedAt).getTime() : undefined,
          durationInSeconds: video.durationInSeconds,
          transcript: video.transcript || "",
          notes: {},
          quiz: {},
          status: shouldSkipProcessing ? "completed" : "pending",
          currentUserId,
        });

        created++;
        if (shouldSkipProcessing) {
          skippedProcessing++;
        } else {
          createdVideoIds.push(videoId as Id<"videos">);
        }
      }
    }

    // Now trigger sequential processing for all created videos
    if (createdVideoIds.length > 0) {
      try {
        await convex.action(api.videoProcessing.processVideosSequentially, {
          videoIds: createdVideoIds,
        });
      } catch (error) {
        logger.error("Failed to trigger sequential processing", { videoCount: createdVideoIds.length }, error as Error);
      }
    }

    return NextResponse.json({
      created,
      existing,
      total: videos.length,
      skippedProcessing,
      queued: createdVideoIds.length,
      message: `Submitted ${videos.length} video(s): ${created} new, ${existing} existing. ${createdVideoIds.length} queued for AI processing and ${skippedProcessing} skipped.`
    });

  } catch (error) {
    logger.error("[VIDEO_CREATE_API] Video creation failed", undefined, error as Error);
    // Don't leak internal error details to client
    return NextResponse.json(
      { error: "Failed to create videos. Please try again later." },
      { status: 500 }
    );
  }
}

