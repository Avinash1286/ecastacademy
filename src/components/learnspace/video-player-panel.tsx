'use client';

import { useState } from 'react';
import { ChapterWithVideo } from '@/lib/types';
import { VideoPlayer } from '@/components/learnspace/video-player';
import { VideoChapters } from '@/components/learnspace/video-chapters';

type VideoPlayerPanelProps = {
  chapters: ChapterWithVideo[];
  activeChapter: ChapterWithVideo;
  onChapterSelect: (chapter: ChapterWithVideo) => void;
  isMobile: boolean;
  showRightPanel: boolean;
  onToggleRightPanel: () => void;
};

export function VideoPlayerPanel({ 
  chapters, 
  activeChapter, 
  onChapterSelect, 
  isMobile,
  showRightPanel,
  onToggleRightPanel,
}: VideoPlayerPanelProps) {
  const [isPlayerVisible, setIsPlayerVisible] = useState(true);

  const handleTogglePlayer = () => {
    setIsPlayerVisible((prev) => !prev);
  };

  return (
    <div className="flex h-full flex-col gap-4 p-4 bg-[#181818]">
      <div className={!isPlayerVisible ? 'hidden' : ''}>
        <VideoPlayer key={activeChapter.id} video={activeChapter.video} />
      </div>
      <div className="flex-1 min-h-0">
        <VideoChapters
          chapters={chapters}
          activeChapterId={activeChapter.id}
          onChapterSelect={onChapterSelect}
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