import { Lightbulb, CircleDot, FileText, AlertTriangle, Zap, Sparkles } from 'lucide-react'; 
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface CalloutSectionProps {
  type: 'tip' | 'example' | 'note' | 'common-mistake' | 'insight' | 'important' | 'warning';
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
    icon: CircleDot, 
    title: 'Example',
    className: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800',
    headerClassName: 'text-green-700 dark:text-green-300',
    contentClassName: 'text-green-800 dark:text-green-200',
  },
  note: {
    icon: FileText,
    title: 'Note',
    className: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800',
    headerClassName: 'text-blue-700 dark:text-blue-300',
    contentClassName: 'text-blue-800 dark:text-blue-200',
  },
  'common-mistake': {
    icon: AlertTriangle,
    title: 'Common Mistake',
    className: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800',
    headerClassName: 'text-red-700 dark:text-red-300',
    contentClassName: 'text-red-800 dark:text-red-200',
  },
  insight: {
    icon: Sparkles,
    title: 'Insight',
    className: 'bg-cyan-50 border-cyan-200 dark:bg-cyan-950/30 dark:border-cyan-800',
    headerClassName: 'text-cyan-700 dark:text-cyan-300',
    contentClassName: 'text-cyan-800 dark:text-cyan-200',
  },
  important: {
    icon: Zap,
    title: 'Important',
    className: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800',
    headerClassName: 'text-yellow-700 dark:text-yellow-300',
    contentClassName: 'text-yellow-800 dark:text-yellow-200',
  },
  warning: {
    icon: AlertTriangle,
    title: 'Warning',
    className: 'bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800',
    headerClassName: 'text-orange-700 dark:text-orange-300',
    contentClassName: 'text-orange-800 dark:text-orange-200',
  },
};

export function CalloutSection({ type, title, content, bullets }: CalloutSectionProps) {
  const config = calloutConfig[type];

  if (!config) {
    console.warn(`Invalid callout type received: "${type}". Skipping render.`);
    return null;
  }

  const Icon = config.icon;
  const displayTitle = title || config.title;

  return (
    <Card className={cn("my-6 p-4 border-l-4", config.className)}>
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-current/10 p-1">
          <Icon className={cn("w-6 h-6 drop-shadow-sm", config.headerClassName)} />
        </div>
        <h4 className={cn("font-semibold", config.headerClassName)}>
          {displayTitle}
        </h4>
      </div>
      
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