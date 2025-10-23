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

  return (
    <div className="flex h-full flex-col gap-4 p-4 bg-background">
      {/* Only show video player if not text content */}
      {!isTextContent && (
        <div className={!isPlayerVisible ? 'hidden' : ''}>
          <ContentRenderer 
            contentItem={activeContentItem} 
            fallbackVideo={activeChapter?.video || null}
            isPlayerVisible={isPlayerVisible}
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