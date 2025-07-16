// UPDATED: Imported FlaskConical for the example block
import { BookOpen, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DefinitionCardProps {
  term: string;
  definition: string;
  example?: string;
}

export function DefinitionCard({ term, definition, example }: DefinitionCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-6 my-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 bg-primary/10 p-2 rounded-full">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <h3 className="text-lg font-bold text-card-foreground">{term}</h3>
      </div>

      <div className="mt-4 space-y-4 pl-14">
        <p className="text-muted-foreground leading-relaxed">
          {definition}
        </p>

        {example && (
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-green-700 dark:text-green-300" />
              <span className="text-sm font-semibold text-green-700 dark:text-green-300">
                Example
              </span>
            </div>
            <p className="mt-2 pl-6 text-sm text-green-800 dark:text-green-200 italic">
              {example}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}