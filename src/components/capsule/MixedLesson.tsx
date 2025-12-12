'use client';

import { useState, useEffect, useCallback, useRef, useMemo, useSyncExternalStore } from 'react';
import { useAction, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  DndContext, 
  DragEndEvent, 
  DragOverlay, 
  DragStartEvent, 
  useDraggable, 
  useDroppable,
  TouchSensor,
  MouseSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { 
  CheckCircle2, 
  BookOpen, 
  Code, 
  HelpCircle, 
  Lightbulb,
  ChevronRight,
  Check,
  X,
  GripVertical,
  Sparkles,
  Maximize2,
  Minimize2,
  RefreshCw,
  MessageSquare,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { ConfettiCelebration } from '@/components/ui/ConfettiCelebration';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import 'katex/dist/katex.min.css';
import type {  
  MCQAnswer, 
  FillBlanksAnswer, 
  DragDropAnswer,
  MixedLessonProgressState,
  QuestionState,
} from '../../../shared/quiz/types';

// =============================================================================
// GLOBAL REGENERATION STATE STORE
// Persists regeneration state across component unmounts/remounts
// =============================================================================
type RegenerationKey = string; // Format: `${lessonId}-${visualizationIndex}`
const regeneratingVisualizations = new Map<RegenerationKey, boolean>();
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach(listener => listener());
}

function getRegenerationKey(lessonId: string, visualizationIndex: number): RegenerationKey {
  return `${lessonId}-${visualizationIndex}`;
}

function setRegenerating(lessonId: string, visualizationIndex: number, value: boolean) {
  const key = getRegenerationKey(lessonId, visualizationIndex);
  if (value) {
    regeneratingVisualizations.set(key, true);
  } else {
    regeneratingVisualizations.delete(key);
  }
  notifyListeners();
}

function isVisualizationRegenerating(lessonId: string, visualizationIndex: number): boolean {
  const key = getRegenerationKey(lessonId, visualizationIndex);
  return regeneratingVisualizations.get(key) ?? false;
}

function useRegenerationState(lessonId: string | undefined, visualizationIndex: number): boolean {
  const subscribe = useCallback((callback: () => void) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  }, []);

  const getSnapshot = useCallback(() => {
    if (!lessonId) return false;
    return isVisualizationRegenerating(lessonId, visualizationIndex);
  }, [lessonId, visualizationIndex]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// =============================================================================
// TYPES
// =============================================================================

interface ContentSection {
  type?: string;
  title?: string;
  content?: string;
  text?: string;
  keyPoints?: string[];
}

interface CodeExample {
  title?: string;
  code?: string;
  language?: string;
  explanation?: string;
}

interface InteractiveVisualization {
  title?: string;
  description?: string;
  type?: string;
  html?: string;
  css?: string;
  javascript?: string;
}

// Practice question types
interface MCQQuestion {
  type: 'mcq';
  question: string;
  options: string[];
  correctIndex: number;
  correct?: number;
  explanation?: string;
}

interface FillBlanksQuestion {
  type: 'fillBlanks';
  instruction?: string;
  text: string;
  blanks: Array<{
    id: string;
    correctAnswer: string;
    alternatives?: string[];
    hint?: string;
  }>;
}

interface DragDropQuestion {
  type: 'dragDrop';
  instruction?: string;
  items: Array<{
    id: string;
    content: string;
    category?: string;
  }>;
  targets: Array<{
    id: string;
    label: string;
    acceptsItems: string[];
  }>;
  feedback?: {
    correct?: string;
    incorrect?: string;
  };
}

type PracticeQuestion = MCQQuestion | FillBlanksQuestion | DragDropQuestion;

/**
 * Typed answer data for mixed lesson submissions
 */
interface TypedMixedLessonAnswerData {
  type: 'mixed';
  lessonId: string;
  questionStates: QuestionState[];
  allQuestionsAnswered: boolean;
  currentQuestionIndex: number;
  overallScore: number;
  timestamp: number;
  timeSpentMs?: number;
}

/**
 * Legacy quiz answer data - for backward compatibility
 */
interface LegacyQuizAnswerData {
  selectedAnswer: string;
  selectedIndex?: number;
  correctAnswer: string;
  correctIndex?: number;
  isCorrect: boolean;
  options?: string[];
}

/**
 * Typed restored progress for mixed lessons
 */
interface TypedRestoredProgress {
  questionStates: QuestionState[];
  currentQuestionIndex: number;
  allQuestionsAnswered: boolean;
}

/**
 * Legacy restored answer
 */
interface LegacyRestoredAnswer {
  selectedIndex?: number;
  isCorrect?: boolean;
}

interface MixedLessonProps {
  // Question content
  content?: {
    sections?: ContentSection[];
    codeExamples?: CodeExample[];
    interactiveVisualizations?: InteractiveVisualization[];
    practiceQuestions?: PracticeQuestion[];
  };
  sections?: ContentSection[];
  codeExamples?: CodeExample[];
  interactiveVisualizations?: InteractiveVisualization[];
  practiceQuestions?: PracticeQuestion[];
  lessonId?: string;
  
  // Ownership - for showing regeneration controls
  isOwner?: boolean;
  userId?: string; // User ID for authenticated regeneration requests
  
  // Callbacks
  onComplete?: (score?: number) => void;
  /** @deprecated Use onTypedAnswer for type-safe answer handling */
  onQuizAnswer?: (data: LegacyQuizAnswerData) => void;
  /** New typed callback - preferred */
  onTypedAnswer?: (data: TypedMixedLessonAnswerData) => void;
  /** Called when navigation changes (for partial progress saves) */
  onNavigationChange?: (index: number) => void;
  
  // State restoration
  isCompleted?: boolean;
  /** @deprecated Use typedProgress for type-safe restoration */
  lastAnswer?: LegacyRestoredAnswer;
  /** New typed progress - preferred */
  typedProgress?: TypedRestoredProgress | MixedLessonProgressState;
  
  // Timing
  startTime?: number;
}

// =============================================================================
// DRAGGABLE ITEM COMPONENT
// =============================================================================

function DraggableItem({ id, content, isPlaced }: { id: string; content: string; isPlaced: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    touchAction: 'none', // Prevent browser touch actions like scrolling during drag
  };

  if (isPlaced) return null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "px-3 py-2 bg-primary/10 border-2 border-primary/30 rounded-lg cursor-grab flex items-center gap-2 transition-all select-none",
        isDragging && "opacity-50 cursor-grabbing shadow-lg scale-105"
      )}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium">{content}</span>
    </div>
  );
}

// =============================================================================
// DROPPABLE TARGET COMPONENT
// =============================================================================

function DroppableTarget({ 
  id, 
  label, 
  placedItem, 
  isCorrect, 
  showResult 
}: { 
  id: string; 
  label: string; 
  placedItem?: { id: string; content: string } | null;
  isCorrect?: boolean;
  showResult: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "p-4 border-2 border-dashed rounded-lg min-h-[80px] transition-all",
        isOver && "border-primary bg-primary/5",
        !isOver && !placedItem && "border-muted-foreground/30",
        placedItem && !showResult && "border-primary/50 bg-primary/5",
        showResult && isCorrect && "border-green-500 bg-green-500/10",
        showResult && !isCorrect && placedItem && "border-red-500 bg-red-500/10"
      )}
    >
      <p className="text-sm text-muted-foreground mb-2">{label}</p>
      {placedItem && (
        <div className={cn(
          "px-3 py-2 rounded-lg flex items-center gap-2",
          showResult && isCorrect && "bg-green-500/20",
          showResult && !isCorrect && "bg-red-500/20",
          !showResult && "bg-primary/10"
        )}>
          <span className="text-sm font-medium">{placedItem.content}</span>
          {showResult && (
            isCorrect ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-red-500" />
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// INTERACTIVE VISUALIZATION COMPONENT
// =============================================================================

interface VisualizationFrameProps {
  visualization: InteractiveVisualization;
  lessonId?: string;
  visualizationIndex: number;
  onRegenerated?: () => void;
  isOwner?: boolean;
  userId?: string;
}

function VisualizationFrame({ 
  visualization, 
  lessonId, 
  visualizationIndex,
  onRegenerated,
  isOwner,
  userId
}: VisualizationFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedback, setFeedback] = useState('');
  
  // Use global regeneration state that persists across navigation
  const isRegenerating = useRegenerationState(lessonId, visualizationIndex);
  
  const regenerateVisualization = useAction(api.capsuleGeneration.regenerateVisualization);

  // Check if visualization appears broken (empty or minimal code)
  const appearsBroken = useMemo(() => {
    const js = visualization.javascript || '';
    const html = visualization.html || '';
    // Consider broken if JS is less than 50 chars or HTML is just an empty div
    return js.length < 50 || (html.length < 30 && !js.includes('document'));
  }, [visualization]);

  const handleRegenerate = async () => {
    if (!lessonId || feedback.trim().length < 10) {
      toast.error('Please provide more detailed feedback (at least 10 characters)');
      return;
    }
    
    if (!userId) {
      toast.error('Please sign in to regenerate visualizations');
      return;
    }

    // Set global regenerating state
    setRegenerating(lessonId, visualizationIndex, true);
    try {
      await regenerateVisualization({
        lessonId: lessonId as Id<'capsuleLessons'>,
        visualizationIndex,
        userFeedback: feedback.trim(),
        userId: userId as Id<'users'>,
      });
      
      toast.success('Visualization regenerated successfully!');
      setShowFeedbackForm(false);
      setFeedback('');
      
      // Notify parent to refresh content if provided
      // Otherwise, Convex's reactive queries will auto-update the data
      if (onRegenerated) {
        onRegenerated();
      }
    } catch (error: unknown) {
      // Extract error message from Convex error structure
      let message = 'Failed to regenerate visualization';
      if (error instanceof Error) {
        message = error.message;
      } else if (typeof error === 'object' && error !== null) {
        const convexError = error as { message?: string; data?: { message?: string } };
        message = convexError.data?.message || convexError.message || message;
      }
      
      // Clean up Convex error wrapping (e.g., "Uncaught Error: Rate limit..." -> "Rate limit...")
      // Also handle "Server Error" prefix
      message = message
        .replace(/^Uncaught Error:\s*/i, '')
        .replace(/^Error:\s*/i, '')
        .replace(/^Server Error:\s*/i, '');
      
      // Show user-friendly toast
      toast.error(message);
    } finally {
      // Clear global regenerating state
      setRegenerating(lessonId, visualizationIndex, false);
    }
  };

  const srcDoc = useMemo(() => {
    const html = visualization.html || '<div id="visualization"></div>';
    const css = visualization.css || '';
    const js = visualization.javascript || '';
    
    // Sanitize JavaScript to remove potentially dangerous patterns
    const sanitizedJs = js
      // Remove attempts to access parent/top window
      .replace(/\bparent\b/g, 'null')
      .replace(/\btop\b/g, 'null')
      .replace(/\bwindow\.parent\b/g, 'null')
      .replace(/\bwindow\.top\b/g, 'null')
      // Remove document.cookie access
      .replace(/document\.cookie/g, '""')
      // Remove localStorage/sessionStorage direct access attempts
      .replace(/\blocalStorage\b/g, '({})')
      .replace(/\bsessionStorage\b/g, '({})')
      // Remove eval and Function constructor for dynamic code execution
      .replace(/\beval\s*\(/g, '(function(){})(')
      .replace(/new\s+Function\s*\(/g, '(function(){})(');
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- Strict Content Security Policy -->
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    script-src 'unsafe-inline';
    style-src 'unsafe-inline';
    img-src 'self' data: blob:;
    font-src 'self' data:;
    connect-src 'none';
    frame-src 'none';
    object-src 'none';
    base-uri 'none';
    form-action 'none';
  ">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { 
      font-family: system-ui, -apple-system, sans-serif;
      padding: 8px;
      margin: 0;
      background: hsl(224, 71%, 4%);
      color: hsl(213, 31%, 91%);
      min-height: 100%;
    }
    
    /* ===== THEME COLORS - USE THESE ===== */
    /* Background: hsl(224, 71%, 4%) - dark navy */
    /* Card/Surface: hsl(222, 47%, 11%) - slightly lighter */
    /* Border: hsl(217, 33%, 17%) - subtle border */
    /* Text Primary: hsl(213, 31%, 91%) - light gray */
    /* Text Muted: hsl(215, 20%, 65%) - muted gray */
    /* Primary/Accent: hsl(217, 91%, 60%) - blue */
    /* Success: hsl(142, 71%, 45%) - green */
    /* Warning: hsl(38, 92%, 50%) - amber */
    /* Error: hsl(0, 84%, 60%) - red */
    
    /* ===== CONTRAST RULES ===== */
    /* Light text on dark backgrounds ONLY */
    /* Dark text (#1e293b) on light backgrounds (#f1f5f9, #e2e8f0) */
    /* Never use light text on light backgrounds */
    /* Never use dark text on dark backgrounds */
    
    button {
      padding: 8px 16px;
      border-radius: 6px;
      border: none;
      background: hsl(217, 91%, 60%);
      color: white;
      cursor: pointer;
      font-size: 14px;
      margin: 4px;
      transition: all 0.2s;
      font-weight: 500;
    }
    button:hover { background: hsl(217, 91%, 50%); }
    button:active { background: hsl(217, 91%, 45%); }
    
    input, select {
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid hsl(217, 33%, 17%);
      background: hsl(222, 47%, 11%);
      color: hsl(213, 31%, 91%);
      font-size: 14px;
      margin: 4px;
    }
    input[type="range"] {
      width: 100%;
      accent-color: hsl(217, 91%, 60%);
    }
    label {
      color: hsl(215, 20%, 65%);
      font-size: 14px;
      margin-right: 8px;
    }
    canvas { 
      border-radius: 8px; 
      display: block;
      margin: 8px auto;
      background: hsl(222, 47%, 11%);
    }
    
    /* Control panel - dark theme */
    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-bottom: 12px;
      padding: 10px 12px;
      background: hsl(222, 47%, 11%);
      border-radius: 8px;
      border: 1px solid hsl(217, 33%, 17%);
    }
    
    /* Container for visualization - minimal padding */
    .viz-container, #viz-container, #visualization {
      background: hsl(222, 47%, 11%);
      border-radius: 0;
      padding: 0;
      margin: 0;
    }
    
    /* Remove any wrapper padding */
    body > div:first-child {
      padding: 8px !important;
      margin: 0 !important;
    }
    
    /* Light cards (for flowcharts, diagrams) - DARK TEXT */
    .card, .box, .node, .step {
      background: hsl(210, 40%, 96%);
      color: hsl(222, 47%, 11%);
      border: 1px solid hsl(214, 32%, 91%);
      border-radius: 8px;
      padding: 12px 16px;
    }
    
    /* Highlighted/colored boxes - ensure contrast */
    .highlight, .active {
      background: hsl(217, 91%, 60%);
      color: white;
    }
    .success, .correct {
      background: hsl(142, 71%, 45%);
      color: white;
    }
    .warning {
      background: hsl(38, 92%, 50%);
      color: hsl(222, 47%, 11%);
    }
    .error, .incorrect {
      background: hsl(0, 84%, 60%);
      color: white;
    }
    
    /* Info text */
    .info, .description {
      color: hsl(215, 20%, 65%);
      font-size: 14px;
    }
    
    /* Headings */
    h1, h2, h3, h4 {
      color: hsl(213, 31%, 91%);
      margin-bottom: 8px;
    }
    
    ${css}
  </style>
</head>
<body>
  ${html}
  <script>
    // Security wrapper - prevent access to parent context
    (function() {
      'use strict';
      
      // Freeze dangerous APIs
      try {
        Object.defineProperty(window, 'parent', { value: window, writable: false, configurable: false });
        Object.defineProperty(window, 'top', { value: window, writable: false, configurable: false });
        Object.defineProperty(window, 'opener', { value: null, writable: false, configurable: false });
        Object.defineProperty(window, 'frameElement', { value: null, writable: false, configurable: false });
        // Disable postMessage to parent
        window.postMessage = function() {};
      } catch(secErr) {
        console.warn('Security setup warning:', secErr);
      }
      
      // Execute user code in isolated scope
      try {
        ${sanitizedJs}
      } catch(e) {
        console.error('Visualization error:', e);
        document.body.innerHTML = '<div style="padding:20px;color:hsl(0, 84%, 60%);text-align:center;"><p>Error loading visualization</p><p style="font-size:12px;color:hsl(215, 20%, 65%);margin-top:8px;">' + (e.message || 'Unknown error') + '</p></div>';
      }
    })();
  </script>
</body>
</html>`;
  }, [visualization]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }, [isFullscreen]);

  // Listen for fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div ref={containerRef} className={cn(
      "overflow-hidden rounded-lg",
      isFullscreen && "bg-background overflow-auto h-screen"
    )}>
      <Card className={cn(
        "overflow-hidden border",
        isFullscreen && "border-0 rounded-none min-h-full"
      )}>
        <CardHeader className="py-3 border-b bg-muted/30">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">{visualization.title || "Interactive Visualization"}</CardTitle>
              {appearsBroken && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  May need fix
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {lessonId && isOwner && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setShowFeedbackForm(!showFeedbackForm)}
                  className="gap-1 text-muted-foreground hover:text-foreground"
                  disabled={isRegenerating}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">Feedback</span>
                </Button>
              )}
              <Button 
                size="sm" 
                variant="outline" 
                onClick={toggleFullscreen}
                className="gap-1"
              >
                {isFullscreen ? (
                  <><Minimize2 className="h-4 w-4" /> <span className="hidden sm:inline">Exit Fullscreen</span></>
                ) : (
                  <><Maximize2 className="h-4 w-4" /> <span className="hidden sm:inline">Fullscreen</span></>
                )}
              </Button>
            </div>
          </div>
          {visualization.description && (
            <p className="text-sm text-muted-foreground mt-2">{visualization.description}</p>
          )}
          
          {/* Feedback Form - Only visible to capsule owner */}
          {showFeedbackForm && lessonId && isOwner && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg border space-y-3">
              <div className="flex items-start gap-2">
                <MessageSquare className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-sm">Regenerate this visualization</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Describe what&apos;s wrong or how you&apos;d like it improved. Be specific!
                  </p>
                </div>
              </div>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="e.g., 'The animation doesn't work', 'Add a speed slider', 'Make it show the sorting steps more clearly', 'Change colors to be more visible'..."
                className="min-h-[80px] text-sm"
                maxLength={1000}
                disabled={isRegenerating}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {feedback.length}/1000 characters
                </span>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => {
                      setShowFeedbackForm(false);
                      setFeedback('');
                    }}
                    disabled={isRegenerating}
                  >
                    Cancel
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleRegenerate}
                    disabled={isRegenerating || feedback.trim().length < 10}
                    className="gap-2"
                  >
                    {isRegenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        Regenerate
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0 relative">
          {isRegenerating && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-medium text-foreground">Generating...</p>
                <p className="text-sm text-muted-foreground">Creating your improved visualization</p>
              </div>
            </div>
          )}
          <iframe
            ref={iframeRef}
            srcDoc={srcDoc}
            className={cn(
              "w-full border-0",
              isFullscreen ? "min-h-[calc(100vh-120px)]" : "min-h-[400px]"
            )}
            sandbox="allow-scripts"
            title={visualization.title || "Visualization"}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// FILL IN THE BLANKS COMPONENT
// =============================================================================

function FillBlanksQuiz({ 
  question, 
  onAnswer,
  initialAnswers,
  isAlreadyAnswered,
}: { 
  question: FillBlanksQuestion; 
  onAnswer: (isCorrect: boolean, score: number, answers: Record<string, string>) => void;
  initialAnswers?: Record<string, string>;
  isAlreadyAnswered?: boolean;
}) {
  // Track if we've initialized from props to avoid re-running restore logic
  const hasInitialized = useRef(false);
  
  const [answers, setAnswers] = useState<Record<string, string>>(() => initialAnswers || {});
  const [checked, setChecked] = useState(() => isAlreadyAnswered || false);
  const [showHints, setShowHints] = useState(false);
  const [results, setResults] = useState<Record<string, boolean>>(() => {
    if (isAlreadyAnswered && initialAnswers) {
      const res: Record<string, boolean> = {};
      question.blanks.forEach(blank => {
        const userAnswer = initialAnswers[blank.id]?.toLowerCase().trim() || '';
        const correctAnswer = blank.correctAnswer.toLowerCase().trim();
        const alternatives = blank.alternatives?.map(a => a.toLowerCase().trim()) || [];
        res[blank.id] = userAnswer === correctAnswer || alternatives.includes(userAnswer);
      });
      return res;
    }
    return {};
  });

  // Only restore state once when initialAnswers first becomes available
  useEffect(() => {
    if (!hasInitialized.current && initialAnswers && Object.keys(initialAnswers).length > 0) {
      hasInitialized.current = true;
      setAnswers(initialAnswers);
      // Recalculate results for restored answers
      const res: Record<string, boolean> = {};
      question.blanks.forEach(blank => {
        const userAnswer = initialAnswers[blank.id]?.toLowerCase().trim() || '';
        const correctAnswer = blank.correctAnswer.toLowerCase().trim();
        const alternatives = blank.alternatives?.map(a => a.toLowerCase().trim()) || [];
        res[blank.id] = userAnswer === correctAnswer || alternatives.includes(userAnswer);
      });
      setResults(res);
      if (isAlreadyAnswered) {
        setChecked(true);
      }
    }
  }, [initialAnswers, isAlreadyAnswered, question.blanks]);

  // Parse text with blanks (format: {{blankId}})
  // Support both 'text' and 'sentence' field names for compatibility
  const textContent = question.text || (question as unknown as { sentence?: string }).sentence || '';
  const parts = textContent.split(/(\{\{[^}]+\}\})/g);

  const handleCheck = () => {
    const newResults: Record<string, boolean> = {};
    let correctCount = 0;
    
    question.blanks.forEach(blank => {
      const userAnswer = answers[blank.id]?.toLowerCase().trim() || '';
      const correctAnswer = blank.correctAnswer.toLowerCase().trim();
      const alternatives = blank.alternatives?.map(a => a.toLowerCase().trim()) || [];
      
      const isCorrect = userAnswer === correctAnswer || alternatives.includes(userAnswer);
      newResults[blank.id] = isCorrect;
      if (isCorrect) correctCount++;
    });
    
    setResults(newResults);
    setChecked(true);
    
    const score = Math.round((correctCount / question.blanks.length) * 100);
    onAnswer(correctCount === question.blanks.length, score, answers);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{question.instruction || "Fill in the blanks"}</p>
      
      <div className="p-4 bg-muted/30 rounded-lg text-lg leading-relaxed flex flex-wrap items-center gap-1">
        {parts.map((part, index) => {
          const match = part.match(/\{\{([^}]+)\}\}/);
          if (match) {
            const blankId = match[1];
            const blank = question.blanks.find(b => b.id === blankId);
            const isCorrect = results[blankId];
            
            return (
              <span key={index} className="inline-flex items-center gap-1">
                <Input
                  value={answers[blankId] || ''}
                  onChange={(e) => setAnswers(prev => ({ ...prev, [blankId]: e.target.value }))}
                  disabled={checked}
                  className={cn(
                    "w-32 h-8 text-center font-medium inline-block",
                    checked && isCorrect && "border-green-500 bg-green-500/10",
                    checked && !isCorrect && "border-red-500 bg-red-500/10"
                  )}
                  placeholder="..."
                />
                {checked && !isCorrect && blank && (
                  <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                    {blank.correctAnswer}
                  </span>
                )}
              </span>
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </div>

      {/* Show Hints Button */}
      {!checked && question.blanks.some(b => b.hint) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowHints(!showHints)}
          className="gap-2"
        >
          <Lightbulb className="h-4 w-4" />
          {showHints ? 'Hide Hints' : 'Show Hints'}
        </Button>
      )}

      {/* Hints (only shown when showHints is true) */}
      {!checked && showHints && question.blanks.some(b => b.hint) && (
        <div className="flex flex-wrap gap-2">
          {question.blanks.map((blank, i) => blank.hint && (
            <Badge key={i} variant="outline" className="text-xs">
              <Lightbulb className="h-3 w-3 mr-1" />
              Hint {i + 1}: {blank.hint}
            </Badge>
          ))}
        </div>
      )}

      {!checked && (
        <Button onClick={handleCheck} disabled={Object.keys(answers).length === 0}>
          Check Answers
        </Button>
      )}

      {/* Try Again button for incorrect answers */}
      {checked && !Object.values(results).every(r => r) && (
        <Button
          variant="outline"
          onClick={() => {
            setAnswers({});
            setChecked(false);
            setResults({});
            setShowHints(false);
          }}
          className="w-full"
        >
          Try Again
        </Button>
      )}
    </div>
  );
}

// =============================================================================
// DRAG AND DROP QUIZ COMPONENT
// =============================================================================

function DragDropQuiz({ 
  question, 
  onAnswer,
  initialPlacements,
  isAlreadyAnswered,
}: { 
  question: DragDropQuestion; 
  onAnswer: (isCorrect: boolean, placements: Record<string, string>) => void;
  initialPlacements?: Record<string, string>;
  isAlreadyAnswered?: boolean;
}) {
  // Track if we've initialized from props to avoid re-running restore logic
  const hasInitialized = useRef(false);
  
  const [placements, setPlacements] = useState<Record<string, string>>(() => initialPlacements || {});
  const [checked, setChecked] = useState(() => isAlreadyAnswered || false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [shuffledItems] = useState(() => 
    [...question.items].sort(() => Math.random() - 0.5)
  );

  // Only restore state once when initialPlacements first becomes available
  useEffect(() => {
    if (!hasInitialized.current && initialPlacements && Object.keys(initialPlacements).length > 0) {
      hasInitialized.current = true;
      setPlacements(initialPlacements);
      if (isAlreadyAnswered) {
        setChecked(true);
      }
    }
  }, [initialPlacements, isAlreadyAnswered]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (over && active.id !== over.id) {
      // Remove from previous placement
      const newPlacements = { ...placements };
      Object.keys(newPlacements).forEach(targetId => {
        if (newPlacements[targetId] === active.id) {
          delete newPlacements[targetId];
        }
      });
      
      // Add to new target
      newPlacements[over.id as string] = active.id as string;
      setPlacements(newPlacements);
    }
  };

  const handleCheck = () => {
    let allCorrect = true;
    
    question.targets.forEach(target => {
      const placedItemId = placements[target.id];
      if (!placedItemId || !target.acceptsItems.includes(placedItemId)) {
        allCorrect = false;
      }
    });
    
    setChecked(true);
    onAnswer(allCorrect, placements);
  };

  const isItemPlaced = (itemId: string) => Object.values(placements).includes(itemId);
  
  const getPlacedItem = (targetId: string) => {
    const itemId = placements[targetId];
    return itemId ? question.items.find(i => i.id === itemId) : null;
  };

  const isTargetCorrect = (targetId: string): boolean => {
    const target = question.targets.find(t => t.id === targetId);
    const placedItemId = placements[targetId];
    return !!(target && placedItemId && target.acceptsItems.includes(placedItemId));
  };

  const activeItem = activeId ? question.items.find(i => i.id === activeId) : null;

  // Configure sensors for both mouse and touch support
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 5, // Require 5px movement before activating drag
    },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 150, // Small delay to distinguish from scroll
      tolerance: 5, // Allow 5px movement during delay
    },
  });
  const sensors = useSensors(mouseSensor, touchSensor);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{question.instruction || "Drag items to their correct targets"}</p>
        
        {/* Items to drag */}
        <div className="flex flex-wrap gap-2 p-4 bg-muted/30 rounded-lg min-h-[60px]">
          {shuffledItems.map(item => (
            <DraggableItem 
              key={item.id} 
              id={item.id} 
              content={item.content}
              isPlaced={isItemPlaced(item.id)}
            />
          ))}
          {shuffledItems.every(item => isItemPlaced(item.id)) && (
            <p className="text-sm text-muted-foreground">All items placed!</p>
          )}
        </div>

        {/* Drop targets */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {question.targets.map(target => (
            <DroppableTarget
              key={target.id}
              id={target.id}
              label={target.label}
              placedItem={getPlacedItem(target.id)}
              isCorrect={isTargetCorrect(target.id)}
              showResult={checked}
            />
          ))}
        </div>

        {/* Feedback */}
        {checked && (
          <div className={cn(
            "p-4 rounded-lg",
            question.targets.every(t => isTargetCorrect(t.id))
              ? "bg-green-500/10 border border-green-500/30"
              : "bg-amber-500/10 border border-amber-500/30"
          )}>
            <p className="font-medium">
              {question.targets.every(t => isTargetCorrect(t.id))
                ? question.feedback?.correct || "✓ All correct!"
                : question.feedback?.incorrect || "✗ Some matches need review"}
            </p>
            
            {/* Try Again button for incorrect answers */}
            {!question.targets.every(t => isTargetCorrect(t.id)) && (
              <Button
                variant="outline"
                onClick={() => {
                  setPlacements({});
                  setChecked(false);
                }}
                className="w-full mt-3"
              >
                Try Again
              </Button>
            )}
          </div>
        )}

        {!checked && (
          <Button 
            onClick={handleCheck} 
            disabled={Object.keys(placements).length < question.targets.length}
          >
            Check Matches
          </Button>
        )}
      </div>

      <DragOverlay>
        {activeItem && (
          <div className="px-3 py-2 bg-primary text-primary-foreground rounded-lg shadow-lg">
            {activeItem.content}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function MixedLesson({
  content,
  sections: propSections,
  codeExamples: propCodeExamples,
  interactiveVisualizations: propVisualizations,
  practiceQuestions: propQuestions,
  lessonId,
  isOwner = false,
  userId,
  onComplete,
  onQuizAnswer,
  onTypedAnswer,
  onNavigationChange,
  isCompleted = false,
  lastAnswer,
  typedProgress,
  startTime,
}: MixedLessonProps) {
  // Support both nested content object and direct props
  const sections = useMemo(() => propSections || content?.sections || [], [propSections, content?.sections]);
  const codeExamples = useMemo(() => propCodeExamples || content?.codeExamples || [], [propCodeExamples, content?.codeExamples]);
  const interactiveVisualizations = useMemo(() => propVisualizations || content?.interactiveVisualizations || [], [propVisualizations, content?.interactiveVisualizations]);
  const practiceQuestions = useMemo(() => propQuestions || content?.practiceQuestions || [], [propQuestions, content?.practiceQuestions]);

  // Detect if this is a failed lesson (content generation failed)
  const isFailedLesson = useMemo(() => {
    if (sections.length === 1) {
      const section = sections[0];
      const hasFailureMessage = typeof section.content === 'string' && 
        section.content.includes('could not be generated');
      const hasFailureKeyPoint = Array.isArray(section.keyPoints) && 
        section.keyPoints.includes('Content generation failed');
      return hasFailureMessage || hasFailureKeyPoint;
    }
    return false;
  }, [sections]);

  // Generate stable lesson ID
  const effectiveLessonId = useMemo(() => {
    return lessonId || `mixed-${sections.length}-${practiceQuestions.length}`;
  }, [lessonId, sections.length, practiceQuestions.length]);

  // Track timing
  const lessonStartRef = useRef<number>(startTime || Date.now());

  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showQuizFeedback, setShowQuizFeedback] = useState(false);
  const [markedComplete, setMarkedComplete] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questionResults, setQuestionResults] = useState<Record<number, boolean>>({});
  
  // Question regeneration state - combines local and database state for persistence
  const [showQuestionFeedbackForm, setShowQuestionFeedbackForm] = useState(false);
  const [questionFeedback, setQuestionFeedback] = useState('');
  
  // Query database for regeneration status (persists across navigation)
  const questionRegenerationStatus = useQuery(
    api.capsuleGeneration.getQuestionRegenerationStatus,
    lessonId ? { lessonId: lessonId as Id<'capsuleLessons'> } : 'skip'
  );
  
  // Check if current question is regenerating from database status
  const isQuestionRegeneratingFromDb = useMemo(() => {
    if (!questionRegenerationStatus) return false;
    const status = questionRegenerationStatus[currentQuestionIndex];
    return status?.status === 'pending' || status?.status === 'regenerating';
  }, [questionRegenerationStatus, currentQuestionIndex]);
  
  // Get error for current question if regeneration failed
  const questionRegenerationError = useMemo(() => {
    if (!questionRegenerationStatus) return null;
    const status = questionRegenerationStatus[currentQuestionIndex];
    if (status?.status === 'failed') {
      return status.error || 'Regeneration failed';
    }
    return null;
  }, [questionRegenerationStatus, currentQuestionIndex]);
  
  const regenerateQuestion = useAction(api.capsuleGeneration.regenerateQuestion);
  
  // Store per-question typed answers for persistence
  const [questionStates, setQuestionStates] = useState<QuestionState[]>([]);
  
  // Legacy: Store per-question answers for preservation when navigating (backward compat)
  const [questionAnswers, setQuestionAnswers] = useState<Record<number, {
    selectedAnswer: number | null; // for MCQ
    fillBlanksAnswers?: Record<string, string>; // for fill-blanks
    dragDropPlacements?: Record<string, string>; // for drag-drop
    isAnswered: boolean;
  }>>({});
  
  const { playCorrectSound, playIncorrectSound } = useSoundEffects();

  const currentQuestion = practiceQuestions[currentQuestionIndex];
  const hasQuiz = practiceQuestions.length > 0;

  // Helper to get question type string
  const getQuestionTypeString = useCallback((q: PracticeQuestion): 'mcq' | 'fillBlanks' | 'dragDrop' => {
    if (q.type === 'fillBlanks') return 'fillBlanks';
    if (q.type === 'dragDrop') return 'dragDrop';
    // Fallback detection for questions without explicit type
    if ('blanks' in q && Array.isArray((q as unknown as FillBlanksQuestion).blanks) && (q as unknown as FillBlanksQuestion).blanks.length > 0) {
      return 'fillBlanks';
    }
    if ('items' in q && Array.isArray((q as unknown as DragDropQuestion).items) && (q as unknown as DragDropQuestion).items.length > 0) {
      return 'dragDrop';
    }
    return 'mcq';
  }, []);

  // Restore state from typed progress or legacy answer
  useEffect(() => {
    setMarkedComplete(isCompleted);
    lessonStartRef.current = startTime || Date.now();
    
    // Prefer typed progress if available
    if (typedProgress && 'questionStates' in typedProgress) {
      const { questionStates: restoredStates, currentQuestionIndex: restoredIndex, allQuestionsAnswered } = typedProgress;
      
      setQuestionStates(restoredStates);
      setCurrentQuestionIndex(restoredIndex);
      
      // Rebuild legacy state from typed state for backward compatibility
      const legacyAnswers: typeof questionAnswers = {};
      const results: Record<number, boolean> = {};
      
      restoredStates.forEach((state, idx) => {
        if (state.answered && state.answer) {
          results[idx] = state.answer.type === 'mcq' 
            ? state.answer.isCorrect 
            : (state.answer as FillBlanksAnswer | DragDropAnswer).overallCorrect;
          
          if (state.answer.type === 'mcq') {
            legacyAnswers[idx] = {
              selectedAnswer: state.answer.selectedIndex,
              isAnswered: true,
            };
          } else if (state.answer.type === 'fillBlanks') {
            const fillAnswers: Record<string, string> = {};
            state.answer.blanks.forEach(b => {
              fillAnswers[b.blankId] = b.userAnswer;
            });
            legacyAnswers[idx] = {
              selectedAnswer: null,
              fillBlanksAnswers: fillAnswers,
              isAnswered: true,
            };
          } else if (state.answer.type === 'dragDrop') {
            const placements: Record<string, string> = {};
            state.answer.placements.forEach(p => {
              if (p.targetId) {
                placements[p.targetId] = p.itemId;
              }
            });
            legacyAnswers[idx] = {
              selectedAnswer: null,
              dragDropPlacements: placements,
              isAnswered: true,
            };
          }
        }
      });
      
      setQuestionAnswers(legacyAnswers);
      setQuestionResults(results);
      
      // Set UI state for current question
      const currentState = restoredStates[restoredIndex];
      if (currentState?.answered) {
        setShowQuizFeedback(true);
        if (currentState.answer?.type === 'mcq') {
          setSelectedAnswer(currentState.answer.selectedIndex);
        }
      }
      
      if (allQuestionsAnswered) {
        setMarkedComplete(true);
      }
    } else if (isCompleted && lastAnswer) {
      // Fall back to legacy restoration (only first question)
      setSelectedAnswer(lastAnswer.selectedIndex ?? null);
      setShowQuizFeedback(true);
      
      // Mark all questions as answered if lesson is already completed
      if (practiceQuestions.length > 0) {
        const allAnswered: Record<number, { selectedAnswer: number | null; isAnswered: boolean }> = {};
        const allResults: Record<number, boolean> = {};
        practiceQuestions.forEach((_, idx) => {
          allAnswered[idx] = { selectedAnswer: idx === 0 ? (lastAnswer.selectedIndex ?? null) : null, isAnswered: true };
          allResults[idx] = idx === 0 ? (lastAnswer.isCorrect ?? false) : true;
        });
        setQuestionAnswers(allAnswered);
        setQuestionResults(allResults);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompleted, lastAnswer, typedProgress, practiceQuestions.length, startTime]);

  // Note: We no longer reset state when sections change since we use key prop on parent
  // The key prop forces full component remount when lesson changes

  // Helper to create typed MCQ answer
  const createTypedMCQAnswer = useCallback((
    questionIndex: number,
    question: MCQQuestion,
    selectedIdx: number,
    isCorrect: boolean
  ): MCQAnswer => {
    const correctIdx = question.correctIndex ?? question.correct ?? 0;
    return {
      type: 'mcq',
      questionId: `${effectiveLessonId}-q${questionIndex}`,
      selectedIndex: selectedIdx,
      selectedText: question.options[selectedIdx],
      correctIndex: correctIdx,
      correctText: question.options[correctIdx],
      isCorrect,
      options: question.options,
      timestamp: Date.now(),
      timeSpentMs: Date.now() - lessonStartRef.current,
    };
  }, [effectiveLessonId]);

  // Helper to create typed FillBlanks answer
  const createTypedFillBlanksAnswer = useCallback((
    questionIndex: number,
    question: FillBlanksQuestion,
    answers: Record<string, string>,
    isCorrect: boolean,
    score: number
  ): FillBlanksAnswer => {
    const blanks = question.blanks.map(blank => {
      const userAnswer = answers[blank.id] || '';
      const blankIsCorrect = 
        userAnswer.toLowerCase() === blank.correctAnswer.toLowerCase() ||
        (blank.alternatives || []).some(alt => alt.toLowerCase() === userAnswer.toLowerCase());
      return {
        blankId: blank.id,
        userAnswer,
        correctAnswer: blank.correctAnswer,
        alternatives: blank.alternatives || [],
        isCorrect: blankIsCorrect,
      };
    });
    
    return {
      type: 'fillBlanks',
      questionId: `${effectiveLessonId}-q${questionIndex}`,
      blanks,
      overallCorrect: isCorrect,
      score,
      timestamp: Date.now(),
      timeSpentMs: Date.now() - lessonStartRef.current,
    };
  }, [effectiveLessonId]);

  // Helper to create typed DragDrop answer
  const createTypedDragDropAnswer = useCallback((
    questionIndex: number,
    question: DragDropQuestion,
    placements: Record<string, string>,
    isCorrect: boolean
  ): DragDropAnswer => {
    const placementResults = question.items.map(item => {
      // Find which target this item is placed on (placements is TargetId -> ItemId)
      const targetId = Object.entries(placements).find(([, itemId]) => itemId === item.id)?.[0] || '';
      const target = question.targets.find(t => t.id === targetId);
      const itemIsCorrect = target?.acceptsItems.includes(item.id) ?? false;
      return {
        itemId: item.id,
        itemContent: item.content,
        targetId,
        targetLabel: target?.label || '',
        isCorrect: itemIsCorrect,
      };
    });
    
    const correctCount = placementResults.filter(p => p.isCorrect).length;
    const score = question.items.length > 0 ? (correctCount / question.items.length) * 100 : 0;
    
    return {
      type: 'dragDrop',
      questionId: `${effectiveLessonId}-q${questionIndex}`,
      placements: placementResults,
      overallCorrect: isCorrect,
      score,
      timestamp: Date.now(),
      timeSpentMs: Date.now() - lessonStartRef.current,
    };
  }, [effectiveLessonId]);

  const handleMCQSubmit = useCallback(() => {
    if (selectedAnswer === null || !currentQuestion || currentQuestion.type !== 'mcq') return;
    
    const correctIdx = currentQuestion.correctIndex ?? (currentQuestion as MCQQuestion).correct ?? 0;
    const isCorrect = selectedAnswer === correctIdx;
    
    if (isCorrect) {
      playCorrectSound();
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    } else {
      playIncorrectSound();
    }
    
    setShowQuizFeedback(true);
    
    // Update question results
    const newResults = { ...questionResults, [currentQuestionIndex]: isCorrect };
    setQuestionResults(newResults);
    
    // Create typed answer and update state
    const typedAnswer = createTypedMCQAnswer(currentQuestionIndex, currentQuestion, selectedAnswer, isCorrect);
    
    // Build new question states array
    const newQuestionStates = [...questionStates];
    while (newQuestionStates.length <= currentQuestionIndex) {
      const q = practiceQuestions[newQuestionStates.length];
      newQuestionStates.push({
        questionIndex: newQuestionStates.length,
        questionType: q ? getQuestionTypeString(q) : 'mcq',
        answered: false,
      });
    }
    newQuestionStates[currentQuestionIndex] = {
      questionIndex: currentQuestionIndex,
      questionType: 'mcq',
      answered: true,
      answer: typedAnswer,
    };
    setQuestionStates(newQuestionStates);
    
    // Store answer for this question so it can be restored when navigating back
    setQuestionAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: {
        selectedAnswer,
        isAnswered: true,
      }
    }));
    
    // Calculate if all questions are now answered
    const allAnswered = Object.keys(newResults).length >= practiceQuestions.length;
    const correctCount = Object.values(newResults).filter(Boolean).length;
    const score = Math.round((correctCount / practiceQuestions.length) * 100);
    
    // Persist progress after each question answer
    if (onTypedAnswer) {
      const typedData: TypedMixedLessonAnswerData = {
        type: 'mixed',
        lessonId: effectiveLessonId,
        questionStates: newQuestionStates,
        allQuestionsAnswered: allAnswered,
        currentQuestionIndex,
        overallScore: score,
        timestamp: Date.now(),
        timeSpentMs: Date.now() - lessonStartRef.current,
      };
      onTypedAnswer(typedData);
    }
  }, [selectedAnswer, currentQuestion, currentQuestionIndex, playCorrectSound, playIncorrectSound, createTypedMCQAnswer, questionStates, questionResults, practiceQuestions, effectiveLessonId, onTypedAnswer, getQuestionTypeString]);

  const handleFillBlanksAnswer = useCallback((isCorrect: boolean, score: number, answers?: Record<string, string>) => {
    if (isCorrect) {
      playCorrectSound();
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    } else {
      playIncorrectSound();
    }
    
    setShowQuizFeedback(true);
    
    // Update question results
    const newResults = { ...questionResults, [currentQuestionIndex]: isCorrect };
    setQuestionResults(newResults);
    
    // Create typed answer and update state
    let typedAnswer: FillBlanksAnswer | undefined;
    if (currentQuestion && getQuestionTypeString(currentQuestion) === 'fillBlanks' && answers) {
      typedAnswer = createTypedFillBlanksAnswer(
        currentQuestionIndex, 
        currentQuestion as FillBlanksQuestion, 
        answers, 
        isCorrect, 
        score
      );
      
      // Build new question states array
      const newQuestionStates = [...questionStates];
      while (newQuestionStates.length <= currentQuestionIndex) {
        const q = practiceQuestions[newQuestionStates.length];
        newQuestionStates.push({
          questionIndex: newQuestionStates.length,
          questionType: q ? getQuestionTypeString(q) : 'mcq',
          answered: false,
        });
      }
      newQuestionStates[currentQuestionIndex] = {
        questionIndex: currentQuestionIndex,
        questionType: 'fillBlanks',
        answered: true,
        answer: typedAnswer,
      };
      setQuestionStates(newQuestionStates);
      
      // Calculate if all questions are now answered
      const allAnswered = Object.keys(newResults).length >= practiceQuestions.length;
      const correctCount = Object.values(newResults).filter(Boolean).length;
      const overallScore = Math.round((correctCount / practiceQuestions.length) * 100);
      
      // Persist progress after each question answer
      if (onTypedAnswer) {
        const typedData: TypedMixedLessonAnswerData = {
          type: 'mixed',
          lessonId: effectiveLessonId,
          questionStates: newQuestionStates,
          allQuestionsAnswered: allAnswered,
          currentQuestionIndex,
          overallScore,
          timestamp: Date.now(),
          timeSpentMs: Date.now() - lessonStartRef.current,
        };
        onTypedAnswer(typedData);
      }
    }
    
    // Store answers for preservation
    setQuestionAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: {
        selectedAnswer: null,
        fillBlanksAnswers: answers,
        isAnswered: true,
      }
    }));
  }, [currentQuestionIndex, currentQuestion, playCorrectSound, playIncorrectSound, createTypedFillBlanksAnswer, questionStates, questionResults, practiceQuestions, effectiveLessonId, onTypedAnswer, getQuestionTypeString]);

  const handleDragDropAnswer = useCallback((isCorrect: boolean, placements?: Record<string, string>) => {
    if (isCorrect) {
      playCorrectSound();
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    } else {
      playIncorrectSound();
    }
    
    setShowQuizFeedback(true);
    
    // Update question results
    const newResults = { ...questionResults, [currentQuestionIndex]: isCorrect };
    setQuestionResults(newResults);
    
    // Create typed answer and update state
    let typedAnswer: DragDropAnswer | undefined;
    if (currentQuestion && getQuestionTypeString(currentQuestion) === 'dragDrop' && placements) {
      typedAnswer = createTypedDragDropAnswer(
        currentQuestionIndex, 
        currentQuestion as DragDropQuestion, 
        placements, 
        isCorrect
      );
      
      // Build new question states array
      const newQuestionStates = [...questionStates];
      while (newQuestionStates.length <= currentQuestionIndex) {
        const q = practiceQuestions[newQuestionStates.length];
        newQuestionStates.push({
          questionIndex: newQuestionStates.length,
          questionType: q ? getQuestionTypeString(q) : 'mcq',
          answered: false,
        });
      }
      newQuestionStates[currentQuestionIndex] = {
        questionIndex: currentQuestionIndex,
        questionType: 'dragDrop',
        answered: true,
        answer: typedAnswer,
      };
      setQuestionStates(newQuestionStates);
      
      // Calculate if all questions are now answered
      const allAnswered = Object.keys(newResults).length >= practiceQuestions.length;
      const correctCount = Object.values(newResults).filter(Boolean).length;
      const score = Math.round((correctCount / practiceQuestions.length) * 100);
      
      // Persist progress after each question answer
      if (onTypedAnswer) {
        const typedData: TypedMixedLessonAnswerData = {
          type: 'mixed',
          lessonId: effectiveLessonId,
          questionStates: newQuestionStates,
          allQuestionsAnswered: allAnswered,
          currentQuestionIndex,
          overallScore: score,
          timestamp: Date.now(),
          timeSpentMs: Date.now() - lessonStartRef.current,
        };
        onTypedAnswer(typedData);
      }
    }
    
    // Store placements for preservation
    setQuestionAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: {
        selectedAnswer: null,
        dragDropPlacements: placements,
        isAnswered: true,
      }
    }));
  }, [currentQuestionIndex, currentQuestion, playCorrectSound, playIncorrectSound, createTypedDragDropAnswer, questionStates, questionResults, practiceQuestions, effectiveLessonId, onTypedAnswer, getQuestionTypeString]);

  const handleNextQuestion = useCallback(() => {
    if (currentQuestionIndex < practiceQuestions.length - 1) {
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
      
      // Notify parent of navigation change
      onNavigationChange?.(nextIndex);
      
      // Restore answer for next question if already answered
      const nextAnswer = questionAnswers[nextIndex];
      if (nextAnswer?.isAnswered) {
        setSelectedAnswer(nextAnswer.selectedAnswer);
        setShowQuizFeedback(true);
      } else {
        setSelectedAnswer(null);
        setShowQuizFeedback(false);
      }
    }
  }, [currentQuestionIndex, practiceQuestions.length, questionAnswers, onNavigationChange]);

  const handlePreviousQuestion = useCallback(() => {
    if (currentQuestionIndex > 0) {
      const prevIndex = currentQuestionIndex - 1;
      setCurrentQuestionIndex(prevIndex);
      
      // Notify parent of navigation change
      onNavigationChange?.(prevIndex);
      
      // Restore answer for previous question
      const prevAnswer = questionAnswers[prevIndex];
      if (prevAnswer?.isAnswered) {
        setSelectedAnswer(prevAnswer.selectedAnswer);
        setShowQuizFeedback(true);
      } else {
        setSelectedAnswer(null);
        setShowQuizFeedback(false);
      }
    }
  }, [currentQuestionIndex, questionAnswers, onNavigationChange]);

  // Handle question regeneration - schedules background job and returns immediately
  const handleRegenerateQuestion = useCallback(async () => {
    if (!lessonId) {
      toast.error('Cannot regenerate question - lesson ID not found');
      return;
    }
    
    if (!userId) {
      toast.error('Please sign in to regenerate questions');
      return;
    }

    try {
      await regenerateQuestion({
        lessonId: lessonId as Id<'capsuleLessons'>,
        questionIndex: currentQuestionIndex,
        userFeedback: questionFeedback.trim() || undefined,
        userId: userId as Id<'users'>,
      });
      
      toast.success('Question regeneration started in background...');
      setShowQuestionFeedbackForm(false);
      setQuestionFeedback('');
    } catch (error: unknown) {
      // Extract error message from Convex error structure
      let message = 'Failed to start regeneration';
      if (error instanceof Error) {
        message = error.message;
      } else if (typeof error === 'object' && error !== null) {
        const convexError = error as { message?: string; data?: { message?: string } };
        message = convexError.data?.message || convexError.message || message;
      }
      
      // Clean up Convex error wrapping
      message = message
        .replace(/^Uncaught Error:\s*/i, '')
        .replace(/^Error:\s*/i, '')
        .replace(/^Server Error:\s*/i, '');
      
      toast.error(message);
    }
  }, [lessonId, userId, currentQuestionIndex, questionFeedback, regenerateQuestion]);
  
  // Effect to handle regeneration completion from database status
  const prevRegenerationStatus = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!questionRegenerationStatus) return;
    
    const currentStatus = questionRegenerationStatus[currentQuestionIndex];
    const prevStatus = prevRegenerationStatus.current;
    
    // Detect transition to completed
    if (prevStatus && (prevStatus === 'pending' || prevStatus === 'regenerating') && 
        currentStatus?.status === 'completed') {
      toast.success('Question regenerated successfully!');
      
      // Reset the current question state since it's been replaced
      setSelectedAnswer(null);
      setShowQuizFeedback(false);
      
      // Clear the results for this question
      setQuestionResults(prev => {
        const newResults = { ...prev };
        delete newResults[currentQuestionIndex];
        return newResults;
      });
      
      // Clear the question state for this question
      setQuestionStates(prev => {
        const newStates = [...prev];
        if (newStates[currentQuestionIndex]) {
          newStates[currentQuestionIndex] = {
            ...newStates[currentQuestionIndex],
            answered: false,
            answer: undefined,
          };
        }
        return newStates;
      });
    }
    
    // Detect transition to failed
    if (prevStatus && (prevStatus === 'pending' || prevStatus === 'regenerating') && 
        currentStatus?.status === 'failed') {
      toast.error(currentStatus.error || 'Failed to regenerate question');
    }
    
    prevRegenerationStatus.current = currentStatus?.status;
  }, [questionRegenerationStatus, currentQuestionIndex]);

  // Check if all quiz questions have been answered
  const allQuestionsAnswered = hasQuiz && Object.keys(questionResults).length >= practiceQuestions.length;

  // Auto-complete lesson when all questions are answered
  useEffect(() => {
    if (allQuestionsAnswered && !markedComplete && hasQuiz) {
      // Small delay to show the last question's feedback before completion
      const timer = setTimeout(() => {
        setMarkedComplete(true);
        // Note: Sound and confetti disabled for lesson completion
        
        // Calculate final score and call onComplete + onQuizAnswer
        const correctCount = Object.values(questionResults).filter(Boolean).length;
        const score = Math.round((correctCount / practiceQuestions.length) * 100);
        
        // Call typed callback if provided (preferred)
        if (onTypedAnswer) {
          const typedData: TypedMixedLessonAnswerData = {
            type: 'mixed',
            lessonId: effectiveLessonId,
            questionStates,
            allQuestionsAnswered: true,
            currentQuestionIndex,
            overallScore: score,
            timestamp: Date.now(),
            timeSpentMs: Date.now() - lessonStartRef.current,
          };
          onTypedAnswer(typedData);
        }
        
        // Also call legacy callback for backward compatibility
        if (onQuizAnswer) {
          onQuizAnswer({
            selectedAnswer: `Final Score: ${score}%`,
            correctAnswer: "100%",
            isCorrect: score === 100,
          });
        }
        onComplete?.(score);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [allQuestionsAnswered, markedComplete, hasQuiz, questionResults, practiceQuestions.length, onQuizAnswer, onTypedAnswer, onComplete, effectiveLessonId, questionStates, currentQuestionIndex]);

  const handleMarkComplete = useCallback(() => {
    setMarkedComplete(true);
    // Note: Sound and confetti disabled for lesson completion
    
    // Calculate score based on quiz results if there was a quiz
    if (hasQuiz) {
      const correctCount = Object.values(questionResults).filter(Boolean).length;
      const score = Math.round((correctCount / practiceQuestions.length) * 100);
      
      // Call typed callback if provided
      if (onTypedAnswer) {
        const typedData: TypedMixedLessonAnswerData = {
          type: 'mixed',
          lessonId: effectiveLessonId,
          questionStates,
          allQuestionsAnswered: Object.keys(questionResults).length >= practiceQuestions.length,
          currentQuestionIndex,
          overallScore: score,
          timestamp: Date.now(),
          timeSpentMs: Date.now() - lessonStartRef.current,
        };
        onTypedAnswer(typedData);
      }
      
      onComplete?.(score);
    } else {
      // No quiz - just mark complete
      if (onTypedAnswer) {
        const typedData: TypedMixedLessonAnswerData = {
          type: 'mixed',
          lessonId: effectiveLessonId,
          questionStates: [],
          allQuestionsAnswered: true,
          currentQuestionIndex: 0,
          overallScore: 100,
          timestamp: Date.now(),
          timeSpentMs: Date.now() - lessonStartRef.current,
        };
        onTypedAnswer(typedData);
      }
      onComplete?.(100);
    }
  }, [onComplete, onTypedAnswer, hasQuiz, questionResults, practiceQuestions.length, effectiveLessonId, questionStates, currentQuestionIndex]);

  const getCorrectIndex = (q: MCQQuestion) => q.correctIndex ?? q.correct ?? 0;

  // Use the memoized getQuestionTypeString helper defined earlier
  const getQuestionType = getQuestionTypeString;

  return (
    <div className="space-y-6">
      <ConfettiCelebration show={showConfetti} onComplete={() => setShowConfetti(false)} />

      {/* Content Sections */}
      {sections.map((section, index) => (
        <Card key={index} className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">
                {section.title || `Section ${index + 1}`}
              </CardTitle>
              {section.type && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {section.type}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  h1: (props) => (
                    <h1 className="mb-3 mt-4 text-xl font-bold first:mt-0 text-foreground" {...props} />
                  ),
                  h2: (props) => (
                    <h2 className="mb-2.5 mt-4 text-lg font-semibold first:mt-0 text-foreground" {...props} />
                  ),
                  h3: (props) => (
                    <h3 className="mb-2 mt-3 text-base font-semibold first:mt-0 text-foreground" {...props} />
                  ),
                  p: (props) => (
                    <p className="mb-3 leading-relaxed last:mb-0 text-foreground" {...props} />
                  ),
                  ul: (props) => (
                    <ul className="mb-3 ml-4 list-disc space-y-1.5 text-foreground" {...props} />
                  ),
                  ol: (props) => (
                    <ol className="mb-3 ml-4 list-decimal space-y-1.5 text-foreground" {...props} />
                  ),
                  li: (props) => (
                    <li className="leading-relaxed" {...props} />
                  ),
                  blockquote: (props) => (
                    <blockquote className="my-3 border-l-4 border-primary/30 bg-primary/5 py-2 pl-4 pr-3 italic text-muted-foreground" {...props} />
                  ),
                  strong: (props) => (
                    <strong className="font-bold text-foreground" {...props} />
                  ),
                  a: (props) => (
                    <a className="text-primary underline hover:no-underline" target="_blank" rel="noopener noreferrer" {...props} />
                  ),
                  code: (props: React.HTMLAttributes<HTMLElement> & { inline?: boolean; className?: string; children?: React.ReactNode }) => {
                    const { inline, className, children, ...rest } = props;
                    const match = /language-(\w+)/.exec(className || '');
                    const language = match ? match[1] : '';

                    if (!inline && language) {
                      return (
                        <div className="my-3 overflow-hidden rounded-lg">
                          <SyntaxHighlighter
                            style={oneDark}
                            language={language}
                            PreTag="div"
                            className="!my-0 !bg-[#282c34] text-sm"
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        </div>
                      );
                    }

                    return (
                      <code
                        className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-sm font-semibold text-primary"
                        {...rest}
                      >
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {section.content || section.text || ''}
              </ReactMarkdown>
            </div>
            
            {section.keyPoints && section.keyPoints.length > 0 && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  <span className="font-semibold text-sm">Key Points</span>
                </div>
                <ul className="space-y-1">
                  {section.keyPoints.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <ChevronRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Interactive Visualizations */}
      {interactiveVisualizations.map((viz, index) => (
        <VisualizationFrame 
          key={index} 
          visualization={viz}
          lessonId={lessonId}
          visualizationIndex={index}
          isOwner={isOwner}
          userId={userId}
        />
      ))}

      {/* Code Examples */}
      {codeExamples.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Code className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-lg">Code Examples</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {codeExamples.map((example, index) => (
              <div key={index} className="space-y-2">
                {example.title && (
                  <h4 className="font-medium text-sm">{example.title}</h4>
                )}
                <div className="relative">
                  <pre className="p-4 bg-slate-900 text-slate-100 rounded-lg overflow-x-auto text-sm">
                    <code className={`language-${example.language || 'plaintext'}`}>
                      {example.code}
                    </code>
                  </pre>
                  {example.language && (
                    <Badge variant="secondary" className="absolute top-2 right-2 text-xs">
                      {example.language}
                    </Badge>
                  )}
                </div>
                {example.explanation && (
                  <p className="text-sm text-muted-foreground mt-2">{example.explanation}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Practice Questions */}
      {hasQuiz && currentQuestion && (
        <Card className="border-2 border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Knowledge Check</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {practiceQuestions.length > 1 && (
                  <Badge variant="outline">
                    Question {currentQuestionIndex + 1} of {practiceQuestions.length}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs">
                  {getQuestionType(currentQuestion) === 'mcq' ? 'Multiple Choice' : 
                   getQuestionType(currentQuestion) === 'fillBlanks' ? 'Fill Blanks' : 'Drag & Drop'}
                </Badge>
                {/* Regenerate Question Button - Only for owners */}
                {lessonId && isOwner && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowQuestionFeedbackForm(!showQuestionFeedbackForm)}
                    className="gap-1 text-muted-foreground hover:text-foreground"
                    disabled={isQuestionRegeneratingFromDb}
                  >
                    {isQuestionRegeneratingFromDb ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">Fix</span>
                  </Button>
                )}
              </div>
            </div>
            
            {/* Question regeneration in progress overlay */}
            {isQuestionRegeneratingFromDb && (
              <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/20 animate-pulse">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <div>
                    <p className="font-medium text-sm">Regenerating question...</p>
                    <p className="text-xs text-muted-foreground">This will take a few seconds</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Question regeneration error */}
            {questionRegenerationError && !isQuestionRegeneratingFromDb && (
              <div className="mt-4 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                  <div>
                    <p className="font-medium text-sm text-destructive">Regeneration failed</p>
                    <p className="text-xs text-muted-foreground mt-1">{questionRegenerationError}</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Question Regeneration Feedback Form */}
            {showQuestionFeedbackForm && lessonId && isOwner && !isQuestionRegeneratingFromDb && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg border space-y-3">
                <div className="flex items-start gap-2">
                  <RefreshCw className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">Regenerate this question</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      If this question has errors (wrong number of items, missing blanks, etc.), 
                      you can regenerate it. Optionally describe what&apos;s wrong.
                    </p>
                  </div>
                </div>
                <Textarea
                  value={questionFeedback}
                  onChange={(e) => setQuestionFeedback(e.target.value)}
                  placeholder="Optional: Describe what's wrong (e.g., 'Only 1 item but 2 targets', 'Missing blank placeholders')"
                  className="resize-none text-sm"
                  rows={2}
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowQuestionFeedbackForm(false);
                      setQuestionFeedback('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleRegenerateQuestion}
                    className="gap-1"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Regenerate Question
                  </Button>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* MCQ Question */}
            {getQuestionType(currentQuestion) === 'mcq' && (
              <>
                <p className="font-medium">{(currentQuestion as MCQQuestion).question}</p>
                <div className="space-y-2">
                  {(currentQuestion as MCQQuestion).options.map((option, optIndex) => {
                    const correctIdx = getCorrectIndex(currentQuestion as MCQQuestion);
                    const isSelected = selectedAnswer === optIndex;
                    const isCorrect = optIndex === correctIdx;
                    const showResult = showQuizFeedback;
                    
                    return (
                      <button
                        key={optIndex}
                        onClick={() => !showQuizFeedback && setSelectedAnswer(optIndex)}
                        disabled={showQuizFeedback}
                        className={cn(
                          "w-full text-left p-3 rounded-lg border-2 transition-all flex items-center gap-3",
                          !showResult && isSelected && "border-primary bg-primary/5",
                          !showResult && !isSelected && "border-muted hover:border-muted-foreground/30",
                          showResult && isCorrect && "border-green-500 bg-green-500/10",
                          showResult && isSelected && !isCorrect && "border-red-500 bg-red-500/10",
                          showQuizFeedback && "cursor-default"
                        )}
                      >
                        <div className={cn(
                          "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                          !showResult && isSelected && "border-primary bg-primary text-primary-foreground",
                          !showResult && !isSelected && "border-muted-foreground/30",
                          showResult && isCorrect && "border-green-500 bg-green-500 text-white",
                          showResult && isSelected && !isCorrect && "border-red-500 bg-red-500 text-white"
                        )}>
                          {showResult ? (
                            isCorrect ? <Check className="h-4 w-4" /> : (isSelected ? <X className="h-4 w-4" /> : null)
                          ) : (
                            isSelected && <Check className="h-3 w-3" />
                          )}
                        </div>
                        <span className="flex-1">{option}</span>
                      </button>
                    );
                  })}
                </div>

                {showQuizFeedback && (currentQuestion as MCQQuestion).explanation && (
                  <div className={cn(
                    "p-4 rounded-lg",
                    // Use saved questionResults for restored state, otherwise compute
                    (questionResults[currentQuestionIndex] ?? selectedAnswer === getCorrectIndex(currentQuestion as MCQQuestion))
                      ? "bg-green-500/10 border border-green-500/30" 
                      : "bg-amber-500/10 border border-amber-500/30"
                  )}>
                    <p className="font-medium mb-1">
                      {(questionResults[currentQuestionIndex] ?? selectedAnswer === getCorrectIndex(currentQuestion as MCQQuestion))
                        ? "✓ Correct!" 
                        : "✗ Not quite right"}
                    </p>
                    <p className="text-sm text-muted-foreground">{(currentQuestion as MCQQuestion).explanation}</p>
                    
                    {/* Try Again button for incorrect answers */}
                    {!(questionResults[currentQuestionIndex] ?? selectedAnswer === getCorrectIndex(currentQuestion as MCQQuestion)) && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedAnswer(null);
                          setShowQuizFeedback(false);
                        }}
                        className="w-full mt-3"
                      >
                        Try Again
                      </Button>
                    )}
                  </div>
                )}

                {!showQuizFeedback && (
                  <Button onClick={handleMCQSubmit} disabled={selectedAnswer === null}>
                    Check Answer
                  </Button>
                )}
              </>
            )}

            {/* Fill in Blanks Question */}
            {getQuestionType(currentQuestion) === 'fillBlanks' && (
              <FillBlanksQuiz 
                key={currentQuestionIndex}
                question={currentQuestion as FillBlanksQuestion} 
                onAnswer={handleFillBlanksAnswer}
                initialAnswers={questionAnswers[currentQuestionIndex]?.fillBlanksAnswers}
                isAlreadyAnswered={questionAnswers[currentQuestionIndex]?.isAnswered}
              />
            )}

            {/* Drag and Drop Question */}
            {getQuestionType(currentQuestion) === 'dragDrop' && (
              <DragDropQuiz 
                key={currentQuestionIndex}
                question={currentQuestion as DragDropQuestion}
                onAnswer={handleDragDropAnswer}
                initialPlacements={questionAnswers[currentQuestionIndex]?.dragDropPlacements}
                isAlreadyAnswered={questionAnswers[currentQuestionIndex]?.isAnswered}
              />
            )}

            {/* Navigation buttons for questions */}
            {showQuizFeedback && (
              <div className="flex justify-between pt-2">
                <Button 
                  variant="outline"
                  onClick={handlePreviousQuestion}
                  disabled={currentQuestionIndex === 0}
                >
                  <ChevronRight className="mr-1 h-4 w-4 rotate-180" />
                  Previous
                </Button>
                {currentQuestionIndex < practiceQuestions.length - 1 && (
                  <Button onClick={handleNextQuestion}>
                    Next Question <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Lesson Completion Section - Auto-completes when all questions answered */}
      {/* Hide for failed lessons that need regeneration */}
      {!isFailedLesson && (
        <Card className={cn(
          "transition-all",
          markedComplete ? "bg-green-500/5 border-green-500/20" : "border-2 border-dashed"
        )}>
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {markedComplete ? (
                  <>
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                    <div>
                      <span className="font-medium text-green-600">Lesson Complete!</span>
                      {hasQuiz && (
                        <p className="text-sm text-muted-foreground">
                          Score: {Math.round((Object.values(questionResults).filter(Boolean).length / practiceQuestions.length) * 100)}%
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <BookOpen className="h-6 w-6 text-muted-foreground" />
                    <div>
                      <span className="text-muted-foreground">
                        {hasQuiz 
                          ? `Answer all questions to complete (${Object.keys(questionResults).length}/${practiceQuestions.length})`
                          : "Finished reading? Mark this lesson as complete"}
                      </span>
                    </div>
                  </>
                )}
              </div>
              {/* Only show Mark Complete button for lessons without quiz - quizzes auto-complete */}
              {!markedComplete && !hasQuiz && (
                <Button 
                  onClick={handleMarkComplete}
                  className="gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Mark Complete
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default MixedLesson;
