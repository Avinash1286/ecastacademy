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
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
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
            {isPlayerVisible ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
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
                "cursor-pointer rounded-lg border p-3 transition-colors",
                "border-transparent bg-muted/50 text-foreground hover:bg-accent hover:text-accent-foreground",
                chapter.id === activeChapterId && "border-secondary bg-accent text-accent-foreground"
              )}
            >
              <p className="text-xs text-muted-foreground">Chapter {chapter.order}</p>
              <h3 className="font-semibold">{chapter.name}</h3>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}