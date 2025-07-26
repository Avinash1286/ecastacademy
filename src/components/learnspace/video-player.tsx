'use client';

import YouTube, { YouTubeProps } from 'react-youtube';
import type { ChapterWithVideo } from '@/lib/types';

type VideoPlayerProps = {
  video: ChapterWithVideo['video'];
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
    },
  };

  if (!video.videoId) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-muted text-center text-muted-foreground">
        Invalid YouTube URL
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
      <YouTube
        videoId={video.videoId}
        opts={opts}
        className="absolute inset-0 h-full w-full"
        iframeClassName="h-full w-full"
      />
    </div>
  );
}