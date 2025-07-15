'use client';

import YouTube, { YouTubeProps } from 'react-youtube';
import type { ChapterWithVideo } from '@/lib/types';

type VideoPlayerProps = {
  video: ChapterWithVideo['video'];
};

export function VideoPlayer({ video }: VideoPlayerProps) {

  const opts: YouTubeProps['opts'] = {
    playerVars: {
      autoplay: 1,
      controls: 1,
      rel: 0,
      showinfo: 0,
      modestbranding: 1,
    },
  };

  if (!video.videoId) {
    return <div className="aspect-video w-full rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">Invalid YouTube URL</div>;
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
      <YouTube
        key={video.videoId}
        videoId={video.videoId}
        opts={opts}
        className="absolute inset-0 w-full h-full"
        iframeClassName="w-full h-full"
      />
    </div>
  );
}