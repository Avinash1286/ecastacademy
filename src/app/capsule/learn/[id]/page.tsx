"use client";

import { useState, use, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, ShieldAlert, RefreshCw, Loader2, Volume2, VolumeX } from 'lucide-react';
import { Id } from '../../../../../convex/_generated/dataModel';
import { buildProgressByLesson, countCompletedLessons, getLessonProgress } from '@/lib/capsuleProgress';
import { toast } from 'sonner';

import { ConceptLesson } from '@/components/capsule/ConceptLesson';
import { SimulationLesson } from '@/components/capsule/SimulationLesson';
import { MixedLesson } from '@/components/capsule/MixedLesson';
import { ConfettiCelebration } from '@/components/ui/ConfettiCelebration';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { FailedLessonsAlert, detectFailedLessons } from '@/components/capsule/FailedLessonsAlert';

// Typed quiz answer imports
import type {
  QuizAnswer,
  MixedLessonProgressState,
} from '../../../../../shared/quiz/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CapsuleLearnPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const capsuleId = resolvedParams.id as Id<'capsules'>;
  const router = useRouter();
  const { data: session, status } = useSession();
  const userId = session?.user?.id as Id<'users'> | undefined;
  const isAuthenticated = status === 'authenticated' && !!userId;

  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showCourseCompleteConfetti, setShowCourseCompleteConfetti] = useState(false);
  const hasShownCelebration = useRef(false);
  const { playCorrectSound, isMuted, toggleMute } = useSoundEffects();

  // Fetch capsule with access control - pass userId for ownership check
  // Public capsules are viewable by anyone, private only by owner
  const capsuleData = useQuery(
    api.capsules.getCapsuleWithContent,
    { capsuleId, userId: userId || undefined }
  );

  const userProgress = useQuery(
    api.capsules.getCapsuleProgress,
    isAuthenticated && userId ? { userId, capsuleId } : 'skip'
  );

  // Compute current lesson ID safely for the typed progress query
  // This must be computed before any early returns to maintain hook order
  const currentLessonId = capsuleData?.modules?.[currentModuleIndex]?.lessons?.[currentLessonIndex]?._id;

  // Query typed progress for the current lesson (must be before early returns)
  const typedProgress = useQuery(
    api.capsules.getTypedLessonProgress,
    isAuthenticated && userId && currentLessonId
      ? { userId, lessonId: currentLessonId }
      : 'skip'
  );

  const progressByLesson = useMemo(
    () => buildProgressByLesson(userProgress ?? undefined),
    [userProgress]
  );

  const updateProgress = useMutation(api.capsules.updateLessonProgress);
  const updateTypedProgress = useMutation(api.capsules.updateTypedLessonProgress);
  const updateMixedNavigation = useMutation(api.capsules.updateMixedLessonNavigation);
  const regenerateLesson = useAction(api.capsuleGeneration.regenerateLesson);

  // Calculate progress (safe for early returns)
  const totalLessonsCount = capsuleData?.modules?.reduce((acc, m) => acc + m.lessons.length, 0) || 0;
  const completedLessonsCount = countCompletedLessons(progressByLesson);
  const progressPercentageValue = totalLessonsCount > 0 ? (completedLessonsCount / totalLessonsCount) * 100 : 0;

  // Compute current module/lesson safely (needed for callbacks)
  const currentModule = capsuleData?.modules?.[currentModuleIndex];
  const currentLesson = currentModule?.lessons?.[currentLessonIndex];
  const currentModuleId = currentModule?._id;

  // Handler for typed quiz answers (MCQ, FillBlanks, DragDrop) - must be before early returns
  const handleTypedQuizAnswer = useCallback(async (answer: QuizAnswer) => {
    if (!currentLessonId || !userId || !currentModuleId) return;

    try {
      await updateTypedProgress({
        userId,
        capsuleId,
        moduleId: currentModuleId,
        lessonId: currentLessonId,
        typedAnswer: answer,
        completed: true,
        maxScore: currentLesson?.maxPoints,
      });
    } catch (error) {
      console.error('Error updating typed progress:', error);
    }
  }, [currentLessonId, userId, capsuleId, currentModuleId, currentLesson?.maxPoints, updateTypedProgress]);

  // Handler for mixed lesson typed answers - must be before early returns
  const handleMixedTypedAnswer = useCallback(async (data: {
    type: 'mixed';
    lessonId: string;
    questionStates: Array<{
      questionIndex: number;
      questionType: 'mcq' | 'fillBlanks' | 'dragDrop';
      answered: boolean;
      answer?: QuizAnswer;
    }>;
    allQuestionsAnswered: boolean;
    currentQuestionIndex: number;
    overallScore: number;
    timestamp: number;
    timeSpentMs?: number;
  }) => {
    if (!currentLessonId || !userId || !currentModuleId) return;

    try {
      // Extract the last answered question's answer for typedLastAnswer
      const lastAnsweredState = data.questionStates
        .filter(s => s.answered && s.answer)
        .pop();

      await updateTypedProgress({
        userId,
        capsuleId,
        moduleId: currentModuleId,
        lessonId: currentLessonId,
        typedAnswer: lastAnsweredState?.answer,
        completed: data.allQuestionsAnswered,
        maxScore: currentLesson?.maxPoints,
        mixedLessonProgress: {
          currentQuestionIndex: data.currentQuestionIndex,
          questionStates: data.questionStates,
          allQuestionsAnswered: data.allQuestionsAnswered,
        },
      });
    } catch (error) {
      console.error('Error updating mixed lesson progress:', error);
    }
  }, [currentLessonId, userId, capsuleId, currentModuleId, currentLesson?.maxPoints, updateTypedProgress]);

  // Handler for mixed lesson navigation (lightweight update) - must be before early returns
  const handleMixedNavigation = useCallback(async (questionIndex: number) => {
    if (!currentLessonId || !userId) return;

    try {
      await updateMixedNavigation({
        userId,
        lessonId: currentLessonId,
        currentQuestionIndex: questionIndex,
      });
    } catch (error) {
      console.error('Error updating navigation:', error);
    }
  }, [currentLessonId, userId, updateMixedNavigation]);

  // Celebrate when course reaches 100% completion
  useEffect(() => {
    if (progressPercentageValue === 100 && !hasShownCelebration.current && totalLessonsCount > 0) {
      hasShownCelebration.current = true;
      playCorrectSound();
      setShowCourseCompleteConfetti(true);
      toast.success('🎉 Congratulations! You completed the course!');
    }
  }, [progressPercentageValue, playCorrectSound, totalLessonsCount]);

  // Check if this is a public capsule that non-owner can view
  const isPublicCapsule = capsuleData?.isPublic === true;
  const isOwner = capsuleData?.isOwner === true;

  // For private capsules, require authentication
  if (!isAuthenticated && status !== 'loading' && !isPublicCapsule) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <ShieldAlert className="h-10 w-10 text-amber-500 mx-auto" />
            <h2 className="text-2xl font-semibold">Sign in required</h2>
            <p className="text-muted-foreground">
              Please sign in to continue learning this capsule and track your progress.
            </p>
            <Button onClick={() => router.push('/auth/signin')} className="w-full gap-2">
              Go to sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!capsuleData) {
    return <LoadingSkeleton />;
  }

  if (!capsuleData.modules || capsuleData.modules.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-2">No Content Yet</h2>
            <p className="text-muted-foreground">
              This capsule is still being generated. Please check back soon!
            </p>
            <Button onClick={() => router.push('/dashboard/capsule')} className="mt-4">
              Back to Capsule Studio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Detect failed lessons for the alert
  const failedLessons = detectFailedLessons(capsuleData.modules);

  // Re-assign with non-null assertion since we're past the early returns
  const safeCurrentModule = capsuleData.modules[currentModuleIndex];
  const safeCurrentLesson = safeCurrentModule?.lessons[currentLessonIndex];
  const progressPercentage = progressPercentageValue;

  // Get current lesson progress
  const currentLessonProgress = getLessonProgress(progressByLesson, safeCurrentLesson?._id);
  const isLessonCompleted = currentLessonProgress?.completed || false;

  const handleLessonComplete = async (score?: number, quizAnswer?: {
    selectedAnswer: string;
    selectedIndex?: number;
    correctAnswer?: string;
    correctIndex?: number;
    isCorrect: boolean;
    options?: string[];
  }) => {
    if (!safeCurrentLesson || !userId) return;

    try {
      await updateProgress({
        userId,
        capsuleId,
        moduleId: safeCurrentModule._id,
        lessonId: safeCurrentLesson._id,
        completed: true,
        score,
        maxScore: safeCurrentLesson.maxPoints,
        quizAnswer,
      });
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  // Handler for tracking hints used
  const handleHintUsed = async () => {
    if (!safeCurrentLesson || !userId) return;

    try {
      await updateProgress({
        userId,
        capsuleId,
        moduleId: safeCurrentModule._id,
        lessonId: safeCurrentLesson._id,
        completed: false,
        hintsUsed: 1,
      });
    } catch (error) {
      console.error('Error tracking hint:', error);
    }
  };

  const handleNext = () => {
    if (currentLessonIndex < safeCurrentModule.lessons.length - 1) {
      setCurrentLessonIndex(currentLessonIndex + 1);
    } else if (currentModuleIndex < capsuleData.modules.length - 1) {
      setCurrentModuleIndex(currentModuleIndex + 1);
      setCurrentLessonIndex(0);
    }
    // Scroll to top when navigating to next lesson
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrevious = () => {
    if (currentLessonIndex > 0) {
      setCurrentLessonIndex(currentLessonIndex - 1);
    } else if (currentModuleIndex > 0) {
      const prevModule = capsuleData.modules[currentModuleIndex - 1];
      setCurrentModuleIndex(currentModuleIndex - 1);
      setCurrentLessonIndex(prevModule.lessons.length - 1);
    }
    // Scroll to top when navigating to previous lesson
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Scroll to top when lesson selection changes via sidebar
  const handleLessonSelect = (moduleIndex: number, lessonIndex: number) => {
    setCurrentModuleIndex(moduleIndex);
    setCurrentLessonIndex(lessonIndex);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isFirstLesson = currentModuleIndex === 0 && currentLessonIndex === 0;
  const isLastLesson =
    currentModuleIndex === capsuleData.modules.length - 1 &&
    currentLessonIndex === safeCurrentModule.lessons.length - 1;

  return (
    <>
      <ConfettiCelebration 
        show={showCourseCompleteConfetti} 
        onComplete={() => setShowCourseCompleteConfetti(false)} 
        duration={5000}
      />
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card sticky top-0 z-10">
          <div className="container mx-auto max-w-5xl py-4 px-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="text-2xl font-bold">{capsuleData.title}</h1>
                <p className="text-sm text-muted-foreground">
                  Module {currentModuleIndex + 1}: {safeCurrentModule.title}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={toggleMute}
                  title={isMuted ? "Unmute sounds" : "Mute sounds"}
                >
                  {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </Button>
                <Button variant="ghost" onClick={() => router.push('/dashboard/capsule')}>
                  Exit
                </Button>
              </div>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
        </div>

        {/* Sign in prompt for non-authenticated users viewing public capsules */}
        {!isAuthenticated && isPublicCapsule && (
          <div className="border-b bg-amber-500/10 border-amber-500/20">
            <div className="container mx-auto max-w-5xl py-3 px-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>Sign in to track your progress and save your answers</span>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  className="shrink-0 border-amber-500/50 hover:bg-amber-500/10"
                  onClick={() => router.push('/auth/signin')}
                >
                  Sign in
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="container mx-auto max-w-5xl py-8 px-4">
          {/* Failed lessons alert */}
          {failedLessons.length > 0 && (
            <FailedLessonsAlert failedLessons={failedLessons} />
          )}
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1">
              <Card className="sticky top-24">
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3">Modules</h3>
                  <div className="space-y-2">
                    {capsuleData.modules.map((module, mIndex) => (
                      <div key={module._id}>
                        <button
                          onClick={() => handleLessonSelect(mIndex, 0)}
                          className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${mIndex === currentModuleIndex
                            ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                          }`}
                      >
                        {mIndex + 1}. {module.title}
                      </button>
                      {mIndex === currentModuleIndex && (
                        <div className="ml-4 mt-1 space-y-1">
                          {module.lessons.map((lesson, lIndex) => {
                            const lessonProgress = progressByLesson.get(lesson._id);
                            const isLessonCompleted = lessonProgress?.completed ?? false;
                            return (
                              <button
                                key={lesson._id}
                                onClick={() => handleLessonSelect(mIndex, lIndex)}
                                className={`w-full text-left px-2 py-1 rounded text-xs flex items-center gap-2 transition-colors ${lIndex === currentLessonIndex
                                  ? 'bg-primary/20 text-primary'
                                  : 'hover:bg-muted text-muted-foreground'
                                  }`}
                              >
                                {isLessonCompleted ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Circle className="h-4 w-4" />
                                )}
                                {lesson.title}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3 space-y-6">
            <div>
              <h2 className="text-3xl font-bold mb-2">{safeCurrentLesson?.title}</h2>
              {safeCurrentLesson?.description && (
                <p className="text-muted-foreground">{safeCurrentLesson.description}</p>
              )}
            </div>

            {safeCurrentLesson && (
              <div>
                {(() => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const validateContent = (type: string, content: any) => {
                    if (!content) return false;
                    switch (type) {
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
                        // Mixed type has sections array or other flexible structure
                        return Array.isArray(content.sections) || 
                               Array.isArray(content.practiceQuestions) ||
                               !!content.explanation;
                      default:
                        // For unknown types, check if there's any content structure
                        return Array.isArray(content.sections) || 
                               !!content.explanation || 
                               Array.isArray(content.practiceQuestions);
                    }
                  };

                  const isValid = validateContent(safeCurrentLesson.type, safeCurrentLesson.content);

                  // Handler for regenerating failed content
                  const handleRegenerate = async () => {
                    if (!safeCurrentLesson._id) return;
                    
                    setIsRegenerating(true);
                    try {
                      await regenerateLesson({ lessonId: safeCurrentLesson._id });
                      toast.success('Lesson regenerated successfully!');
                    } catch (error) {
                      const message = error instanceof Error ? error.message : 'Failed to regenerate lesson';
                      toast.error(message);
                    } finally {
                      setIsRegenerating(false);
                    }
                  };

                  if (!isValid) {
                    return (
                      <div className="p-8 border rounded-lg bg-muted/20 text-center space-y-4">
                        <div className="text-muted-foreground">
                          <p className="text-lg font-medium mb-1">Content for this lesson is not available.</p>
                          <p className="text-sm">
                            This might have happened due to an AI generation error. 
                            You can try regenerating this lesson.
                          </p>
                        </div>
                        <Button 
                          onClick={handleRegenerate} 
                          disabled={isRegenerating}
                          className="gap-2"
                        >
                          {isRegenerating ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Regenerating...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4" />
                              Regenerate Lesson
                            </>
                          )}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          (Error: Content type mismatch or missing data)
                        </p>
                      </div>
                    );
                  }

                  return (
                    <>
                      {safeCurrentLesson.type === 'concept' && (
                        <ConceptLesson 
                          {...safeCurrentLesson.content} 
                          onComplete={() => handleLessonComplete()} 
                          isCompleted={isLessonCompleted}
                        />
                      )}
                      {safeCurrentLesson.type === 'simulation' && (
                        <SimulationLesson {...safeCurrentLesson.content} onComplete={() => handleLessonComplete()} />
                      )}
                      {safeCurrentLesson.type === 'mixed' && (
                        <MixedLesson
                          key={`${currentModuleIndex}-${currentLessonIndex}`}
                          {...safeCurrentLesson.content}
                          lessonId={currentLessonId}
                          onComplete={(score) => handleLessonComplete(score ?? 100)}
                          onQuizAnswer={(data) => handleLessonComplete(data.isCorrect ? 100 : 0, {
                            selectedAnswer: data.selectedAnswer,
                            selectedIndex: data.selectedIndex,
                            correctAnswer: data.correctAnswer,
                            correctIndex: data.correctIndex,
                            isCorrect: data.isCorrect,
                            options: data.options,
                          })}
                          onTypedAnswer={handleMixedTypedAnswer}
                          onNavigationChange={handleMixedNavigation}
                          isCompleted={isLessonCompleted}
                          lastAnswer={currentLessonProgress?.lastAnswer ? {
                            selectedIndex: currentLessonProgress.lastAnswer.selectedIndex,
                            isCorrect: currentLessonProgress.lastAnswer.isCorrect,
                          } : undefined}
                          typedProgress={typedProgress?.mixedLessonProgress as MixedLessonProgressState | undefined}
                        />
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            <div className="flex justify-between items-center pt-6">
              <Button variant="outline" onClick={handlePrevious} disabled={isFirstLesson} className="gap-2">
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>

              {isLastLesson ? (
                <Button onClick={() => router.push('/dashboard/capsule')} className="gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Complete Capsule
                </Button>
              ) : (
                <Button onClick={handleNext} className="gap-2">
                  Continue
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto max-w-5xl py-4 px-4">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-48 mb-3" />
          <Skeleton className="h-2 w-full" />
        </div>
      </div>
      <div className="container mx-auto max-w-5xl py-8 px-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <Skeleton className="h-96 w-full" />
          </div>
          <div className="lg:col-span-3 space-y-4">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
