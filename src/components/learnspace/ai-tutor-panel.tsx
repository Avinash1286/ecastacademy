'use client';
import { useState } from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { TutorHeader } from '@/components/learnspace/tutor-header';
import { ChatPanel } from '@/components/learnspace/chat-panel';
import { NotesPanel } from '@/components/learnspace/notes-panel';
import { QuizzesPanel } from '@/components/learnspace/quizzes-panel';
import { ChapterWithVideo, ContentItem, InteractiveNotesProps, Quiz } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface AiTutorPanelProps {
  activeChapter: ChapterWithVideo;
  activeContentItem?: ContentItem | null;
  isLeftPanelVisible: boolean;
  onToggleLeftPanel: () => void;
}

export function AiTutorPanel({ activeChapter, activeContentItem, isLeftPanelVisible, onToggleLeftPanel }: AiTutorPanelProps) {
  const [activeTab, setActiveTab] = useState('notes');
  const isTextContent = Boolean(
    activeContentItem && activeContentItem.type === 'text' && activeContentItem.textContent
  );

  const textQuiz = isTextContent ? activeContentItem?.textQuiz ?? null : null;

  let notes: InteractiveNotesProps | null = null;
  let quiz: Quiz | null = null;

  if (!isTextContent) {
    if (activeContentItem && activeContentItem.type === 'video' && activeContentItem.videoDetails) {
      notes = activeContentItem.videoDetails.notes ?? null;
      quiz = activeContentItem.videoDetails.quiz ?? null;
    } else if (activeChapter.video) {
      notes = activeChapter.video.notes ?? null;
      quiz = activeChapter.video.quiz ?? null;
    }
  }

  const hasVideoForChat = !isTextContent && Boolean(
    (activeContentItem?.type === 'video' && activeContentItem.videoDetails) || activeChapter.video
  );

  const tabClass = (tab: string) =>
    cn(
      'absolute inset-0 h-full w-full transition-opacity duration-150',
      activeTab === tab ? 'opacity-100 pointer-events-auto' : 'pointer-events-none opacity-0'
    );

  const chatContent = (() => {
    if (isTextContent) {
      return (
        <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
          <div>
            <p className="text-lg font-medium">Not available for text content</p>
            <p className="mt-2 text-sm">Switch to Notes or Quizzes tab.</p>
          </div>
        </div>
      );
    }

    if (!hasVideoForChat) {
      return (
        <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
          <div>
            <p className="text-lg font-medium">No content available</p>
            <p className="mt-2 text-sm">Please select a chapter with supported video content.</p>
          </div>
        </div>
      );
    }

    return (
      <ChatPanel
        activeChapter={activeChapter}
        activeContentItem={activeContentItem}
      />
    );
  })();

  const notesContent = (() => {
    if (isTextContent && activeContentItem?.textContent) {
      return (
        <ScrollArea className="h-full">
          <div className="p-6">
            <h2 className="mb-4 text-2xl font-bold">{activeContentItem.title}</h2>
            <div
              className="prose prose-sm dark:prose-invert tiptap max-w-none"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(activeContentItem.textContent) }}
            />
          </div>
        </ScrollArea>
      );
    }

    if (notes) {
      return (
        <div className="h-full overflow-y-auto">
          <NotesPanel notes={notes} />
        </div>
      );
    }

    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
        <div>
          <p className="text-lg font-medium">No notes available</p>
          <p className="mt-2 text-sm">This chapter doesn&apos;t have generated notes yet.</p>
        </div>
      </div>
    );
  })();

  // Get course passing grade for quiz fallback
  const coursePassingGrade = activeChapter.course?.passingGrade;

  const quizzesContent = (() => {
    if (isTextContent) {
      if (textQuiz) {
        return <QuizzesPanel questions={textQuiz} contentItem={activeContentItem} coursePassingGrade={coursePassingGrade} />;
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

    if (quiz) {
      return <QuizzesPanel questions={quiz} contentItem={activeContentItem} coursePassingGrade={coursePassingGrade} />;
    }

    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
        <div>
          <p className="text-lg font-medium">No quiz available</p>
          <p className="mt-2 text-sm">This chapter doesn&apos;t have generated quizzes yet.</p>
        </div>
      </div>
    );
  })();

  return (
    <div className="flex h-full flex-col bg-card text-card-foreground">
      <TutorHeader
        isLeftPanelVisible={isLeftPanelVisible}
        onToggleLeftPanel={onToggleLeftPanel}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <div className="relative flex-1 overflow-hidden">
        <div className={tabClass('chat')} aria-hidden={activeTab !== 'chat'}>
          {chatContent}
        </div>
        <div className={tabClass('notes')} aria-hidden={activeTab !== 'notes'}>
          {notesContent}
        </div>
        <div className={tabClass('quizzes')} aria-hidden={activeTab !== 'quizzes'}>
          {quizzesContent}
        </div>
      </div>
    </div>
  );
}