'use client';

import { useState, useEffect, useCallback } from 'react';
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
  
  const [chapters, setChapters] = useState(initialChapters);
  const [activeChapter, setActiveChapter] = useState<ChapterWithVideo>(
    () => getInitialChapter(initialChapters, chapterIdFromUrl)
  );
  
  const isMobile = useIsMobile();
  const [isLeftPanelVisible, setIsLeftPanelVisible] = useState(true);
  const [isRightPanelVisible, setIsRightPanelVisible] = useState(!isMobile);
  const [isContentLoading, setIsContentLoading] = useState(true);

  useEffect(() => {
    setIsRightPanelVisible(!isMobile); 
    if (!isMobile) {
      setIsLeftPanelVisible(true);
    }
  }, [isMobile]); 


  const fetchChapterDetails = useCallback(async (chapterId: string) => {
    setIsContentLoading(true);
    try {
      const response = await fetch(`/api/courses/${activeChapter.course.id}/chapters/${chapterId}`);
      if (!response.ok) throw new Error("Failed to fetch chapter details");
      const details: { notes: any; quiz: any; transcript: string | null } = await response.json();
      
      setActiveChapter(prev => ({
        ...prev,
        video: {
          ...prev.video,
          notes: details.notes,
          quiz: details.quiz,
          transcript: details.transcript,
        }
      }));
    } catch (error) {
      console.error("Error fetching chapter details:", error);
    } finally {
      setIsContentLoading(false);
    }
  }, [activeChapter.course.id]);

  useEffect(() => {
    fetchChapterDetails(activeChapter.id);
  }, []); 

  const toggleLeftPanel = () => {
    setIsLeftPanelVisible(prevState => !prevState);
  };
  const toggleRightPanel = () => {
    setIsRightPanelVisible(prevState => !prevState);
  };

  const handleChapterSelect = (chapter: ChapterWithVideo) => {
    setActiveChapter(chapter);
    fetchChapterDetails(chapter.id);
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
                chapters={chapters}
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
              {isContentLoading ? (
                <div className="flex h-full items-center justify-center bg-[#1C1C1C]">
                  <p className="text-zinc-400">Loading notes...</p>
                </div>
              ) : (
                <AiTutorPanel 
                  activeChapter={activeChapter}
                  isLeftPanelVisible={isLeftPanelVisible} 
                  onToggleLeftPanel={toggleLeftPanel}
                />
              )}
            </ResizablePanel>
          )}
        </ResizablePanelGroup>
      </div>
    </main>
  );
}