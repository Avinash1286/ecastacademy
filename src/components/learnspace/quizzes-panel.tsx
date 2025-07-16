"use client";
import { useEffect, useState } from 'react';
import { QuizInterface } from '../quiz/QuizInterface';
import { QuizResults } from '../quiz/QuizResults';
import { Quiz } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';


export function QuizzesPanel({ questions }: { questions: any}) {
  const [currentView, setCurrentView] = useState<'quiz' | 'results'>('quiz');
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (questions) {
      setQuiz(questions);
      setCurrentView('quiz');
      setUserAnswers([]);
      setScore(0);
    }
  }, [questions]);
  
  const handleQuizComplete = (answers: number[], finalScore: number) => {
    setUserAnswers(answers);
    setScore(finalScore);
    setCurrentView('results');
  };

  const handleRestart = () => {
    setCurrentView('quiz');
    setUserAnswers([]);
    setScore(0);
  };


  return (
    <ScrollArea className="h-full">
    <div className="p-4"> 
      {currentView === 'quiz' && quiz && (
        <QuizInterface
          quiz={quiz}
          onQuizComplete={handleQuizComplete}
        />
      )}
      {currentView === 'results' && quiz && (
        <QuizResults
          quiz={quiz}
          userAnswers={userAnswers}
          score={score}
          onRestart={handleRestart}
        />
      )}
      {!quiz && (
        <div className="text-center text-muted-foreground p-8">Loading quiz...</div>
      )}
    </div>
    </ScrollArea>
  );
};