'use client';

import { ContentItem, InteractiveNotesProps, Quiz } from '@/lib/types';
import { VideoPlayer } from './video-player';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

type ContentRendererProps = {
  contentItem: ContentItem | null;
  isPlayerVisible: boolean;
  fallbackVideo?: {
    videoId: string;
    title: string;
    url: string;
    thumbnailUrl: string | null;
    durationInSeconds: number | null;
    notes: InteractiveNotesProps;
    quiz: Quiz;
  } | null;
};

export function ContentRenderer({ contentItem, isPlayerVisible, fallbackVideo }: ContentRendererProps) {
  // If no content item but fallback video exists (old system)
  if (!contentItem && fallbackVideo) {
    return <VideoPlayer video={fallbackVideo} isPlayerVisible={isPlayerVisible} />;
  }

  if (!contentItem) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-muted text-center text-muted-foreground">
        No content selected
      </div>
    );
  }

  // Render video content
  if (contentItem.type === 'video' && contentItem.videoDetails) {
    const videoData = {
      videoId: contentItem.videoDetails.youtubeVideoId,
      title: contentItem.title,
      url: contentItem.videoDetails.url,
      thumbnailUrl: contentItem.videoDetails.thumbnailUrl,
      durationInSeconds: contentItem.videoDetails.durationInSeconds,
      notes: contentItem.videoDetails.notes,
      quiz: contentItem.videoDetails.quiz,
      transcript: contentItem.videoDetails.transcript,
    };

    return <VideoPlayer video={videoData} isPlayerVisible={isPlayerVisible} />;
  }

  // Render text content
  if (contentItem.type === 'text' && contentItem.textContent) {
    return (
      <Card className="w-full h-full overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">{contentItem.title}</h2>
            <div 
              className="prose prose-sm dark:prose-invert max-w-none leading-relaxed tiptap"
              dangerouslySetInnerHTML={{ __html: contentItem.textContent }}
            />
          </div>
        </ScrollArea>
      </Card>
    );
  }

  // Fallback for unsupported content types
  return (
    <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-muted text-center text-muted-foreground">
      <div>
        <p className="text-lg font-medium">Content type not supported yet</p>
        <p className="text-sm mt-2">Type: {contentItem.type}</p>
      </div>
    </div>
  );
}
