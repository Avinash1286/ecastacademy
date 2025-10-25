"use client";
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { useSession } from 'next-auth/react';
import { api } from '../../../convex/_generated/api';
import { QuizInterface } from '../quiz/QuizInterface';
import { QuizResults } from '../quiz/QuizResults';
import { Quiz, ContentItem } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Id } from '../../../convex/_generated/dataModel';

// Extend session user type to include id
interface ExtendedUser {
  id: Id<"users">
  name?: string | null
  email?: string | null
  image?: string | null
}

export function QuizzesPanel({ 
  questions, 
  contentItem 
}: { 
  questions: Quiz | null | undefined;
  contentItem?: ContentItem | null;
}) {
  const [currentView, setCurrentView] = useState<'quiz' | 'results'>('quiz');
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [showPreviousAttempt, setShowPreviousAttempt] = useState(false);
  
  const { data: session } = useSession();
  // Use the new unified recordCompletion mutation
  const recordCompletion = useMutation(api.completions.recordCompletion);
  
  // Fetch attempt history for ALL quizzes (not just graded)
  const userId = session?.user ? (session.user as ExtendedUser).id : undefined;
  const attemptHistory = useQuery(
    api.completions.getQuizAttemptHistory,
    contentItem?.id && userId
      ? { 
          userId: userId,
          contentItemId: contentItem.id as Id<"contentItems"> 
        }
      : "skip"
  );

  // Debug logging
  useEffect(() => {
    console.log('QuizzesPanel Debug:', {
      contentItemId: contentItem?.id,
      isGraded: contentItem?.isGraded,
      userId,
      attemptHistory,
      attemptCount: attemptHistory?.length || 0,
      hasSession: !!session
    });
  }, [contentItem, userId, attemptHistory, session]);

  useEffect(() => {
    // Check if questions has the required structure
    if (questions && questions.topic && questions.questions && Array.isArray(questions.questions)) {
      setQuiz(questions);
      
      console.log('Setting quiz view - checking attempts:', {
        hasAttemptHistory: !!attemptHistory,
        attemptCount: attemptHistory?.length || 0,
        latestAttempt: attemptHistory?.[0]
      });
      
      // Check if user has previous attempts - show results by default
      if (attemptHistory && attemptHistory.length > 0) {
        const latestAttempt = attemptHistory[0]; // Already sorted by _creationTime desc
        console.log('Showing previous attempt:', latestAttempt);
        
        // Only show previous results if we have answers stored
        if (latestAttempt.answers && Array.isArray(latestAttempt.answers) && latestAttempt.answers.length > 0) {
          setUserAnswers(latestAttempt.answers as number[]);
          setScore(latestAttempt.score);
          setCurrentView('results');
          setShowPreviousAttempt(true);
        } else {
          // Has attempts but no answers stored - show quiz (old data)
          console.log('Attempt found but no answers - showing quiz');
          setCurrentView('quiz');
          setUserAnswers([]);
          setScore(0);
          setShowPreviousAttempt(false);
        }
      } else {
        // No previous attempts - show quiz
        console.log('No previous attempts - showing quiz');
        setCurrentView('quiz');
        setUserAnswers([]);
        setScore(0);
        setShowPreviousAttempt(false);
      }
    } else {
      setQuiz(null);
    }
  }, [questions, attemptHistory]);
  
  const handleQuizComplete = async (answers: number[], finalScore: number) => {
    setUserAnswers(answers);
    setScore(finalScore);
    setShowPreviousAttempt(false); // This is a new attempt
    
    // Get userId from session
    const userId = session?.user ? (session.user as ExtendedUser).id : undefined;
    
    if (!userId) {
      console.error('User not authenticated');
      setCurrentView('results');
      return;
    }
    
    if (!contentItem?.id) {
      console.error('Content item ID is missing');
      setCurrentView('results');
      return;
    }
    
    try {
      const maxScore = contentItem?.maxPoints || quiz?.questions.length || 100;
      
      console.log('Recording quiz completion:', {
        userId,
        contentItemId: contentItem.id,
        finalScore,
        maxScore,
        percentage: (finalScore / maxScore) * 100,
        isGraded: contentItem?.isGraded
      });
      
      // Use the new unified recordCompletion mutation
      const result = await recordCompletion({
        userId,
        contentItemId: contentItem.id as Id<"contentItems">,
        score: finalScore,
        maxScore,
        answers, // Include answers for quiz attempt record
      });
      
      console.log('Completion recorded:', result);
    } catch (error) {
      console.error('Error submitting quiz:', error);
      // Continue to show results even if submission fails
    } finally {
      setCurrentView('results');
    }
  };

  const handleRestart = () => {
    setCurrentView('quiz');
    setUserAnswers([]);
    setScore(0);
    setShowPreviousAttempt(false);
  };


  return (
    <ScrollArea className="h-full">
    <div className="p-4"> 
      {currentView === 'quiz' && quiz && (
        <QuizInterface
          quiz={quiz}
          onQuizComplete={handleQuizComplete}
          contentItem={contentItem}
        />
      )}
      {currentView === 'results' && quiz && (
        <QuizResults
          quiz={quiz}
          userAnswers={userAnswers}
          score={score}
          onRestart={handleRestart}
          contentItem={contentItem}
          attemptHistory={attemptHistory || []}
          isPreviousAttempt={showPreviousAttempt}
        />
      )}
      {!quiz && (
        <div className="text-center text-muted-foreground p-8">
          No quiz available for this chapter yet.
        </div>
      )}
    </div>
    </ScrollArea>
  );
};