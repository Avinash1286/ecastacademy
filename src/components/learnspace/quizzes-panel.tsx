"use client";
import { useEffect, useState, useMemo } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '../../../convex/_generated/api';
import { QuizInterface } from '../quiz/QuizInterface';
import { QuizResults } from '../quiz/QuizResults';
import { SecureQuiz, Quiz, ContentItem, QuizQuestionResult } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Id } from '../../../convex/_generated/dataModel';

// Extend session user type to include id
interface ExtendedUser {
  id: Id<"users">
  name?: string | null
  email?: string | null
  image?: string | null
}

// Helper function to strip correct answers from quiz for secure display
function toSecureQuiz(quiz: Quiz | null | undefined): SecureQuiz | null {
  if (!quiz || !quiz.topic || !quiz.questions) return null;
  return {
    topic: quiz.topic,
    questions: quiz.questions.map(q => ({
      question: q.question,
      options: q.options,
      // Explicitly exclude correct, correctIndex, and explanation
    })),
  };
}

export function QuizzesPanel({
  questions,
  contentItem
}: {
  questions: Quiz | null | undefined;
  contentItem?: ContentItem | null;
}) {
  const [currentView, setCurrentView] = useState<'quiz' | 'results'>('quiz');
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [showPreviousAttempt, setShowPreviousAttempt] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationResults, setValidationResults] = useState<QuizQuestionResult[] | undefined>(undefined);

  const { data: session } = useAuth();
  const sessionUser = session?.user as unknown as ExtendedUser | undefined;
  
  // Use the new secure validation mutation
  const validateQuizAnswers = useMutation(api.completions.validateQuizAnswers);

  // Fetch attempt history for ALL quizzes (not just graded)
  const userId = sessionUser?.id;
  const attemptHistory = useQuery(
    api.completions.getQuizAttemptHistory,
    contentItem?.id && userId
      ? {
        userId,
        contentItemId: contentItem.id as Id<"contentItems">
      }
      : "skip"
  );

  // Get the latest attempt's answers for validation query
  const latestAttemptAnswers = attemptHistory && attemptHistory.length > 0 && attemptHistory[0].answers
    ? attemptHistory[0].answers as number[]
    : null;

  // Fetch validation results for previous attempts (re-validates stored answers)
  const previousValidationResults = useQuery(
    api.completions.getQuizValidationResults,
    contentItem?.id && latestAttemptAnswers
      ? {
          contentItemId: contentItem.id as Id<"contentItems">,
          answers: latestAttemptAnswers,
        }
      : "skip"
  );

  // Convert to secure quiz (strips correct answers)
  const secureQuiz = useMemo(() => toSecureQuiz(questions), [questions]);

  useEffect(() => {
    // Check if questions has the required structure
    if (secureQuiz) {
      // Check if user has previous attempts - show results by default
      if (attemptHistory && attemptHistory.length > 0) {
        const latestAttempt = attemptHistory[0]; // Already sorted by _creationTime desc

        // Only show previous results if we have answers stored
        if (latestAttempt.answers && Array.isArray(latestAttempt.answers) && latestAttempt.answers.length > 0) {
          setUserAnswers(latestAttempt.answers as number[]);
          setScore(latestAttempt.score);
          setCurrentView('results');
          setShowPreviousAttempt(true);
          // Use previous validation results if available
          if (previousValidationResults) {
            setValidationResults(previousValidationResults);
          }
        } else {
          // Has attempts but no answers stored - show quiz (old data)
          setCurrentView('quiz');
          setUserAnswers([]);
          setScore(0);
          setShowPreviousAttempt(false);
          setValidationResults(undefined);
        }
      } else {
        // No previous attempts - show quiz
        setCurrentView('quiz');
        setUserAnswers([]);
        setScore(0);
        setShowPreviousAttempt(false);
        setValidationResults(undefined);
      }
    }
  }, [secureQuiz, attemptHistory, previousValidationResults]);

  const handleQuizComplete = async (answers: number[]) => {
    setIsSubmitting(true);
    setShowPreviousAttempt(false); // This is a new attempt

    // Verify user is authenticated
    const userId = sessionUser?.id;

    if (!userId) {
      console.error('User not authenticated');
      setIsSubmitting(false);
      return;
    }

    if (!contentItem?.id) {
      console.error('Content item ID is missing');
      setIsSubmitting(false);
      return;
    }

    try {
      // Validate answers on the server - this is where scoring happens
      const result = await validateQuizAnswers({
        userId: userId as Id<"users">,
        contentItemId: contentItem.id as Id<"contentItems">,
        answers,
      });

      // Update state with server-validated results
      setUserAnswers(answers);
      setScore(result.score);
      setValidationResults(result.results);
      setCurrentView('results');
    } catch (error) {
      console.error('Error validating quiz:', error instanceof Error ? error.message : 'Unknown error');
      // Show error state or fallback
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestart = () => {
    setCurrentView('quiz');
    setUserAnswers([]);
    setScore(0);
    setShowPreviousAttempt(false);
    setValidationResults(undefined);
  };


  return (
    <ScrollArea className="h-full w-full">
      <div className="p-2 sm:p-4 overflow-x-hidden">
        {currentView === 'quiz' && secureQuiz && (
          <QuizInterface
            quiz={secureQuiz}
            onQuizComplete={handleQuizComplete}
            contentItem={contentItem}
            isSubmitting={isSubmitting}
          />
        )}
        {currentView === 'results' && secureQuiz && (
          <QuizResults
            quiz={secureQuiz}
            userAnswers={userAnswers}
            score={score}
            validationResults={validationResults}
            onRestart={handleRestart}
            contentItem={contentItem}
            attemptHistory={attemptHistory || []}
            isPreviousAttempt={showPreviousAttempt}
          />
        )}
        {!secureQuiz && (
          <div className="text-center text-muted-foreground p-8">
            No quiz available for this chapter yet.
          </div>
        )}
      </div>
    </ScrollArea>
  );
};