'use client';

import type { ChapterWithVideo } from '@/lib/types';

// Strict YouTube video ID regex: exactly 11 alphanumeric characters, hyphens, or underscores
const YOUTUBE_VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

type VideoPlayerProps = {
  video: ChapterWithVideo['video'] | null;
  isPlayerVisible: boolean;
};

export function VideoPlayer({ video, isPlayerVisible }: VideoPlayerProps) {
  // Handle null video or missing videoId
  if (!video || !video.videoId) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-muted text-center text-muted-foreground">
        {!video ? "No video available" : "Invalid YouTube URL"}
      </div>
    );
  }

  // Validate videoId against strict YouTube format
  if (!YOUTUBE_VIDEO_ID_REGEX.test(video.videoId)) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-muted text-center text-muted-foreground">
        Invalid video ID format
      </div>
    );
  }

  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.videoId)}?autoplay=${isPlayerVisible ? 1 : 0}&controls=1&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3`;

  return (
    <div 
      className="protected-youtube-container relative aspect-video w-full overflow-hidden rounded-lg bg-black"
      style={{
        contain: 'layout style paint',
        isolation: 'isolate',
      }}
    >
      <iframe
        title={video.title || 'Video player'}
        src={src}
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}