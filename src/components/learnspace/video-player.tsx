'use client';

import YouTube, { YouTubeProps } from 'react-youtube';
import type { ChapterWithVideo } from '@/lib/types';

type VideoPlayerProps = {
  video: ChapterWithVideo['video'] | null;
  isPlayerVisible: boolean;
};

export function VideoPlayer({ video, isPlayerVisible }: VideoPlayerProps) {

  const opts: YouTubeProps['opts'] = {
    playerVars: {
      autoplay: isPlayerVisible ? 1 : 0, 
      controls: 1,
      rel: 0,
      showinfo: 0,
      modestbranding: 1,
      iv_load_policy: 3, // Hide annotations
      playsinline: 1,
    },
    host: 'https://www.youtube-nocookie.com', // Privacy-enhanced mode - fewer extension triggers
  };

  // Handle null video or missing videoId
  if (!video || !video.videoId) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-muted text-center text-muted-foreground">
        {!video ? "No video available" : "Invalid YouTube URL"}
      </div>
    );
  }

  return (
    <div 
      className="protected-youtube-container relative aspect-video w-full overflow-hidden rounded-lg bg-black"
      style={{
        contain: 'layout style paint',
        isolation: 'isolate',
      }}
    >
      <YouTube
        videoId={video.videoId}
        opts={opts}
        className="react-youtube-container absolute inset-0 h-full w-full"
        iframeClassName="h-full w-full"
      />
    </div>
  );
}