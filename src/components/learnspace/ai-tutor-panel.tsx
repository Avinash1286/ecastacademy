'use client';
import { useState } from 'react';
import { TutorHeader } from '@/components/learnspace/tutor-header';
import { TutorInput } from '@/components/learnspace/tutor-input';
import { ChatPanel } from '@/components/learnspace/chat-panel';
import { NotesPanel } from '@/components/learnspace/notes-panel';
import { QuizzesPanel } from '@/components/learnspace/quizzes-panel';
import { ChapterWithVideo } from '@/lib/types';

interface AiTutorPanelProps {
  activeChapter: ChapterWithVideo;
  isLeftPanelVisible: boolean;
  onToggleLeftPanel: () => void;
}

export function AiTutorPanel({ activeChapter, isLeftPanelVisible, onToggleLeftPanel }: AiTutorPanelProps) {
  const [activeTab, setActiveTab] = useState('notes');
  const renderContent = () => {
    switch (activeTab) {
      case 'chat':
        return <ChatPanel />;
      case 'notes':
        return <NotesPanel notes={activeChapter.video.notes}/>;
      case 'quizzes':
        return <QuizzesPanel />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#1C1C1C] text-zinc-300">
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