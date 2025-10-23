import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  BookOpen, 
  ChevronDown, 
  ChevronUp, 
  ChevronRight,
  PanelRightClose, 
  PanelRightOpen,
  Video,
  FileText,
  PlayCircle,
  ExternalLink
} from 'lucide-react';
import { ChapterWithVideo, ContentItem } from '@/lib/types';
import { cn } from '@/lib/utils';

type ChapterContentListProps = {
  chapters: ChapterWithVideo[];
  activeChapterId: string;
  activeContentItemId?: string | null;
  onChapterSelect: (chapter: ChapterWithVideo) => void;
  onContentItemSelect?: (chapter: ChapterWithVideo, contentItem: ContentItem) => void;
  onHide: () => void;
  isPlayerVisible: boolean;
  isMobile: boolean;
  showRightPanel: boolean;
  onToggleRightPanel: () => void;
};

export function ChapterContentList({ 
  chapters, 
  activeChapterId,
  activeContentItemId,
  onChapterSelect, 
  onContentItemSelect,
  onHide, 
  isPlayerVisible,
  isMobile,
  showRightPanel,
  onToggleRightPanel
}: ChapterContentListProps) {
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(
    new Set([activeChapterId])
  );

  const toggleChapter = (chapterId: string, chapter: ChapterWithVideo) => {
    // If chapter has no content items (old system), just select it
    if (!chapter.contentItems || chapter.contentItems.length === 0) {
      onChapterSelect(chapter);
      return;
    }
    
    // Otherwise, toggle expansion
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  };

  const handleContentItemClick = (chapter: ChapterWithVideo, item: ContentItem) => {
    if (onContentItemSelect) {
      onContentItemSelect(chapter, item);
    }
  };

  const getContentIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Video className="w-4 h-4" />;
      case 'text':
        return <FileText className="w-4 h-4" />;
      case 'resource':
        return <ExternalLink className="w-4 h-4" />;
      default:
        return <PlayCircle className="w-4 h-4" />;
    }
  };

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
          {chapters.map((chapter) => {
            const isExpanded = expandedChapters.has(chapter.id);
            const hasContentItems = chapter.contentItems && chapter.contentItems.length > 0;

            return (
              <div key={chapter.id} className="space-y-1">
                {/* Chapter Header - Only toggles expand/collapse */}
                <div
                  onClick={() => toggleChapter(chapter.id, chapter)}
                  className={cn(
                    "cursor-pointer rounded-lg border p-3 transition-colors flex items-center justify-between",
                    "border-transparent bg-muted/50 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Chapter {chapter.order}</p>
                    <h3 className="font-semibold">{chapter.name}</h3>
                  </div>
                  {hasContentItems && (
                    <ChevronRight 
                      className={cn(
                        "w-5 h-5 transition-transform",
                        isExpanded && "rotate-90"
                      )} 
                    />
                  )}
                </div>

                {/* Content Items */}
                {hasContentItems && isExpanded && (
                  <div className="ml-4 space-y-1">
                    {chapter.contentItems!.map((item) => {
                      const isActiveItem = activeContentItemId === item.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleContentItemClick(chapter, item)}
                          className={cn(
                            "cursor-pointer rounded-md border p-2 transition-colors flex items-center gap-2",
                            "border-transparent hover:bg-accent/70",
                            isActiveItem 
                              ? "bg-secondary/30 text-white border-secondary" 
                              : "bg-muted/30 text-muted-foreground"
                          )}
                        >
                          <div className="flex-shrink-0">
                            {getContentIcon(item.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.title}</p>
                            <p className="text-xs opacity-70 capitalize">{item.type}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
