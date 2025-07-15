import { Button } from '@/components/ui/button';
import { BookOpen, ChevronDown, ChevronUp, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { ChapterWithVideo } from '@/lib/types';
import { cn } from '@/lib/utils';

type VideoChaptersProps = {
  chapters: ChapterWithVideo[];
  activeChapterId: string;
  onChapterSelect: (chapter: ChapterWithVideo) => void;
  onHide: () => void;
  isPlayerVisible: boolean;
  isMobile: boolean;
  showRightPanel: boolean;
  onToggleRightPanel: () => void;
};

export function VideoChapters({ 
  chapters, 
  activeChapterId, 
  onChapterSelect, 
  onHide, 
  isPlayerVisible,
  isMobile,
  showRightPanel,
  onToggleRightPanel
}: VideoChaptersProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-200">
          <BookOpen size={20} />
          Chapters
        </h2>
        <div className="flex items-center">
          <Button 
            type="button" 
            variant="ghost" 
            size="icon" 
            aria-label="Toggle player visibility" 
            onClick={onHide}
          >
            {isPlayerVisible ?<ChevronUp className="h-5 w-5" />:  <ChevronDown className="h-5 w-5" />  }
          </Button>

          {isMobile && (
            <Button 
              type="button" 
              variant="ghost" 
              size="icon" 
              aria-label="Toggle AI Tutor panel" 
              onClick={onToggleRightPanel}
            >
              {showRightPanel ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto pr-2">
        <div className="space-y-2">
          {chapters.map((chapter) => (
            <div
              key={chapter.id}
              onClick={() => onChapterSelect(chapter)}
              className={cn(
                "p-3 rounded-md bg-zinc-800/50 cursor-pointer hover:bg-zinc-700 transition-colors border border-transparent",
                chapter.id === activeChapterId && "bg-zinc-700/80 border-teal-500/50"
              )}
            >
              <p className="text-xs text-zinc-400">Chapter {chapter.order}</p>
              <h3 className="font-semibold text-white">{chapter.name}</h3>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}