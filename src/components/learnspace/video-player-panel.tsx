'use client';

import { useState } from 'react';
import { ChapterWithVideo, ContentItem } from '@/lib/types';
import { ContentRenderer } from '@/components/learnspace/content-renderer-panel';
import { ChapterContentList } from '@/components/learnspace/chapter-content-list';

type VideoPlayerPanelProps = {
  chapters: ChapterWithVideo[];
  activeChapter: ChapterWithVideo;
  activeContentItem: ContentItem | null;
  onChapterSelect: (chapter: ChapterWithVideo) => void;
  onContentItemSelect: (chapter: ChapterWithVideo, contentItem: ContentItem) => void;
  isMobile: boolean;
  showRightPanel: boolean;
  onToggleRightPanel: () => void;
};

export function VideoPlayerPanel({ 
  chapters, 
  activeChapter, 
  activeContentItem,
  onChapterSelect,
  onContentItemSelect,
  isMobile,
  showRightPanel,
  onToggleRightPanel,
}: VideoPlayerPanelProps) {
  const [isPlayerVisible, setIsPlayerVisible] = useState(true);

  const handleTogglePlayer = () => {
    setIsPlayerVisible((prev) => !prev);
  };

  // Check if current content is text type
  const isTextContent = activeContentItem?.type === 'text';

  // Get the current video ID to use as a stable key
  const currentVideoId = activeContentItem?.type === 'video' 
    ? activeContentItem.videoDetails?.youtubeVideoId 
    : activeChapter?.video?.videoId;

  return (
    <div className="flex h-full flex-col gap-4 p-4 bg-background">
      {/* Only show video player if not text content - use CSS visibility to preserve playback state */}
      {!isTextContent && (
        <div 
          className={!isPlayerVisible ? 'hidden' : ''}
          // Use video ID as key to prevent unnecessary remounts when toggling visibility
          // Only remount when the actual video changes
        >
          <ContentRenderer 
            key={currentVideoId || 'no-video'}
            contentItem={activeContentItem} 
            fallbackVideo={activeChapter?.video || null}
          />
        </div>
      )}
      <div className="flex-1 min-h-0">
        <ChapterContentList
          chapters={chapters}
          activeChapterId={activeChapter.id}
          activeContentItemId={activeContentItem?.id}
          onChapterSelect={onChapterSelect}
          onContentItemSelect={onContentItemSelect}
          onHide={handleTogglePlayer}
          isPlayerVisible={isPlayerVisible}
          isMobile={isMobile}
          showRightPanel={showRightPanel}
          onToggleRightPanel={onToggleRightPanel}
        />
      </div>
    </div>
  );
}