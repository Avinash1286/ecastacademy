import { Lightbulb, Zap, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils'; // Make sure to import your 'cn' utility

interface HighlightBoxProps {
  type: 'insight' | 'important' | 'warning';
  title?: string;
  content: string;
}

// Centralized configuration for styles makes it easy to maintain and extend
const highlightStyles = {
  insight: {
    icon: Lightbulb,
    containerClasses: 'bg-accent/10 border-accent/20',
    iconClasses: 'text-accent',
    titleClasses: 'text-accent-foreground dark:text-accent',
  },
  important: {
    icon: Zap,
    containerClasses: 'bg-yellow-400/10 border-yellow-400/20',
    iconClasses: 'text-yellow-500 dark:text-yellow-400',
    titleClasses: 'text-yellow-800 dark:text-yellow-300',
  },
  warning: {
    icon: AlertTriangle,
    containerClasses: 'bg-destructive/10 border-destructive/20',
    iconClasses: 'text-destructive',
    titleClasses: 'text-destructive-foreground dark:text-destructive',
  },
};

export function HighlightBox({ type, title, content }: HighlightBoxProps) {
  const styles = highlightStyles[type];
  const Icon = styles.icon;

  return (
    <div
      className={cn(
        'my-5 flex items-start gap-4 rounded-lg border p-4',
        styles.containerClasses
      )}
    >
      <div className="mt-0.5">
        <Icon className={cn('h-5 w-5 flex-shrink-0', styles.iconClasses)} />
      </div>
      <div className="flex-1">
        {title && (
          <h4 className={cn('mb-1 font-semibold', styles.titleClasses)}>
            {title}
          </h4>
        )}
        <p className="text-sm text-foreground/80 leading-relaxed">{content}</p>
      </div>
    </div>
  );
}