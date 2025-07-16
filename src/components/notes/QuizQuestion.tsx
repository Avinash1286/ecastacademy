import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { CheckCircle, XCircle, HelpCircle } from 'lucide-react';

interface QuizQuestion {
  type: 'mcq' | 'true-false' | 'fill-blank' | 'fill-in-the-blank';
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
}

interface QuizQuestionProps {
  question: QuizQuestion;
  questionIndex: number;
}

const compareStrings = (a: string, b: string) => {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
};

export function QuizQuestion({ question, questionIndex }: QuizQuestionProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [showResult, setShowResult] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const isAnswerCorrect = compareStrings(selectedAnswer, question.correctAnswer);

  const handleSubmit = () => {
    if (selectedAnswer.trim()) {
      setShowResult(true);
    }
  };

  const resetQuestion = () => {
    setSelectedAnswer('');
    setShowResult(false);
    setShowExplanation(false);
  };

  const getOptionClassName = (option: string) => {
    const isSelected = compareStrings(selectedAnswer, option);
    const isCorrectAnswer = compareStrings(option, question.correctAnswer);

    if (showResult) {
      if (isCorrectAnswer) {
        return 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-400';
      }
      if (isSelected && !isCorrectAnswer) {
        return 'border-destructive bg-destructive/10 text-destructive';
      }
      return 'border-transparent bg-muted/50 text-muted-foreground';
    }

    return cn(
      'border-border hover:border-primary/50 hover:bg-secondary/50',
      isSelected && 'border-primary bg-primary/5'
    );
  };

  return (
    <Card className="p-6 bg-card border-border shadow-sm">
      <div className="space-y-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold mt-1">
            {questionIndex + 1}
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-lg text-foreground mb-4">
              {question.question}
            </h4>

            {question.type === 'mcq' && (
              <div className="space-y-3">
                {question.options?.map((option, index) => (
                  <label
                    key={index}
                    className={cn(
                      'flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all duration-300',
                      getOptionClassName(option),
                      showResult && 'pointer-events-none'
                    )}
                  >
                    <input
                      type="radio"
                      name={`question-${questionIndex}`}
                      value={option}
                      checked={compareStrings(selectedAnswer, option)}
                      onChange={(e) => setSelectedAnswer(e.target.value)}
                      className={cn(
                        'w-4 h-4 transition-colors',
                        showResult && compareStrings(option, question.correctAnswer)
                          ? 'text-green-600'
                          : 'text-primary'
                      )}
                      disabled={showResult}
                    />
                    <span className="font-medium">{option}</span>
                  </label>
                ))}
              </div>
            )}
            
            {question.type === 'true-false' && (
              <div className="space-y-3">
                {['True', 'False'].map((option) => (
                   <label
                    key={option}
                    className={cn(
                      'flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all duration-300',
                      getOptionClassName(option),
                      showResult && 'pointer-events-none'
                    )}
                  >
                    <input
                      type="radio"
                      name={`question-${questionIndex}`}
                      value={option}
                      checked={compareStrings(selectedAnswer, option)}
                      onChange={(e) => setSelectedAnswer(e.target.value)}
                      className={cn(
                        'w-4 h-4 transition-colors',
                        showResult && compareStrings(option, question.correctAnswer)
                          ? 'text-green-600'
                          : 'text-primary'
                      )}
                      disabled={showResult}
                    />
                    <span className="font-medium capitalize">{option.toLowerCase()}</span>
                  </label>
                ))}
              </div>
            )}
            
            {(question.type === 'fill-blank' || question.type === 'fill-in-the-blank') && (
              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="Type your answer here..."
                  value={selectedAnswer}
                  onChange={(e) => setSelectedAnswer(e.target.value)}
                  disabled={showResult}
                  className={cn(
                    'w-full transition-colors duration-300',
                    showResult && (isAnswerCorrect 
                      ? 'border-green-500 focus:ring-green-500' 
                      : 'border-destructive focus:ring-destructive'
                    )
                  )}
                />
                {showResult && (
                  <div className="flex items-center gap-2 text-sm animate-in fade-in-0 duration-500">
                    {isAnswerCorrect ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive" />
                    )}
                    <span className="text-muted-foreground">
                      Correct answer: <span className="font-medium text-foreground">{question.correctAnswer}</span>
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 mt-6">
              {!showResult ? (
                <Button
                  onClick={handleSubmit}
                  disabled={!selectedAnswer.trim()}
                  size="sm"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Submit Answer
                </Button>
              ) : (
                <div className="flex flex-wrap items-center gap-2 animate-in fade-in-0 duration-500">
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                    isAnswerCorrect 
                      ? 'bg-green-500/10 text-green-700'
                      : 'bg-destructive/10 text-destructive'
                  }`}>
                    {isAnswerCorrect ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Correct!
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4" />
                        Incorrect
                      </>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowExplanation(!showExplanation)}
                  >
                    <HelpCircle className="w-4 h-4 mr-1.5" />
                    {showExplanation ? 'Hide' : 'Show'} Explanation
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetQuestion}
                  >
                    Try Again
                  </Button>
                </div>
              )}
            </div>

            {showExplanation && (
              <div className="mt-4 p-4 bg-muted rounded-lg border animate-in fade-in-0 duration-500">
                <p className="text-sm text-foreground/80">{question.explanation}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}