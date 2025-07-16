import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from "@/lib/utils";
import { QuizInterfaceProps } from '@/lib/types';

export const QuizInterface = ({ quiz, onQuizComplete }: QuizInterfaceProps) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>(new Array(quiz.questions.length).fill(null));

  const progress = ((currentQuestion + 1) / quiz.questions.length) * 100;
  const question = quiz.questions[currentQuestion];

  const handleAnswerSelect = (answerIndex: number) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = answerIndex;
    setAnswers(newAnswers);
    setSelectedAnswer(answerIndex);
  };

  const handleNext = () => {
    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(answers[currentQuestion + 1]);
    } else {
      const finalAnswers = answers.filter(a => a !== null) as number[];
      if (finalAnswers.length !== quiz.questions.length) return; 
      
      const finalScore = finalAnswers.reduce((score, answer, index) => {
        return score + (answer === quiz.questions[index].correct ? 1 : 0);
      }, 0);
      onQuizComplete(finalAnswers, finalScore);
    }
  };

  return (
    <Card className="mx-auto max-w-3xl p-6 shadow-sm">
      <div className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">{quiz.topic}</h2>
          <span className="text-sm text-muted-foreground">
            Question {currentQuestion + 1} of {quiz.questions.length}
          </span>
        </div>
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
            disabled={selectedAnswer === null}
          >
            {currentQuestion === quiz.questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
          </Button>
        </div>
      </div>
    </Card>
  );
};