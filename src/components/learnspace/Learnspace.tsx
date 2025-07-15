'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { VideoPlayerPanel } from '@/components/learnspace/video-player-panel';
import { AiTutorPanel } from '@/components/learnspace/ai-tutor-panel';
import { ChapterWithVideo } from '@/lib/types';
import { LearnspaceNavbar } from '@/components/learnspace/learnspace-navbar';
import { useIsMobile } from '@/hooks/use-mobile';

interface LearnspaceProps {
  initialChapters: ChapterWithVideo[];
}

const getInitialChapter = (chapters: ChapterWithVideo[], chapterIdFromUrl: string | null) => {
  if (chapterIdFromUrl) {
    const foundChapter = chapters.find(c => c.id === chapterIdFromUrl);
    if (foundChapter) return foundChapter;
  }
  return chapters[0];
}

export default function Learnspace({ initialChapters }: LearnspaceProps) {
  const searchParams = useSearchParams();
  const chapterIdFromUrl = searchParams.get('chapter');
  
  const [activeChapter, setActiveChapter] = useState<ChapterWithVideo>(
    () => getInitialChapter(initialChapters, chapterIdFromUrl)
  );
  
  const isMobile = useIsMobile();
  const [isLeftPanelVisible, setIsLeftPanelVisible] = useState(true);
  const [isRightPanelVisible, setIsRightPanelVisible] = useState(!isMobile);

  useEffect(() => {
    setIsRightPanelVisible(!isMobile);
    if (!isMobile) {
      setIsLeftPanelVisible(true);
    }
  }, [isMobile]);

  const toggleLeftPanel = () => {
    setIsLeftPanelVisible(prevState => !prevState);
  };
  const toggleRightPanel = () => {
    setIsRightPanelVisible(prevState => !prevState);
  };

  useEffect(() => {
    const chapterId = searchParams.get('chapter');
    if (chapterId && chapterId !== activeChapter.id) {
        const newChapter = initialChapters.find(c => c.id === chapterId);
        if (newChapter) setActiveChapter(newChapter);
    }
  }, [searchParams, activeChapter.id, initialChapters]);

  const handleChapterSelect = (chapter: ChapterWithVideo) => {
    setActiveChapter(chapter);
    window.history.pushState(null, '', `?chapter=${chapter.id}`);
  };

  const courseTitle = initialChapters[0]?.course.name || "Course";

  return (
    <main className="h-full w-full flex flex-col overflow-hidden bg-black">
      <LearnspaceNavbar courseTitle={courseTitle} />
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
            <ResizablePanel 
              defaultSize={isRightPanelVisible ? 58 : 100} 
              minSize={30} 
              className={!isLeftPanelVisible ? "hidden" : ""}
            >
              <VideoPlayerPanel
                chapters={initialChapters}
                activeChapter={activeChapter}
                onChapterSelect={handleChapterSelect}
                isMobile={isMobile}
                showRightPanel={isRightPanelVisible}
                onToggleRightPanel={toggleRightPanel}
              />
            </ResizablePanel>
          
          
          {isLeftPanelVisible && isRightPanelVisible && <ResizableHandle withHandle />}
          
          {isRightPanelVisible && (
            <ResizablePanel defaultSize={isLeftPanelVisible ? 42 : 100} minSize={33}>
              <AiTutorPanel 
                activeChapter={activeChapter}
                isLeftPanelVisible={isLeftPanelVisible} 
                onToggleLeftPanel={toggleLeftPanel}
              />
            </ResizablePanel>
          )}
        </ResizablePanelGroup>
      </div>
    </main>
  );
}