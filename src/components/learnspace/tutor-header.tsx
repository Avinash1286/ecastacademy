'use client';
import { Button } from '@/components/ui/button';
import { FileQuestion, MessageCircle, StickyNote, ArrowLeft } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'quizzes', label: 'Quizzes', icon: FileQuestion },
  // { id: 'resources', label: 'Resources', icon: Library },
];

interface TutorHeaderProps {
  isLeftPanelVisible: boolean;
  onToggleLeftPanel: () => void;
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function TutorHeader({ 
  isLeftPanelVisible, 
  onToggleLeftPanel, 
  activeTab, 
  onTabChange 
}: TutorHeaderProps) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border p-2 sm:gap-4">
      <Button type="button" variant="ghost" size="icon" aria-label="Toggle panel" onClick={onToggleLeftPanel}>
        <ArrowLeft className={`h-5 w-5 transform transition-transform ${isLeftPanelVisible ? '' : 'rotate-180'}`} />
      </Button>

      <div className="flex w-full justify-between gap-2">
      {NAV_ITEMS.map((item) => (
        <Button
          key={item.id}
          type="button"
          variant={activeTab === item.id ? 'secondary' : 'ghost'}
          onClick={() => onTabChange(item.id)}
          className="flex-1 justify-center gap-2 sm:flex-initial"
          aria-current={activeTab === item.id ? 'page' : undefined}
        >
          <item.icon className="h-4 w-4" />
          <span className="hidden sm:inline">{item.label}</span>
        </Button>
      ))}
      </div>
    </div>
  );
}