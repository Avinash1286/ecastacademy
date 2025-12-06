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
import { ChapterWithVideo, ContentItem } from '@/lib/types';
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
  
  // Store chapters with their loaded content - allows updating individual chapters
  const [chapters, setChapters] = useState<ChapterWithVideo[]>(initialChapters);
  const [activeChapter, setActiveChapter] = useState<ChapterWithVideo>(
    () => getInitialChapter(initialChapters, chapterIdFromUrl)
  );
  const [activeContentItem, setActiveContentItem] = useState<ContentItem | null>(null);
  const skipAutoSelectRef = useRef(false);
  // Track which chapters have been loaded to avoid duplicate fetches
  const loadedChaptersRef = useRef<Set<string>>(new Set(
    initialChapters.filter(ch => ch.isContentLoaded).map(ch => ch.id)
  ));
  
  const isMobile = useIsMobile();
  const [isLeftPanelVisible, setIsLeftPanelVisible] = useState(true);
  const [isRightPanelVisible, setIsRightPanelVisible] = useState(!isMobile);
  const [isContentLoading, setIsContentLoading] = useState(false);

  useEffect(() => {
    setIsRightPanelVisible(!isMobile); 
    if (!isMobile) {
      setIsLeftPanelVisible(true);
    }
  }, [isMobile]); 


  // Fetch chapter content on demand (notes, quiz - but NOT transcript)
  const fetchChapterContent = useCallback(async (chapterId: string) => {
    // Skip if already loaded
    if (loadedChaptersRef.current.has(chapterId)) {
      return;
    }
    
    setIsContentLoading(true);
    try {
      // Guard against null course
      if (!activeChapter.course?.id) {
        console.error("Cannot fetch chapter content: course ID is missing");
        setIsContentLoading(false);
        return;
      }

      // Fetch with timeout (15 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      // Use the on-demand content endpoint
      const response = await fetch(
        `/api/courses/${activeChapter.course.id}/chapters/${chapterId}/content`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to fetch chapter content:", response.status, errorText);
        throw new Error(`Failed to fetch chapter content: ${response.status}`);
      }
      
      const chapterData: ChapterWithVideo = await response.json();
      
      // Mark as loaded
      loadedChaptersRef.current.add(chapterId);
      
      // Update chapters array with loaded content
      setChapters(prev => prev.map(ch => 
        ch.id === chapterId 
          ? { ...chapterData, isContentLoaded: true }
          : ch
      ));
      
      // Update active chapter if it's the one we just loaded
      setActiveChapter(prev => 
        prev.id === chapterId 
          ? { ...chapterData, isContentLoaded: true }
          : prev
      );
      
    } catch (error) {
      console.error("Error fetching chapter content:", error);
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn("Request timed out - data may load on retry");
      }
    } finally {
      setIsContentLoading(false);
    }
  }, [activeChapter.course]);

  // Load content for initial chapter if coming from URL and it's not the first chapter
  useEffect(() => {
    // If the active chapter doesn't have content loaded, fetch it
    if (!activeChapter.isContentLoaded && !loadedChaptersRef.current.has(activeChapter.id)) {
      fetchChapterContent(activeChapter.id);
    }
  }, [activeChapter.id, activeChapter.isContentLoaded, fetchChapterContent]); 

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
    // Get the latest chapter data from our state (may have loaded content)
    const chapterFromState = chapters.find(ch => ch.id === chapter.id) || chapter;
    setActiveChapter(chapterFromState);
    
    // Load content on demand if not already loaded
    if (!chapterFromState.isContentLoaded && !loadedChaptersRef.current.has(chapter.id)) {
      fetchChapterContent(chapter.id);
    }
    
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
    
    // Get the latest chapter data from our state (may have loaded content)
    const chapterFromState = chapters.find(ch => ch.id === chapter.id) || chapter;
    setActiveChapter(chapterFromState);
    setActiveContentItem(contentItem);
    
    // Load content on demand if not already loaded
    if (!chapterFromState.isContentLoaded && !loadedChaptersRef.current.has(chapter.id)) {
      fetchChapterContent(chapter.id);
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
              defaultSize={isRightPanelVisible ? 32 : 100} 
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