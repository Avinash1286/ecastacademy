'use client';
import { useState } from 'react';
import { TutorHeader } from '@/components/learnspace/tutor-header';
import { TutorInput } from '@/components/learnspace/tutor-input';
import { ChatPanel } from '@/components/learnspace/chat-panel';
import { NotesPanel } from '@/components/learnspace/notes-panel';
import { QuizzesPanel } from '@/components/learnspace/quizzes-panel';
import { ChapterWithVideo, ContentItem } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AiTutorPanelProps {
  activeChapter: ChapterWithVideo;
  activeContentItem?: ContentItem | null;
  isLeftPanelVisible: boolean;
  onToggleLeftPanel: () => void;
}

export function AiTutorPanel({ activeChapter, activeContentItem, isLeftPanelVisible, onToggleLeftPanel }: AiTutorPanelProps) {
  const [activeTab, setActiveTab] = useState('notes');
  
  const renderContent = () => {
    // Check if active content is text type
    if (activeContentItem && activeContentItem.type === 'text' && activeContentItem.textContent) {
      // Show text content in Notes tab
      if (activeTab === 'notes') {
        return (
          <ScrollArea className="h-full">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4">{activeContentItem.title}</h2>
              <div 
                className="prose prose-sm dark:prose-invert max-w-none tiptap"
                dangerouslySetInnerHTML={{ __html: activeContentItem.textContent }}
              />
            </div>
          </ScrollArea>
        );
      }
      
      // Show quiz for text content if available
      if (activeTab === 'quizzes') {
        const textQuiz = activeContentItem.textQuiz;
        if (textQuiz) {
          return <QuizzesPanel questions={textQuiz} />;
        }
        return (
          <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
            <div>
              <p className="text-lg font-medium">No quiz available</p>
              <p className="mt-2 text-sm">Quiz has not been generated for this content yet.</p>
            </div>
          </div>
        );
      }
      
      // Chat not available for text content
      if (activeTab === 'chat') {
        return (
          <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
            <div>
              <p className="text-lg font-medium">Not available for text content</p>
              <p className="mt-2 text-sm">Switch to Notes or Quizzes tab.</p>
            </div>
          </div>
        );
      }
    }
    
    // Try to get video details from activeContentItem first (new system)
    let notes = null;
    let quiz = null;
    
    if (activeContentItem && activeContentItem.type === 'video' && activeContentItem.videoDetails) {
      notes = activeContentItem.videoDetails.notes;
      quiz = activeContentItem.videoDetails.quiz;
    } else if (activeChapter.video) {
      // Fallback to old system
      notes = activeChapter.video.notes;
      quiz = activeChapter.video.quiz;
    }

    // Handle case where no video content is available
    if (!notes && !quiz) {
      return (
        <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
          <div>
            <p className="text-lg font-medium">No content available</p>
            <p className="mt-2 text-sm">Please select a chapter with video content.</p>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'chat':
        return <ChatPanel />;
      case 'notes':
        return notes ? <NotesPanel notes={notes}/> : null;
      case 'quizzes':
        return quiz ? <QuizzesPanel questions={quiz} /> : null;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full flex-col bg-card text-card-foreground">
      <TutorHeader 
        isLeftPanelVisible={isLeftPanelVisible} 
        onToggleLeftPanel={onToggleLeftPanel} 
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <div className="flex-1 overflow-y-auto">
        {renderContent()}
      </div>
      {activeTab === 'chat' && <TutorInput />}
    </div>
  );
}