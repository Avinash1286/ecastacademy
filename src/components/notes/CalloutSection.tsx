// UPDATED: Imported CircleDot and removed Info
import { Lightbulb, CircleDot, FileText, AlertTriangle } from 'lucide-react'; 
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface CalloutSectionProps {
  type: 'tip' | 'example' | 'note' | 'common-mistake';
  title?: string;
  content: string;
  bullets?: string[];
}

const calloutConfig = {
  tip: {
    icon: Lightbulb,
    title: 'Tip',
    className: 'bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800',
    headerClassName: 'text-purple-700 dark:text-purple-300',
    contentClassName: 'text-purple-800 dark:text-purple-200',
  },
  example: {
    // --- UPDATED: Icon is now CircleDot to look like a radio button ---
    icon: CircleDot, 
    title: 'Example',
    className: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800',
    headerClassName: 'text-green-700 dark:text-green-300',
    contentClassName: 'text-green-800 dark:text-green-200',
  },
  note: {
    icon: FileText,
    title: 'Note',
    className: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800',
    headerClassName: 'text-green-700 dark:text-green-300',
    contentClassName: 'text-green-800 dark:text-green-200',
  },
  'common-mistake': {
    icon: AlertTriangle,
    title: 'Common Mistake',
    className: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800',
    headerClassName: 'text-red-700 dark:text-red-300',
    contentClassName: 'text-red-800 dark:text-red-200',
  },
};

export function CalloutSection({ type, title, content, bullets }: CalloutSectionProps) {
  const config = calloutConfig[type];
  const Icon = config.icon;
  const displayTitle = title || config.title;

  return (
    <Card className={cn("my-6 p-4 border-l-4", config.className)}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <Icon className={cn("w-5 h-5", config.headerClassName)} />
        <h4 className={cn("font-semibold", config.headerClassName)}>
          {displayTitle}
        </h4>
      </div>
      
      {/* Content and Bullets Container */}
      <div className="pl-[32px] pt-2"> 
        <p className={cn("leading-relaxed", config.contentClassName)}>
          {content}
        </p>
        
        {bullets && bullets.length > 0 && (
          <ul className={cn("mt-3 space-y-1 list-none p-0", config.contentClassName)}>
            {bullets.map((bullet, index) => (
              <li key={index} className="flex items-start gap-2.5">
                <div className="w-3.5 h-3.5 mt-1 flex-shrink-0 rounded-full bg-current opacity-60" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}