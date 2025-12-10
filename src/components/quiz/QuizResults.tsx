import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, CheckCircle, XCircle, Award, AlertCircle, Clock, TrendingUp, RefreshCw } from 'lucide-react';
import { cn } from "@/lib/utils";
import { QuizResultsProps } from '@/lib/types';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { ConfettiCelebration } from '@/components/ui/ConfettiCelebration';

export const QuizResults = ({ 
  quiz, 
  userAnswers, 
  score, 
  validationResults,
  onRestart, 
  contentItem, 
  attemptHistory,
  isPreviousAttempt = false,
  coursePassingGrade
}: QuizResultsProps & { isPreviousAttempt?: boolean }) => {
  const [showConfetti, setShowConfetti] = useState(false);
  const { playCorrectSound, playIncorrectSound } = useSoundEffects();
  
  const totalQuestions = quiz.questions.length || 0;
  const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
  
  // Grading information - prefer course's passingGrade over contentItem's stored value
  // This ensures that updating the course's passing grade immediately reflects in all quizzes
  const isGraded = contentItem?.isGraded ?? false;
  const passingScore = coursePassingGrade ?? contentItem?.passingScore ?? 70;
  const passed = percentage >= passingScore;
  const allowRetakes = contentItem?.allowRetakes ?? true;
  const historyPercentages = attemptHistory?.map((attempt) => attempt.percentage) ?? [];
  const bestPercentage = historyPercentages.length > 0
    ? Math.max(...historyPercentages)
    : percentage;
  const hasPerfectScore = Math.round(bestPercentage) >= 100;
  
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

  // Trigger celebration on mount for new attempts (not viewing previous results)
  useEffect(() => {
    if (!isPreviousAttempt) {
      // Play sound based on performance
      if (isGraded) {
        if (passed) {
          playCorrectSound();
          setShowConfetti(true);
        } else {
          playIncorrectSound();
        }
      } else {
        // For non-graded quizzes, celebrate if score is good (>= 60%)
        if (percentage >= 60) {
          playCorrectSound();
          setShowConfetti(true);
        } else {
          playIncorrectSound();
        }
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6 w-full">
      {/* Confetti celebration for good quiz results */}
      <ConfettiCelebration 
        show={showConfetti} 
        onComplete={() => setShowConfetti(false)}
        duration={3000}
        pieceCount={75}
      />
      
      {/* Show "Previous Attempt" banner if viewing history */}
      {isPreviousAttempt && (
        <Card className="p-3 sm:p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
            <Clock className="h-5 w-5" />
            <p className="font-semibold">
              Viewing your previous attempt
            </p>
          </div>
        </Card>
      )}

      <Card className="p-4 sm:p-8 text-center shadow-lg">
        <Trophy className="mx-auto mb-4 h-12 w-12 sm:h-16 sm:w-16 text-chart-5 dark:text-chart-3" />
        <h2 className="mb-2 text-2xl sm:text-3xl font-bold text-foreground">
          {isPreviousAttempt ? 'Your Previous Result' : 'Quiz Complete!'}
        </h2>
        <div className={`mb-2 text-4xl sm:text-6xl font-bold ${getScoreColor()}`}>
          {score}/{quiz.questions.length}
        </div>
        <p className="mb-4 text-lg sm:text-xl text-muted-foreground">{percentage}% Correct</p>
        
        {isGraded && (
          <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
            {passed ? (
              <Badge className="bg-green-500 hover:bg-green-600 text-white text-sm sm:text-base py-1 px-2 sm:px-3">
                <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                Passed
              </Badge>
            ) : (
              <Badge className="bg-destructive hover:bg-destructive text-white text-sm sm:text-base py-1 px-2 sm:px-3">
                <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                Need {passingScore}% to Pass
              </Badge>
            )}
            {isGraded && (
              <Badge variant="outline" className="text-sm sm:text-base py-1 px-2 sm:px-3">
                <Award className="h-3 w-3 sm:h-4 sm:w-4 mr-1 text-amber-600" />
                Graded
              </Badge>
            )}
          </div>
        )}
        
        <p className="text-base sm:text-lg font-semibold text-foreground">{getScoreMessage()}</p>
      </Card>

      <Card className="p-3 sm:p-6 shadow-lg">
        <h3 className="mb-4 sm:mb-6 text-xl sm:text-2xl font-bold text-foreground">Review Your Answers</h3>
        <div className="space-y-4 sm:space-y-6">
          {quiz.questions.map((question, index) => {
            const userAnswer = userAnswers[index];
            // Use server validation results if available, otherwise assume incorrect for old attempts
            const result = validationResults?.[index];
            const isCorrect = result?.isCorrect ?? false;
            // correctAnswer is available in result but not displayed to encourage learning
            const _correctAnswer = result?.correctAnswer;
            void _correctAnswer; // Suppress unused variable warning
            const explanation = result?.explanation;
            
            return (
              <div key={index} className="border-b border-border pb-4 sm:pb-6 last:border-b-0">
                <div className="flex items-start gap-2 sm:gap-4">
                  {isCorrect ? (
                    <CheckCircle className="mt-0.5 sm:mt-1 h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 text-chart-4 dark:text-chart-2" />
                  ) : (
                    <XCircle className="mt-0.5 sm:mt-1 h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 text-destructive" />
                  )}
                  <div className="flex-1 min-w-0 space-y-2 sm:space-y-3">
                    <h4 className="font-semibold text-foreground text-sm sm:text-base break-words">
                      {index + 1}. {question.question}
                    </h4>
                    
                    
                    <div className={cn(
                      "rounded-lg border p-2 sm:p-3 text-sm sm:text-base break-words",
                      isCorrect 
                        ? 'border-chart-4/30 bg-chart-4/10 text-chart-4 dark:border-chart-2/30 dark:bg-chart-2/10 dark:text-chart-2' 
                        : 'border-destructive/30 bg-destructive/10 text-destructive'
                    )}>
                      <span className="font-medium">Your answer: </span>
                      <span className="break-words">
                        {question.options[userAnswer] ?? 'No answer'}
                      </span>
                    </div>
                    
                    {/* Show explanation as a hint for incorrect answers, or as additional info for correct ones */}
                    {explanation && (
                      <div className={cn(
                        "rounded-lg border p-2 sm:p-3",
                        isCorrect 
                          ? "border-secondary/30 bg-secondary/10"
                          : "border-amber-500/30 bg-amber-500/10"
                      )}>
                        <p className="text-xs sm:text-sm text-muted-foreground break-words">
                          {!isCorrect && <span className="font-medium text-amber-600 dark:text-amber-400">Hint: </span>}
                          {explanation}
                        </p>
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
        <Card className="p-3 sm:p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
            <h3 className="text-lg sm:text-xl font-bold text-foreground">Attempt History</h3>
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
                  {Math.round(Math.max(...attemptHistory.map(a => a.percentage)))}%
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
                {hasPerfectScore ? (
                  <>
                    <Button
                      size="lg"
                      variant="outline"
                      className="min-w-[200px]"
                      disabled
                    >
                      <Trophy className="mr-2 h-5 w-5" />
                      Perfect Score Achieved
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      You&apos;ve achieved a perfect score, so retakes are no longer needed.
                    </p>
                  </>
                ) : (
                  <>
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
                  </>
                )}
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
          <div className="space-y-2">
            <Button 
              onClick={onRestart} 
              size="lg" 
              variant="outline" 
              className="min-w-[200px]"
              disabled={hasPerfectScore}
            >
              {hasPerfectScore ? (
                <Trophy className="mr-2 h-5 w-5" />
              ) : (
                <RefreshCw className="mr-2 h-5 w-5" />
              )}
              {hasPerfectScore
                ? 'Perfect Score Achieved'
                : isPreviousAttempt ? 'Take Quiz Again' : 'Restart Quiz'}
            </Button>
            {hasPerfectScore && (
              <p className="text-xs text-muted-foreground">
                You&apos;ve already scored 100%. Feel free to revisit the content, but retakes are disabled.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};