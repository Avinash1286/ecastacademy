'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, Lightbulb } from 'lucide-react';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { ConfettiCelebration } from '@/components/ui/ConfettiCelebration';
import { cn } from '@/lib/utils';

interface QuizAnswerData {
  questionText: string;
  selectedAnswer: string;
  selectedIndex: number;
  correctAnswer: string;
  correctIndex: number;
  isCorrect: boolean;
  options: string[];
}

interface MCQProps {
  question?: string;
  options?: string[];
  correctIndex?: number;
  correctAnswer?: number;
  explanation?: string;
  hint?: string;
  onComplete?: (correct: boolean) => void;
  onQuizAnswer?: (data: QuizAnswerData) => void;
  onHintViewed?: () => void;
  isCompleted?: boolean;
  lastAnswer?: {
    selectedIndex?: number;
    isCorrect?: boolean;
  };
}

export function MCQLesson({ question, options, correctIndex, correctAnswer, explanation, hint, onComplete, onQuizAnswer, onHintViewed, isCompleted = false, lastAnswer }: MCQProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(lastAnswer?.selectedIndex ?? null);
  const [showResult, setShowResult] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [animateResult, setAnimateResult] = useState(false);
  
  const { playCorrectSound, playIncorrectSound } = useSoundEffects();

  // Sync state with props when lesson changes
  useEffect(() => {
    setShowResult(isCompleted);
    setSelectedIndex(lastAnswer?.selectedIndex ?? null);
    setShowHint(false);
    setAnimateResult(false);
  }, [isCompleted, lastAnswer?.selectedIndex, question]);

  const normalizedOptions = Array.isArray(options) && options.length > 0
    ? options
    : ["Option A", "Option B", "Option C", "Option D"];

  const derivedCorrectIndex = typeof correctIndex === 'number'
    ? correctIndex
    : typeof correctAnswer === 'number'
    ? correctAnswer
    : 0;

  const clampedCorrectIndex = Math.min(
    Math.max(0, derivedCorrectIndex),
    Math.max(0, normalizedOptions.length - 1)
  );

  const promptQuestion = question?.trim().length ? question : 'Review this concept:';
  const explanationText = explanation?.trim().length
    ? explanation
    : 'Great effort! Review the explanation above and try again.';

  const handleSubmit = () => {
    if (selectedIndex === null) return;
    setShowResult(true);
    setAnimateResult(true);
    const correct = selectedIndex === clampedCorrectIndex;
    
    // Play sound effect
    if (correct) {
      playCorrectSound();
      setShowConfetti(true);
    } else {
      playIncorrectSound();
    }
    
    // Reset animation state after animation completes
    setTimeout(() => setAnimateResult(false), 500);
    
    // Log quiz answer data
    if (onQuizAnswer) {
      onQuizAnswer({
        questionText: promptQuestion,
        selectedAnswer: normalizedOptions[selectedIndex],
        selectedIndex,
        correctAnswer: normalizedOptions[clampedCorrectIndex],
        correctIndex: clampedCorrectIndex,
        isCorrect: correct,
        options: normalizedOptions,
      });
    }
    
    if (onComplete) {
      onComplete(correct);
    }
  };

  const isCorrect = selectedIndex === clampedCorrectIndex;

  return (
    <>
      {/* Confetti celebration for correct answers */}
      <ConfettiCelebration 
        show={showConfetti} 
        onComplete={() => setShowConfetti(false)}
        duration={3000}
      />
      
      <Card className="border-2">
        <CardContent className="p-8">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">{promptQuestion}</h3>
              
              <RadioGroup
                value={selectedIndex?.toString()}
                onValueChange={(value) => {
                  setSelectedIndex(parseInt(value));
                  setShowResult(false);
                }}
                disabled={showResult}
              >
                <div className="space-y-3">
                  {normalizedOptions.map((option, index) => (
                    <div
                      key={index}
                      className={cn(
                        'flex items-center space-x-3 p-4 rounded-lg border-2 transition-all',
                        showResult
                          ? index === clampedCorrectIndex
                            ? 'border-green-500 bg-green-50 dark:bg-green-950'
                            : index === selectedIndex
                            ? 'border-red-500 bg-red-50 dark:bg-red-950'
                            : 'border-border'
                          : selectedIndex === index
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50',
                        // Add animation classes
                        showResult && animateResult && index === selectedIndex && isCorrect && 'animate-correct-pulse',
                        showResult && animateResult && index === selectedIndex && !isCorrect && 'animate-incorrect-shake'
                      )}
                    >
                      <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                      <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                        {option}
                      </Label>
                      {showResult && index === clampedCorrectIndex && (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      )}
                      {showResult && index === selectedIndex && index !== clampedCorrectIndex && (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

          {!showResult && hint && (
            <Button
              variant="ghost"
              onClick={() => {
                const wasHidden = !showHint;
                setShowHint(!showHint);
                // Log hint viewed when showing hint for the first time
                if (wasHidden && onHintViewed) {
                  onHintViewed();
                }
              }}
              className="gap-2"
            >
              <Lightbulb className="h-4 w-4" />
              {showHint ? 'Hide Hint' : 'Show Hint'}
            </Button>
          )}

          {showHint && !showResult && (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-900 dark:text-yellow-100">
                <strong>Hint:</strong> {hint}
              </p>
            </div>
          )}

          {!showResult && (
            <Button
              onClick={handleSubmit}
              disabled={selectedIndex === null}
              className="w-full"
            >
              Check Answer
            </Button>
          )}

          {showResult && (
            <div
              className={cn(
                'p-4 rounded-lg border-2',
                isCorrect
                  ? 'bg-green-50 dark:bg-green-950 border-green-500'
                  : 'bg-red-50 dark:bg-red-950 border-red-500',
                animateResult && isCorrect && 'animate-correct-pulse'
              )}
            >
              <div className="flex items-start gap-2">
                {isCorrect ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                )}
                <div>
                  <p className={`font-semibold ${isCorrect ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                    {isCorrect ? '🎉 Correct!' : 'Not quite right'}
                  </p>
                  <p className="text-sm mt-1 text-foreground/80">{explanationText}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
    </>
  );
}
