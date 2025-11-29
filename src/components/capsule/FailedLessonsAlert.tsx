'use client';

import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Loader2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { toast } from 'sonner';

interface FailedLesson {
  _id: Id<'capsuleLessons'>;
  title: string;
  moduleTitle: string;
  moduleIndex: number;
  lessonIndex: number;
}

interface FailedLessonsAlertProps {
  failedLessons: FailedLesson[];
  onDismiss?: () => void;
}

/**
 * Alert component that displays when a capsule has lessons that failed to generate.
 * Provides options to regenerate individual lessons or all failed lessons at once.
 */
export function FailedLessonsAlert({ 
  failedLessons, 
  onDismiss 
}: FailedLessonsAlertProps) {
  const [isRegeneratingAll, setIsRegeneratingAll] = useState(false);
  const [regeneratingLessons, setRegeneratingLessons] = useState<Set<string>>(new Set());
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const regenerateLesson = useAction(api.capsuleGeneration.regenerateLesson);

  if (isDismissed || failedLessons.length === 0) {
    return null;
  }

  const handleRegenerateOne = async (lesson: FailedLesson) => {
    setRegeneratingLessons(prev => new Set(prev).add(lesson._id));
    
    try {
      await regenerateLesson({ lessonId: lesson._id });
      toast.success(`"${lesson.title}" regenerated successfully!`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Regeneration failed';
      toast.error(`Failed to regenerate "${lesson.title}": ${message}`);
    } finally {
      setRegeneratingLessons(prev => {
        const next = new Set(prev);
        next.delete(lesson._id);
        return next;
      });
    }
  };

  const handleRegenerateAll = async () => {
    setIsRegeneratingAll(true);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const lesson of failedLessons) {
      try {
        await regenerateLesson({ lessonId: lesson._id });
        successCount++;
      } catch {
        failCount++;
      }
    }
    
    setIsRegeneratingAll(false);
    
    if (failCount === 0) {
      toast.success(`All ${successCount} lessons regenerated successfully!`);
    } else if (successCount === 0) {
      toast.error(`Failed to regenerate all ${failCount} lessons`);
    } else {
      toast.warning(`Regenerated ${successCount} lessons, ${failCount} failed`);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  return (
    <Alert variant="destructive" className="relative mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        <span>
          {failedLessons.length} lesson{failedLessons.length > 1 ? 's' : ''} failed to generate
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerateAll}
            disabled={isRegeneratingAll || regeneratingLessons.size > 0}
            className="h-7 text-xs"
          >
            {isRegeneratingAll ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3 mr-1" />
                Regenerate All
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </AlertTitle>
      <AlertDescription>
        <p className="text-sm mb-2">
          Some lessons could not be generated due to AI errors. You can continue learning,
          but these lessons will show placeholder content.
        </p>
        
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-3 w-3 mr-1" />
              Hide details
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3 mr-1" />
              Show {failedLessons.length} failed lesson{failedLessons.length > 1 ? 's' : ''}
            </>
          )}
        </Button>
        
        {isExpanded && (
          <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
            {failedLessons.map((lesson) => (
              <li 
                key={lesson._id}
                className="flex items-center justify-between text-xs bg-background/50 rounded px-2 py-1"
              >
                <span>
                  <span className="text-muted-foreground">
                    {lesson.moduleTitle} &gt;{' '}
                  </span>
                  {lesson.title}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-2 text-xs"
                  onClick={() => handleRegenerateOne(lesson)}
                  disabled={regeneratingLessons.has(lesson._id) || isRegeneratingAll}
                >
                  {regeneratingLessons.has(lesson._id) ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Helper function to detect failed lessons from capsule content
 * Checks for the _generationFailed metadata flag in lesson content
 */
export function detectFailedLessons(
  modules: Array<{
    _id: Id<'capsuleModules'>;
    title: string;
    lessons: Array<{
      _id: Id<'capsuleLessons'>;
      title: string;
      content: unknown;
    }>;
  }>
): FailedLesson[] {
  const failedLessons: FailedLesson[] = [];
  
  modules.forEach((module, moduleIndex) => {
    module.lessons.forEach((lesson, lessonIndex) => {
      const content = lesson.content as Record<string, unknown> | null;
      
      // Check for _generationFailed metadata flag
      if (content && content._generationFailed === true) {
        failedLessons.push({
          _id: lesson._id,
          title: lesson.title,
          moduleTitle: module.title,
          moduleIndex,
          lessonIndex,
        });
      }
    });
  });
  
  return failedLessons;
}
