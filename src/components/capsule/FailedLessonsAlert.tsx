'use client';

import { useState, useEffect } from 'react';
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
  regenerationStatus?: 'idle' | 'pending' | 'regenerating' | 'completed' | 'failed';
}

interface FailedLessonsAlertProps {
  failedLessons: FailedLesson[];
  onDismiss?: () => void;
}

/**
 * Alert component that displays when a capsule has lessons that failed to generate.
 * Provides options to regenerate individual lessons or all failed lessons at once.
 * Regeneration happens in the background - even if user leaves, it will complete.
 */
export function FailedLessonsAlert({ 
  failedLessons, 
  onDismiss 
}: FailedLessonsAlertProps) {
  const [isRegeneratingAll, setIsRegeneratingAll] = useState(false);
  const [scheduledLessons, setScheduledLessons] = useState<Set<string>>(new Set());
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const regenerateLesson = useAction(api.capsuleGeneration.regenerateLesson);

  // Check for any lessons that are currently regenerating (from real-time data)
  const regeneratingLessons = failedLessons.filter(
    l => l.regenerationStatus === 'pending' || l.regenerationStatus === 'regenerating'
  );
  const hasRegeneratingLessons = regeneratingLessons.length > 0;

  // Show success toast when a lesson completes regeneration
  useEffect(() => {
    failedLessons.forEach(lesson => {
      if (lesson.regenerationStatus === 'completed' && scheduledLessons.has(lesson._id)) {
        toast.success(`"${lesson.title}" regenerated successfully! Refresh to see changes.`);
        setScheduledLessons(prev => {
          const next = new Set(prev);
          next.delete(lesson._id);
          return next;
        });
      } else if (lesson.regenerationStatus === 'failed' && scheduledLessons.has(lesson._id)) {
        toast.error(`Failed to regenerate "${lesson.title}". Please try again.`);
        setScheduledLessons(prev => {
          const next = new Set(prev);
          next.delete(lesson._id);
          return next;
        });
      }
    });
  }, [failedLessons, scheduledLessons]);

  // Filter out successfully regenerated lessons
  const activefailedLessons = failedLessons.filter(
    l => l.regenerationStatus !== 'completed'
  );

  if (isDismissed || activefailedLessons.length === 0) {
    return null;
  }

  const handleRegenerateOne = async (lesson: FailedLesson) => {
    setScheduledLessons(prev => new Set(prev).add(lesson._id));
    
    try {
      await regenerateLesson({ lessonId: lesson._id });
      toast.info(`"${lesson.title}" is being regenerated in the background. You can continue browsing.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start regeneration';
      toast.error(`Failed to regenerate "${lesson.title}": ${message}`);
      setScheduledLessons(prev => {
        const next = new Set(prev);
        next.delete(lesson._id);
        return next;
      });
    }
  };

  const handleRegenerateAll = async () => {
    setIsRegeneratingAll(true);
    
    let scheduledCount = 0;
    let failCount = 0;
    
    for (const lesson of activefailedLessons) {
      // Skip if already regenerating
      if (lesson.regenerationStatus === 'pending' || lesson.regenerationStatus === 'regenerating') {
        continue;
      }
      
      try {
        setScheduledLessons(prev => new Set(prev).add(lesson._id));
        await regenerateLesson({ lessonId: lesson._id });
        scheduledCount++;
      } catch {
        failCount++;
        setScheduledLessons(prev => {
          const next = new Set(prev);
          next.delete(lesson._id);
          return next;
        });
      }
    }
    
    setIsRegeneratingAll(false);
    
    if (failCount === 0 && scheduledCount > 0) {
      toast.info(`${scheduledCount} lesson${scheduledCount > 1 ? 's are' : ' is'} being regenerated in the background.`);
    } else if (scheduledCount === 0 && failCount > 0) {
      toast.error(`Failed to start regeneration for ${failCount} lesson${failCount > 1 ? 's' : ''}`);
    } else if (scheduledCount > 0 && failCount > 0) {
      toast.warning(`Started ${scheduledCount}, failed to start ${failCount}`);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  const isLessonRegenerating = (lesson: FailedLesson) => {
    return lesson.regenerationStatus === 'pending' || 
           lesson.regenerationStatus === 'regenerating' ||
           scheduledLessons.has(lesson._id);
  };

  return (
    <Alert variant="destructive" className="relative mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        <span>
          {activefailedLessons.length} lesson{activefailedLessons.length > 1 ? 's' : ''} failed to generate
          {hasRegeneratingLessons && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({regeneratingLessons.length} regenerating...)
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerateAll}
            disabled={isRegeneratingAll || hasRegeneratingLessons}
            className="h-7 text-xs"
          >
            {isRegeneratingAll || hasRegeneratingLessons ? (
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
          {hasRegeneratingLessons && (
            <span className="block mt-1 text-xs text-muted-foreground">
              💡 Regeneration runs in the background - you can leave this page and it will complete.
            </span>
          )}
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
              Show {activefailedLessons.length} failed lesson{activefailedLessons.length > 1 ? 's' : ''}
            </>
          )}
        </Button>
        
        {isExpanded && (
          <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
            {activefailedLessons.map((lesson) => (
              <li 
                key={lesson._id}
                className="flex items-center justify-between text-xs bg-background/50 rounded px-2 py-1"
              >
                <span>
                  <span className="text-muted-foreground">
                    {lesson.moduleTitle} &gt;{' '}
                  </span>
                  {lesson.title}
                  {isLessonRegenerating(lesson) && (
                    <span className="ml-1 text-primary">(regenerating...)</span>
                  )}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-2 text-xs"
                  onClick={() => handleRegenerateOne(lesson)}
                  disabled={isLessonRegenerating(lesson) || isRegeneratingAll}
                >
                  {isLessonRegenerating(lesson) ? (
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
 * Validate if lesson content has the correct structure for rendering
 * Returns true if content is valid, false if it needs regeneration
 */
function isValidLessonContent(content: Record<string, unknown> | null, type?: string): boolean {
  if (!content) return false;
  
  // Check for _generationFailed flag
  if (content._generationFailed === true) return false;
  
  // Check for failure patterns
  const sections = content.sections as Array<{ content?: string; keyPoints?: string[] }> | undefined;
  if (sections && sections.length === 1) {
    const section = sections[0];
    const hasFailureMessage = typeof section.content === 'string' && 
      section.content.includes('could not be generated');
    const hasFailureKeyPoint = Array.isArray(section.keyPoints) && 
      section.keyPoints.includes('Content generation failed');
    if (hasFailureMessage || hasFailureKeyPoint) return false;
  }
  
  // Check for wrong schema (old lesson regeneration format)
  // These fields indicate the content was generated with the wrong prompt
  const hasWrongSchema = (
    (content.hook !== undefined || content.keyTakeaways !== undefined || content.practiceExercise !== undefined) &&
    !Array.isArray(content.sections)
  );
  if (hasWrongSchema) return false;
  
  // Validate based on lesson type
  const lessonType = type || 'mixed';
  switch (lessonType) {
    case 'concept':
      return !!content.explanation && content.explanation !== 'undefined';
    case 'mcq':
      return !!content.question && Array.isArray(content.options);
    case 'fillBlanks':
      return !!(content.text ?? content.sentence) && Array.isArray(content.blanks);
    case 'dragDrop':
      return Array.isArray(content.items) && Array.isArray(content.targets);
    case 'simulation':
      return !!content.code;
    case 'mixed':
      // Mixed type should have sections array
      // Also accept if it has practiceQuestions (for quiz-only lessons)
      return Array.isArray(content.sections) || 
             Array.isArray(content.practiceQuestions) ||
             (!!content.explanation && typeof content.explanation === 'string' && content.explanation.length > 50);
    default:
      // For unknown types, check for common valid structures
      return Array.isArray(content.sections) || 
             !!content.explanation || 
             Array.isArray(content.practiceQuestions);
  }
}

/**
 * Helper function to detect failed lessons from capsule content
 * Checks for:
 * 1. _generationFailed metadata flag
 * 2. Fallback content patterns (error messages)
 * 3. Invalid/wrong JSON schema that won't render correctly
 */
export function detectFailedLessons(
  modules: Array<{
    _id: Id<'capsuleModules'>;
    title: string;
    lessons: Array<{
      _id: Id<'capsuleLessons'>;
      title: string;
      type?: string;
      content: unknown;
      regenerationStatus?: 'idle' | 'pending' | 'regenerating' | 'completed' | 'failed';
    }>;
  }>
): FailedLesson[] {
  const failedLessons: FailedLesson[] = [];
  
  modules.forEach((module, moduleIndex) => {
    module.lessons.forEach((lesson, lessonIndex) => {
      const content = lesson.content as Record<string, unknown> | null;
      
      // Use comprehensive validation
      if (!isValidLessonContent(content, lesson.type)) {
        failedLessons.push({
          _id: lesson._id,
          title: lesson.title,
          moduleTitle: module.title,
          moduleIndex,
          lessonIndex,
          regenerationStatus: lesson.regenerationStatus,
        });
      }
    });
  });
  
  return failedLessons;
}
