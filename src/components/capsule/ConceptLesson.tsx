'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, BookOpen } from 'lucide-react';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { ConfettiCelebration } from '@/components/ui/ConfettiCelebration';

const escapeScript = (value?: string) => value?.replace(/<\/script/gi, '<\\/script') ?? '';

const guardJavaScript = (code?: string) => `(() => {
  try {
    Object.defineProperty(window, 'parent', { value: null, writable: false });
    Object.defineProperty(window, 'top', { value: null, writable: false });
    Object.defineProperty(window, 'opener', { value: null, writable: false });
  } catch (_) {
    /* no-op */
  }
})();
${escapeScript(code)}`;

const buildHtmlDocument = (html?: string, css?: string, js?: string) => `
  <html>
    <head>
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:;" />
      <style>
        body{
          margin:0;
          padding:16px;
          font-family:system-ui,-apple-system,sans-serif;
          background:#f8fafc;
          display:flex;
          align-items:center;
          justify-content:center;
          min-height:100vh;
        } 
        ${css || ''}
      </style>
    </head>
    <body>
      ${html || '<div id="app"></div>'}
      <script>${guardJavaScript(js)}<\/script>
    </body>
  </html>
`;

interface ConceptLessonProps {
  explanation?: string;
  keyPoints?: string[];
  visualAid?: {
    type: 'diagram' | 'flowchart' | 'animation' | 'visualization';
    description: string;
    code?: {
      html?: string;
      css?: string;
      javascript: string;
    };
  };
  realWorldExample?: string;
  checkUnderstanding?: {
    question: string;
    answer: boolean;
    explanation: string;
    feedback?: string;
  };
  onComplete?: () => void;
  isCompleted?: boolean;
}

export function ConceptLesson({
  explanation = '',
  keyPoints = [],
  visualAid,
  realWorldExample,
  checkUnderstanding,
  onComplete,
  isCompleted = false,
}: ConceptLessonProps) {
  const [userAnswer, setUserAnswer] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [markedComplete, setMarkedComplete] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const visualizationContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const hasRenderedRef = useRef(false);
  
  const { playCorrectSound } = useSoundEffects();

  // Sync state with isCompleted prop when lesson changes
  useEffect(() => {
    setMarkedComplete(isCompleted);
    setShowFeedback(isCompleted);
    setUserAnswer('');
  }, [isCompleted, explanation]); // explanation changes when lesson changes

  // Create a stable key based on the actual code content
  const codeKey = useMemo(() => {
    if (!visualAid?.code) return '';
    const html = visualAid.code.html || '';
    const css = visualAid.code.css || '';
    const js = visualAid.code.javascript || '';
    return `${html.length}-${css.length}-${js.length}-${html.slice(0, 50)}-${js.slice(0, 50)}`;
  }, [visualAid?.code?.html, visualAid?.code?.css, visualAid?.code?.javascript]);

  // Reset refs when code actually changes
  useEffect(() => {
    hasRenderedRef.current = false;
    iframeRef.current = null;
  }, [codeKey]);

  useEffect(() => {
    if (!visualAid?.code || !visualizationContainerRef.current) return;
    
    // Prevent re-rendering if the code hasn't actually changed
    if (hasRenderedRef.current && iframeRef.current) {
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '400px';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '8px';
    iframe.style.background = '#f8fafc';
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.setAttribute('referrerpolicy', 'no-referrer');

    visualizationContainerRef.current.innerHTML = '';
    visualizationContainerRef.current.appendChild(iframe);

    const html = buildHtmlDocument(visualAid.code.html, visualAid.code.css, visualAid.code.javascript);
    iframe.srcdoc = html;
    
    iframeRef.current = iframe;
    hasRenderedRef.current = true;
  }, [codeKey]); // Only depend on codeKey, not visualAid

  const handleCheck = () => {
    setShowFeedback(true);
    playCorrectSound();
    setShowConfetti(true);
    if (onComplete) {
      onComplete();
    }
  };

  const handleMarkComplete = () => {
    setMarkedComplete(true);
    playCorrectSound();
    setShowConfetti(true);
    if (onComplete) {
      onComplete();
    }
  };

  // Handle case where AI generates the string "undefined" or empty content
  const safeExplanation = explanation === 'undefined' || !explanation ?
    "Content is currently unavailable for this section." :
    explanation;

  return (
    <>
      {/* Confetti celebration for completion */}
      <ConfettiCelebration 
        show={showConfetti} 
        onComplete={() => setShowConfetti(false)}
        duration={3000}
      />
      
      <div className="space-y-6">
        {/* Main Explanation */}
        <Card>
          <CardContent className="p-8">
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-lg leading-relaxed whitespace-pre-wrap">{safeExplanation}</p>
            </div>
          </CardContent>
        </Card>

        {/* Key Points */}
        {keyPoints && keyPoints.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Key Points</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {keyPoints.map((point, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                  <span className="text-foreground/90">{point}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Visual Aid */}
      {visualAid && (
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader>
            <CardTitle className="text-lg">
              {visualAid.type === 'diagram' && '📊 Diagram'}
              {visualAid.type === 'flowchart' && '🔄 Flowchart'}
              {visualAid.type === 'animation' && '🎬 Animation'}
              {visualAid.type === 'visualization' && '📈 Interactive Visualization'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{visualAid.description}</p>
              <div className="bg-background rounded-lg border overflow-hidden">
                {visualAid.code ? (
                  <div ref={visualizationContainerRef} className="min-h-[400px] flex items-center justify-center bg-muted/20">
                    <p className="text-sm text-muted-foreground">Loading visualization...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center min-h-[200px] bg-muted/20 rounded border border-dashed p-6 text-center">
                    <p className="text-sm text-muted-foreground italic">Visualization code not available</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Real World Example */}
      {realWorldExample && (
        <Card className="bg-gradient-to-br from-accent/20 to-transparent border-accent/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="text-2xl">💡</span>
              Real-World Connection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground/90 leading-relaxed">{realWorldExample}</p>
          </CardContent>
        </Card>
      )}

      {/* Check Understanding */}
      {checkUnderstanding && (
        <Card className="border-2 border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg">Check Your Understanding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="font-medium">{checkUnderstanding.question}</p>

            <div className="flex gap-2">
              <Button
                variant={showFeedback && userAnswer === 'yes' ? 'default' : 'outline'}
                onClick={() => {
                  setUserAnswer('yes');
                  setShowFeedback(false);
                }}
                className="flex-1"
              >
                Yes
              </Button>
              <Button
                variant={showFeedback && userAnswer === 'no' ? 'default' : 'outline'}
                onClick={() => {
                  setUserAnswer('no');
                  setShowFeedback(false);
                }}
                className="flex-1"
              >
                No
              </Button>
            </div>

            {!showFeedback && userAnswer && (
              <Button onClick={handleCheck} className="w-full gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Check
              </Button>
            )}

            {showFeedback && (
              <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-500 rounded-lg">
                <p className="text-sm text-green-900 dark:text-green-100">
                  {checkUnderstanding.feedback || checkUnderstanding.explanation}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Mark as Complete button when there's no checkUnderstanding section */}
      {!checkUnderstanding && (
        <Card className="border-2 border-primary/30">
          <CardContent className="p-6">
            {markedComplete ? (
              <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Lesson Completed!</span>
              </div>
            ) : (
              <Button onClick={handleMarkComplete} className="w-full gap-2">
                <BookOpen className="h-4 w-4" />
                I&apos;ve Read This - Mark as Complete
              </Button>
            )}
          </CardContent>
        </Card>
      )}
      </div>
    </>
  );
}