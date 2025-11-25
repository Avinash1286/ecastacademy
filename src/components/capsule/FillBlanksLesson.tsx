'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, XCircle, Lightbulb } from 'lucide-react';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { ConfettiCelebration } from '@/components/ui/ConfettiCelebration';
import { cn } from '@/lib/utils';

type RawBlank = {
  id?: string;
  position?: number;
  correctAnswer?: string;
  alternatives?: string[];
  hint?: string;
};

type NormalizedBlank = {
  id: string;
  correctAnswer: string;
  alternatives: string[];
  hint?: string;
};

interface FillBlanksAnswerData {
  questionText: string;
  answers: Record<string, string>;
  correctAnswers: Record<string, string>;
  isCorrect: boolean;
  score: number;
}

interface FillBlanksProps {
  instruction?: string;
  text?: string;
  sentence?: string;
  blanks?: RawBlank[];
  feedback?: {
    allCorrect?: string;
    partial?: string;
    hint?: string;
  };
  onComplete?: (score: number) => void;
  onQuizAnswer?: (data: FillBlanksAnswerData) => void;
  onHintViewed?: () => void;
  isCompleted?: boolean;
  lastAnswer?: {
    answers?: Record<string, string>;
  };
}

export function FillBlanksLesson({ instruction, text, sentence, blanks, feedback, onComplete, onQuizAnswer, onHintViewed, isCompleted = false, lastAnswer }: FillBlanksProps) {
  const safeText = typeof text === 'string' && text.trim().length
    ? text
    : typeof sentence === 'string'
    ? sentence
    : '';
  const normalizedBlanks: NormalizedBlank[] = Array.isArray(blanks)
    ? blanks.reduce<NormalizedBlank[]>((acc, blank, index) => {
        if (typeof blank?.correctAnswer !== 'string' || !blank.correctAnswer.trim()) {
          return acc;
        }

        const generatedId =
          (typeof blank.id === 'string' && blank.id.trim().length && blank.id) ||
          (typeof blank.position === 'number' ? `blank-${blank.position + 1}` : `blank-${index + 1}`);

        acc.push({
          id: generatedId,
          correctAnswer: blank.correctAnswer,
          alternatives: Array.isArray(blank.alternatives) ? blank.alternatives : [],
          hint: blank.hint,
        });
        return acc;
      }, [])
    : [];
  const lessonFeedback = {
    allCorrect: 'Perfect! Every blank is correct.',
    partial: 'Nice progress! A few blanks still need attention.',
    hint: 'Review the hints or revisit the passage, then try again.',
    ...feedback,
  };

  const [answers, setAnswers] = useState<Record<string, string>>(lastAnswer?.answers || {});
  const [checked, setChecked] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [animateResult, setAnimateResult] = useState(false);
  const hasInteractiveContent = safeText.length > 0 && normalizedBlanks.length > 0;
  
  const { playCorrectSound, playIncorrectSound } = useSoundEffects();

  // Sync state with props when lesson changes
  useEffect(() => {
    setChecked(isCompleted);
    setAnswers(lastAnswer?.answers || {});
    setShowHints(false);
    setAnimateResult(false);
  }, [isCompleted, lastAnswer?.answers, text]);

  // Split text by {{placeholder}} pattern
  const renderText = () => {
    if (!hasInteractiveContent) {
      return (
        <span className="text-sm text-muted-foreground">
          This activity is still generating. Move ahead or refresh later to see the interactive version.
        </span>
      );
    }

    const parts = safeText.split(/(\{\{[^}]+\}\})/);
    let blankIndex = 0;

    return parts.map((part, index) => {
      if (part.match(/\{\{[^}]+\}\}/)) {
        const blank = normalizedBlanks[blankIndex];
        const blankNum = blankIndex;
        blankIndex++;

        if (!blank) return null;

        const userAnswer = answers[blank.id] || '';
        const isCorrect = checked && (
          userAnswer.toLowerCase() === blank.correctAnswer.toLowerCase() ||
          (blank.alternatives || []).some(alt => alt.toLowerCase() === userAnswer.toLowerCase())
        );
        const isIncorrect = checked && userAnswer && !isCorrect;

        return (
          <span key={index} className="inline-flex items-center gap-1 mx-1">
            <Input
              type="text"
              value={userAnswer}
              onChange={(e) => {
                setAnswers({ ...answers, [blank.id]: e.target.value });
                setChecked(false);
              }}
              disabled={checked}
              placeholder={`blank ${blankNum + 1}`}
              className={`inline-block w-32 h-8 text-center ${
                isCorrect
                  ? 'border-green-500 bg-green-50 dark:bg-green-950'
                  : isIncorrect
                  ? 'border-red-500 bg-red-50 dark:bg-red-950'
                  : ''
              }`}
            />
            {checked && isCorrect && <CheckCircle2 className="h-4 w-4 text-green-500" />}
            {checked && isIncorrect && <XCircle className="h-4 w-4 text-red-500" />}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const handleCheck = () => {
    if (!hasInteractiveContent) return;
    setChecked(true);
    setAnimateResult(true);
    
    let correctCount = 0;
    normalizedBlanks.forEach((blank) => {
      const userAnswer = (answers[blank.id] || '').toLowerCase();
      if (
        userAnswer === blank.correctAnswer.toLowerCase() ||
        (blank.alternatives || []).some(alt => alt.toLowerCase() === userAnswer)
      ) {
        correctCount++;
      }
    });
    
    // Check if all answers are correct
    const isAllCorrect = correctCount === normalizedBlanks.length;
    
    // Play sound effect and show confetti
    if (isAllCorrect) {
      playCorrectSound();
      setShowConfetti(true);
    } else {
      playIncorrectSound();
    }
    
    // Reset animation state after animation completes
    setTimeout(() => setAnimateResult(false), 500);

    const score = normalizedBlanks.length > 0 ? (correctCount / normalizedBlanks.length) * 100 : 0;

    // Log quiz answer data
    if (onQuizAnswer) {
      const correctAnswersMap: Record<string, string> = {};
      normalizedBlanks.forEach(blank => {
        correctAnswersMap[blank.id] = blank.correctAnswer;
      });
      onQuizAnswer({
        questionText: safeText,
        answers,
        correctAnswers: correctAnswersMap,
        isCorrect: isAllCorrect,
        score,
      });
    }

    if (onComplete && normalizedBlanks.length > 0) {
      onComplete(score);
    }
  };

  const allCorrect = checked && normalizedBlanks.length > 0 && normalizedBlanks.every((blank) => {
    const userAnswer = (answers[blank.id] || '').toLowerCase();
    return (
      userAnswer === blank.correctAnswer.toLowerCase() ||
      (blank.alternatives || []).some(alt => alt.toLowerCase() === userAnswer)
    );
  });

  const someCorrect =
    checked &&
    !allCorrect &&
    normalizedBlanks.some((blank) => {
    const userAnswer = (answers[blank.id] || '').toLowerCase();
    return (
      userAnswer === blank.correctAnswer.toLowerCase() ||
      (blank.alternatives || []).some(alt => alt.toLowerCase() === userAnswer)
    );
  });

  const instructionText = instruction || 'Type the missing words to complete the passage.';

  return (
    <>
      {/* Confetti celebration for all correct answers */}
      <ConfettiCelebration 
        show={showConfetti} 
        onComplete={() => setShowConfetti(false)}
        duration={3000}
      />
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fill in the Blanks</CardTitle>
          <p className="text-sm text-muted-foreground">{instructionText}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-6 bg-muted/30 rounded-lg leading-relaxed text-lg">
            {renderText()}
          </div>

          {hasInteractiveContent && !checked && normalizedBlanks.some((b) => b.hint) && (
            <Button
              variant="ghost"
              onClick={() => {
                const wasHidden = !showHints;
                setShowHints(!showHints);
                // Log hint viewed when showing hints for the first time
                if (wasHidden && onHintViewed) {
                  onHintViewed();
                }
              }}
              className="gap-2"
            >
              <Lightbulb className="h-4 w-4" />
              {showHints ? 'Hide Hints' : 'Show Hints'}
            </Button>
          )}

          {hasInteractiveContent && showHints && !checked && (
              <div className="space-y-2">
                {normalizedBlanks.map((blank, index) => blank.hint && (
                  <div key={index} className="p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded text-sm">
                    <strong>Blank {index + 1}:</strong> {blank.hint}
                </div>
              ))}
            </div>
          )}

          {hasInteractiveContent && !checked && (
            <Button
              onClick={handleCheck}
              disabled={normalizedBlanks.some(blank => !answers[blank.id])}
              className="w-full"
            >
              Check Answers
            </Button>
          )}

          {hasInteractiveContent && checked && (
            <div
              className={cn(
                'p-4 rounded-lg border-2',
                allCorrect
                  ? 'bg-green-50 dark:bg-green-950 border-green-500'
                  : 'bg-yellow-50 dark:bg-yellow-950 border-yellow-500',
                animateResult && allCorrect && 'animate-correct-pulse',
                animateResult && !allCorrect && 'animate-incorrect-shake'
              )}
            >
              <div className="flex items-start gap-2">
                {allCorrect ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                ) : (
                  <Lightbulb className="h-5 w-5 text-yellow-500 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold">
                    {allCorrect
                      ? `🎉 ${lessonFeedback.allCorrect}`
                      : someCorrect
                      ? lessonFeedback.partial
                      : 'Keep trying!'}
                  </p>
                  {!allCorrect && (
                    <p className="text-sm mt-1 opacity-90">{lessonFeedback.hint}</p>
                  )}
                </div>
              </div>
              
              {!allCorrect && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium">Correct answers:</p>
                  {normalizedBlanks.map((blank, index) => (
                    <div key={index} className="text-sm">
                      Blank {index + 1}: <strong>{blank.correctAnswer}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!hasInteractiveContent && (
            <div className="rounded-lg border border-dashed border-muted-foreground/30 p-4 text-sm text-muted-foreground">
              Interactive blanks were not generated for this lesson. Continue to the next activity while we improve the AI output.
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
