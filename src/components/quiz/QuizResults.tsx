import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Trophy, RotateCcw, CheckCircle, XCircle } from 'lucide-react';
import { cn } from "@/lib/utils";
import { QuizResultsProps } from '@/lib/types';

export const QuizResults = ({ quiz, userAnswers, score, onRestart }: QuizResultsProps) => {
  const percentage = Math.round((score / quiz.questions.length) * 100);
  
  const getScoreColor = () => {
    if (percentage >= 80) return 'text-chart-4 dark:text-chart-2';
    if (percentage >= 60) return 'text-chart-5 dark:text-chart-3';
    return 'text-destructive';
  };

  const getScoreMessage = () => {
    if (percentage >= 90) return 'Outstanding! 🎉';
    if (percentage >= 80) return 'Great job! 👏';
    if (percentage >= 70) return 'Good work! 👍';
    if (percentage >= 60) return 'Not bad! 🙂';
    return 'Keep practicing! 💪';
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="p-8 text-center shadow-lg">
        <Trophy className="mx-auto mb-4 h-16 w-16 text-chart-5 dark:text-chart-3" />
        <h2 className="mb-2 text-3xl font-bold text-foreground">Quiz Complete!</h2>
        <div className={`mb-2 text-6xl font-bold ${getScoreColor()}`}>
          {score}/{quiz.questions.length}
        </div>
        <p className="mb-4 text-xl text-muted-foreground">{percentage}% Correct</p>
        <p className="text-lg font-semibold text-foreground">{getScoreMessage()}</p>
      </Card>

      <Card className="p-6 shadow-lg">
        <h3 className="mb-6 text-2xl font-bold text-foreground">Review Your Answers</h3>
        <div className="space-y-6">
          {quiz.questions.map((question, index) => {
            const userAnswer = userAnswers[index];
            const isCorrect = userAnswer === question.correct;
            
            return (
              <div key={index} className="border-b border-border pb-6 last:border-b-0">
                <div className="flex items-start space-x-4">
                  {isCorrect ? (
                    <CheckCircle className="mt-1 h-5 w-5 flex-shrink-0 text-chart-4 dark:text-chart-2" />
                  ) : (
                    <XCircle className="mt-1 h-5 w-5 flex-shrink-0 text-destructive" />
                  )}
                  <div className="flex-1 space-y-3">
                    <h4 className="font-semibold text-foreground">
                      {index + 1}. {question.question}
                    </h4>
                    
                    
                    <div className={cn(
                      "rounded-lg border p-3",
                      isCorrect 
                        ? 'border-chart-4/30 bg-chart-4/10 text-chart-4 dark:border-chart-2/30 dark:bg-chart-2/10 dark:text-chart-2' 
                        : 'border-destructive/30 bg-destructive/10 text-destructive'
                    )}>
                      <span className="font-medium">Your answer: </span>
                      <span>
                        {question.options[userAnswer]}
                      </span>
                    </div>
                    
                    
                    {!isCorrect && (
                      <div className="rounded-lg border border-chart-4/30 bg-chart-4/10 p-3 text-chart-4 dark:border-chart-2/30 dark:bg-chart-2/10 dark:text-chart-2">
                        <span className="font-medium">Correct answer: </span>
                        <span>
                          {question.options[question.correct]}
                        </span>
                      </div>
                    )}
                    
                  
                    {question.explanation && (
                      <div className="rounded-lg border border-secondary/30 bg-secondary/10 p-3">
                        <p className="text-sm text-muted-foreground">{question.explanation}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="py-4 text-center">
        <Button onClick={onRestart} size="lg" variant="outline">
          <RotateCcw className="mr-2 h-5 w-5" />
          Restart Quiz
        </Button>
      </div>
    </div>
  );
};