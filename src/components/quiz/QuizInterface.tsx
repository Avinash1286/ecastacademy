import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Award, TrendingUp, Loader2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import { QuizInterfaceProps } from '@/lib/types';

export const QuizInterface = ({ quiz, onQuizComplete, contentItem, isSubmitting = false, coursePassingGrade }: QuizInterfaceProps) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>(new Array(quiz.questions.length).fill(null));

  const progress = ((currentQuestion + 1) / quiz.questions.length) * 100;
  const question = quiz.questions[currentQuestion];
  
  // Grading information - prefer course's passingGrade over contentItem's stored value
  // This ensures that updating the course's passing grade immediately reflects in all quizzes
  const isGraded = contentItem?.isGraded ?? false;
  const passingScore = coursePassingGrade ?? contentItem?.passingScore ?? 70;
  const maxPoints = contentItem?.maxPoints ?? 100;

  const handleAnswerSelect = (answerIndex: number) => {
    if (isSubmitting) return; // Prevent changes while submitting
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = answerIndex;
    setAnswers(newAnswers);
    setSelectedAnswer(answerIndex);
  };

  const handleNext = () => {
    if (isSubmitting) return;
    
    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(answers[currentQuestion + 1]);
    } else {
      const finalAnswers = answers.filter(a => a !== null) as number[];
      if (finalAnswers.length !== quiz.questions.length) return; 
      
      // Send answers to server for validation - no client-side scoring
      onQuizComplete(finalAnswers);
    }
  };

  return (
    <Card className="mx-auto max-w-3xl p-6 shadow-sm">
      <div className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">{quiz.topic}</h2>
          <div className="flex items-center gap-2">
            {isGraded && (
              <Badge className="bg-amber-500 hover:bg-amber-600 text-white">
                <Award className="h-3 w-3 mr-1" />
                Graded
              </Badge>
            )}
            <span className="text-sm text-muted-foreground">
              Question {currentQuestion + 1} of {quiz.questions.length}
            </span>
          </div>
        </div>
        
        {isGraded && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-500/20">
            <div className="flex items-start gap-2">
              <TrendingUp className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-sm">
                <p className="text-amber-900 dark:text-amber-100 font-medium mb-1">
                  This quiz affects your grade
                </p>
                <p className="text-amber-800 dark:text-amber-200 text-xs">
                  You need {passingScore}% or higher to pass • Worth {maxPoints} points
                </p>
              </div>
            </div>
          </div>
        )}
        
        <Progress value={progress} className="h-2" />
      </div>

      <div className="space-y-4">
        <div className="flex items-start gap-4">
          {/* This part already uses semantic colors perfectly */}
          <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            {currentQuestion + 1}
          </div>
          <h3 className="flex-1 text-lg font-semibold text-foreground">
            {question.question}
          </h3>
        </div>

        <div className="space-y-3 pl-12">
          {question.options.map((option, index) => (
            <div
              key={index}
              onClick={() => handleAnswerSelect(index)}
              className={cn(
                'flex cursor-pointer items-center space-x-3 rounded-lg border-2 p-3 transition-colors',
                // Default state uses border and hover uses accent for a standard interaction
                'border-border hover:bg-accent hover:text-accent-foreground',
                // Selected state overrides with primary colors for a clear indication
                selectedAnswer === index && 'border-primary bg-primary/10 text-primary'
              )}
            >
              <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
                {/* This custom radio button is already well-implemented with theme colors */}
                <div className={cn(
                  "h-4 w-4 rounded-full border-2",
                  selectedAnswer === index ? "border-primary bg-primary" : "border-muted-foreground"
                )}/>
              </div>
              <span className="font-medium">{option}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-4">
          <Button
            onClick={handleNext}
            disabled={selectedAnswer === null || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Validating...
              </>
            ) : (
              currentQuestion === quiz.questions.length - 1 ? 'Finish Quiz' : 'Next Question'
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
};