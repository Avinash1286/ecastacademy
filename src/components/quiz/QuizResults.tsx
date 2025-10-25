import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, CheckCircle, XCircle, Award, AlertCircle, Clock, TrendingUp, RefreshCw } from 'lucide-react';
import { cn } from "@/lib/utils";
import { QuizResultsProps } from '@/lib/types';

export const QuizResults = ({ 
  quiz, 
  userAnswers, 
  score, 
  onRestart, 
  contentItem, 
  attemptHistory,
  isPreviousAttempt = false 
}: QuizResultsProps & { isPreviousAttempt?: boolean }) => {
  const totalQuestions = quiz.questions.length || 0;
  const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
  
  // Grading information
  const isGraded = contentItem?.isGraded ?? false;
  const passingScore = contentItem?.passingScore ?? 70;
  const passed = percentage >= passingScore;
  const allowRetakes = contentItem?.allowRetakes ?? true;
  
  const getScoreColor = () => {
    if (!isGraded) {
      if (percentage >= 80) return 'text-chart-4 dark:text-chart-2';
      if (percentage >= 60) return 'text-chart-5 dark:text-chart-3';
      return 'text-destructive';
    }
    // For graded quizzes, use pass/fail colors
    return passed ? 'text-green-600 dark:text-green-400' : 'text-destructive';
  };

  const getScoreMessage = () => {
    if (isGraded) {
      if (passed) {
        return percentage >= 90 ? 'Excellent work! 🎉' : 'Well done! 👏';
      } else {
        return allowRetakes 
          ? 'You can retake this quiz to improve your score 💪'
          : 'Keep studying and try again later 📚';
      }
    }
    // Non-graded messages
    if (percentage >= 90) return 'Outstanding! 🎉';
    if (percentage >= 80) return 'Great job! 👏';
    if (percentage >= 70) return 'Good work! 👍';
    if (percentage >= 60) return 'Not bad! 🙂';
    return 'Keep practicing! 💪';
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Show "Previous Attempt" banner if viewing history */}
      {isPreviousAttempt && (
        <Card className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
            <Clock className="h-5 w-5" />
            <p className="font-semibold">
              Viewing your previous attempt
            </p>
          </div>
        </Card>
      )}

      <Card className="p-8 text-center shadow-lg">
        <Trophy className="mx-auto mb-4 h-16 w-16 text-chart-5 dark:text-chart-3" />
        <h2 className="mb-2 text-3xl font-bold text-foreground">
          {isPreviousAttempt ? 'Your Previous Result' : 'Quiz Complete!'}
        </h2>
        <div className={`mb-2 text-6xl font-bold ${getScoreColor()}`}>
          {score}/{quiz.questions.length}
        </div>
        <p className="mb-4 text-xl text-muted-foreground">{percentage}% Correct</p>
        
        {isGraded && (
          <div className="mb-4 flex items-center justify-center gap-2">
            {passed ? (
              <Badge className="bg-green-500 hover:bg-green-600 text-white text-base py-1 px-3">
                <CheckCircle className="h-4 w-4 mr-1" />
                Passed
              </Badge>
            ) : (
              <Badge className="bg-destructive hover:bg-destructive text-white text-base py-1 px-3">
                <AlertCircle className="h-4 w-4 mr-1" />
                Need {passingScore}% to Pass
              </Badge>
            )}
            {isGraded && (
              <Badge variant="outline" className="text-base py-1 px-3">
                <Award className="h-4 w-4 mr-1 text-amber-600" />
                Graded
              </Badge>
            )}
          </div>
        )}
        
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

      {/* Attempt History for Graded Quizzes */}
      {isGraded && attemptHistory && attemptHistory.length > 0 && (
        <Card className="p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-xl font-bold text-foreground">Attempt History</h3>
          </div>
          
          <div className="space-y-3">
            {attemptHistory.map((attempt, index) => {
              const isCurrentAttempt = index === 0; // Most recent is first
              const attemptPassed = attempt.percentage >= passingScore;
              
              return (
                <div 
                  key={attempt._id} 
                  className={cn(
                    "p-4 rounded-lg border",
                    isCurrentAttempt 
                      ? "border-primary bg-primary/5" 
                      : "border-border bg-muted/30"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-muted-foreground">
                          Attempt #{attempt.attemptNumber}
                        </span>
                        {isCurrentAttempt && (
                          <Badge variant="outline" className="text-xs">
                            Latest
                          </Badge>
                        )}
                      </div>
                      <Badge 
                        className={cn(
                          "text-xs",
                          attemptPassed 
                            ? "bg-green-500 hover:bg-green-600 text-white" 
                            : "bg-destructive hover:bg-destructive text-white"
                        )}
                      >
                        {attemptPassed ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                        {attemptPassed ? 'Passed' : 'Failed'}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="flex items-center gap-1">
                          <TrendingUp className={cn(
                            "h-4 w-4",
                            attemptPassed ? "text-green-600" : "text-destructive"
                          )} />
                          <span className={cn(
                            "text-xl font-bold",
                            attemptPassed ? "text-green-600 dark:text-green-400" : "text-destructive"
                          )}>
                            {Math.round(attempt.percentage)}%
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {attempt.score}/{attempt.maxScore} points
                        </p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        {new Date(attempt.completedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {attemptHistory.length > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Best Score:</span>
                <span className="text-lg font-bold text-primary">
                  {Math.max(...attemptHistory.map(a => a.percentage))}%
                </span>
              </div>
            </div>
          )}
        </Card>
      )}

      <div className="py-4 text-center space-y-3">
        {/* Show different button text and state based on quiz type and status */}
        {isGraded ? (
          <>
            {/* Graded Quiz: Check if retakes are allowed */}
            {passed ? (
              <div className="space-y-2">
                <Button 
                  onClick={onRestart} 
                  size="lg" 
                  variant="outline" 
                  className="min-w-[200px]"
                >
                  <RefreshCw className="mr-2 h-5 w-5" />
                  Retake to Improve Score
                </Button>
                <p className="text-xs text-muted-foreground">
                  You&apos;ve already passed, but you can retake to improve your grade
                </p>
              </div>
            ) : (
              <>
                {allowRetakes ? (
                  <div className="space-y-2">
                    <Button 
                      onClick={onRestart} 
                      size="lg" 
                      className="min-w-[200px] bg-amber-600 hover:bg-amber-700"
                    >
                      <RefreshCw className="mr-2 h-5 w-5" />
                      Retake Quiz to Pass
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      You need {passingScore}% or higher to pass this quiz
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Button 
                      size="lg" 
                      variant="outline" 
                      className="min-w-[200px]" 
                      disabled
                    >
                      <AlertCircle className="mr-2 h-5 w-5" />
                      No Retakes Allowed
                    </Button>
                    <p className="text-xs text-destructive">
                      This quiz does not allow retakes. Contact your instructor for assistance.
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          /* Ungraded Quiz: Always allow retakes */
          <Button 
            onClick={onRestart} 
            size="lg" 
            variant="outline" 
            className="min-w-[200px]"
          >
            <RefreshCw className="mr-2 h-5 w-5" />
            {isPreviousAttempt ? 'Take Quiz Again' : 'Restart Quiz'}
          </Button>
        )}
      </div>
    </div>
  );
};