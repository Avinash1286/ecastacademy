import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { createConvexClient } from "@/lib/convexClient";

const convex = createConvexClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videos } = body;

    if (!videos || !Array.isArray(videos) || videos.length === 0) {
      return NextResponse.json(
        { error: "No videos provided" },
        { status: 400 }
      );
    }

    let created = 0;
    let existing = 0;
    const createdVideoIds: Id<"videos">[] = [];

    // First, create all videos with pending status (don't trigger processing yet)
    for (const video of videos) {
      // Check if video already exists
      const existingVideo = await convex.query(api.videos.findVideoByYoutubeId, {
        youtubeVideoId: video.id,
      });

      if (existingVideo) {
        existing++;
      } else {
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
        });

        created++;
        createdVideoIds.push(videoId as Id<"videos">);
      }
    }

    // Now trigger sequential processing for all created videos
    if (createdVideoIds.length > 0) {
      try {
        await convex.action(api.videoProcessing.processVideosSequentially, {
          videoIds: createdVideoIds,
        });
      } catch (error) {
        console.error("Failed to trigger sequential processing:", error);
      }
    }

    return NextResponse.json({
      created,
      existing,
      total: videos.length,
      message: `Processing ${created} new video(s) in background. ${existing} video(s) already existed.`
    });

  } catch (error) {
    console.error("[VIDEO_CREATE_API_ERROR]", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json(
      { error: `Failed to create videos: ${errorMessage}` },
      { status: 500 }
    );
  }
}

