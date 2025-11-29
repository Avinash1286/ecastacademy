'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { VideoPlayerPanel } from '@/components/learnspace/video-player-panel';
import { AiTutorPanel } from '@/components/learnspace/ai-tutor-panel';
import { ChapterWithVideo, ContentItem, InteractiveNotesProps, Quiz } from '@/lib/types';
import { LearnspaceNavbar } from '@/components/learnspace/learnspace-navbar';
import { useIsMobile } from '@/hooks/use-mobile';
import { Id } from '../../../convex/_generated/dataModel';

interface LearnspaceProps {
  initialChapters: ChapterWithVideo[];
  courseId: string;
  isCertification?: boolean;
}

const getInitialChapter = (chapters: ChapterWithVideo[], chapterIdFromUrl: string | null) => {
  if (chapterIdFromUrl) {
    const foundChapter = chapters.find(c => c.id === chapterIdFromUrl);
    if (foundChapter) return foundChapter;
  }
  return chapters[0];
}

export default function Learnspace({ initialChapters, courseId, isCertification }: LearnspaceProps) {
  const searchParams = useSearchParams();
  const chapterIdFromUrl = searchParams.get('chapter');
  
  const chapters = initialChapters;
  const [activeChapter, setActiveChapter] = useState<ChapterWithVideo>(
    () => getInitialChapter(initialChapters, chapterIdFromUrl)
  );
  const [activeContentItem, setActiveContentItem] = useState<ContentItem | null>(null);
  const skipAutoSelectRef = useRef(false);
  
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
      // Guard against null course
      if (!activeChapter.course?.id) {
        console.error("Cannot fetch chapter details: course ID is missing");
        setIsContentLoading(false);
        return;
      }

      // Fetch with timeout (15 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(
        `/api/courses/${activeChapter.course.id}/chapters/${chapterId}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to fetch chapter details:", response.status, errorText);
        throw new Error(`Failed to fetch chapter details: ${response.status}`);
      }
      const details: { notes: InteractiveNotesProps; quiz: Quiz; transcript: string | null } = await response.json();
      
      setActiveChapter(prev => ({
        ...prev,
        video: prev.video ? {
          ...prev.video,
          notes: details.notes,
          quiz: details.quiz,
          transcript: details.transcript,
        } : null
      }));
    } catch (error) {
      console.error("Error fetching chapter details:", error);
      // Show user-friendly error for timeout
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn("Request timed out - data may load on retry");
      }
    } finally {
      setIsContentLoading(false);
    }
  }, [activeChapter.course]);

  useEffect(() => {
    fetchChapterDetails(activeChapter.id);
  }, [activeChapter.id, fetchChapterDetails]); 

  // Initialize activeContentItem when activeChapter changes
  useEffect(() => {
    // Skip auto-select if manually selecting content items
    if (skipAutoSelectRef.current) {
      skipAutoSelectRef.current = false;
      return;
    }
    
    // If the chapter has contentItems, select the first one
    if (activeChapter.contentItems && activeChapter.contentItems.length > 0) {
      setActiveContentItem(activeChapter.contentItems[0]);
    } else {
      // If using old system (no contentItems), clear activeContentItem
      setActiveContentItem(null);
    }
  }, [activeChapter.id, activeChapter.contentItems]); 

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

  const handleContentItemSelect = (chapter: ChapterWithVideo, contentItem: ContentItem) => {
    // If it's a resource, open it in a new tab instead
    if (contentItem.type === 'resource' && contentItem.resourceUrl) {
      window.open(contentItem.resourceUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    
    // Set ref to skip auto-selection if changing chapters
    if (chapter.id !== activeChapter.id) {
      skipAutoSelectRef.current = true;
    }
    
    setActiveChapter(chapter);
    setActiveContentItem(contentItem);
    
    // Fetch chapter details if it's a video content item
    if (contentItem.type === 'video') {
      fetchChapterDetails(chapter.id);
    }
    
    // Update URL with both chapter and content item
    window.history.pushState(null, '', `?chapter=${chapter.id}&content=${contentItem.id}`);
  };

  const courseTitle = initialChapters[0]?.course.name || "Course";

  return (
    <main className="h-full w-full flex flex-col overflow-hidden bg-black">
      <LearnspaceNavbar 
        courseTitle={courseTitle} 
        courseId={courseId as Id<"courses">}
        isCertification={isCertification}
      />
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
                activeContentItem={activeContentItem}
                onChapterSelect={handleChapterSelect}
                onContentItemSelect={handleContentItemSelect}
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
                  activeContentItem={activeContentItem}
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