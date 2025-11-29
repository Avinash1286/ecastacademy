'use client';

import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:;" />
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body {
          margin: 0;
          padding: 8px;
          font-family: system-ui, -apple-system, sans-serif;
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
        
        /* Control panel */
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
        
        /* Container - minimal padding */
        .viz-container, #viz-container, #visualization, #app {
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
        
        /* Light cards - DARK TEXT for contrast */
        .card, .box, .node, .step {
          background: hsl(210, 40%, 96%);
          color: hsl(222, 47%, 11%);
          border: 1px solid hsl(214, 32%, 91%);
          border-radius: 8px;
          padding: 12px 16px;
        }
        
        /* Colored elements with proper contrast */
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
        
        /* Headings */
        h1, h2, h3, h4 {
          color: hsl(213, 31%, 91%);
          margin-bottom: 8px;
        }
        
        ${css || ''}
      </style>
    </head>
    <body>
      ${html || '<div id="app"></div>'}
      <script>
        try {
          ${guardJavaScript(js)}
        } catch(e) {
          console.error('Simulation error:', e);
          document.body.innerHTML = '<div style="padding:20px;color:hsl(0, 84%, 60%);text-align:center;"><p>Error loading simulation</p><p style="font-size:12px;color:hsl(215, 20%, 65%);margin-top:8px;">' + e.message + '</p></div>';
        }
      <\\/script>
    </body>
  </html>
`;

interface SimulationProps {
  title?: string;
  description?: string;
  simulationType?: 'html-css-js';
  type?: 'html-css-js';
  code?: { html?: string; css?: string; javascript?: string };
  instructions?: string | string[];
  observationPrompts?: string[];
  learningGoals?: string[];
  learningObjective?: string;
  onComplete?: () => void;
}

export function SimulationLesson({
  title,
  description,
  code = { javascript: '' },
  // instructions prop is defined in interface but not currently used
  // instructions = 'Interact with the simulation using the controls provided.',
  observationPrompts = [],
  learningGoals = [],
  learningObjective,
  onComplete,
}: SimulationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const hasRenderedRef = useRef(false);
  const onCompleteCalledRef = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Create a stable key based on the actual code content
  const codeKey = useMemo(() => {
    const html = code?.html || '';
    const css = code?.css || '';
    const js = code?.javascript || '';
    return `${html.length}-${css.length}-${js.length}-${html.slice(0, 50)}-${js.slice(0, 50)}`;
  }, [code?.html, code?.css, code?.javascript]);

  const resolvedLearningGoals = learningGoals.length
    ? learningGoals
    : learningObjective
      ? [learningObjective]
      : [];

  const toggleFullscreen = useCallback(() => {
    if (!fullscreenContainerRef.current) return;
    
    if (!isFullscreen) {
      if (fullscreenContainerRef.current.requestFullscreen) {
        fullscreenContainerRef.current.requestFullscreen();
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

  // Render simulation only once when code changes
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Prevent re-rendering if the code hasn't actually changed
    if (hasRenderedRef.current && iframeRef.current) {
      return;
    }

    try {
      const iframe = document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = isFullscreen ? 'calc(100vh - 80px)' : '500px';
      iframe.style.border = 'none';
      iframe.style.borderRadius = '8px';
      iframe.style.background = 'transparent';
      iframe.setAttribute('sandbox', 'allow-scripts');
      iframe.setAttribute('referrerpolicy', 'no-referrer');

      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(iframe);

      const html = buildHtmlDocument(code?.html, code?.css, code?.javascript);
      iframe.srcdoc = html;
      
      iframeRef.current = iframe;
      hasRenderedRef.current = true;
    } catch (error) {
      console.error('Error rendering simulation:', error);
      if (containerRef.current) {
        containerRef.current.innerHTML = `<div class="text-red-500 p-4 text-center">Error loading simulation</div>`;
      }
    }
  }, [codeKey, isFullscreen, code?.html, code?.css, code?.javascript]);

  // Reset refs when code actually changes
  useEffect(() => {
    hasRenderedRef.current = false;
    iframeRef.current = null;
  }, [codeKey]);

  // Handle auto-complete separately, only call once
  useEffect(() => {
    if (onCompleteCalledRef.current || !onComplete) return;
    
    const timer = setTimeout(() => {
      if (!onCompleteCalledRef.current && onComplete) {
        onCompleteCalledRef.current = true;
        onComplete();
      }
    }, 3000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency - only run once on mount

  return (
    <div className="space-y-6">
      <div ref={fullscreenContainerRef} className={cn(
        "overflow-hidden rounded-lg",
        isFullscreen && "bg-background"
      )}>
        <Card className={cn(
          "overflow-hidden border",
          isFullscreen && "border-0 rounded-none h-full"
        )}>
          <CardHeader className="py-3 border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{title || 'Interactive Simulation'}</CardTitle>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={toggleFullscreen}
                className="gap-1"
              >
                {isFullscreen ? (
                  <><Minimize2 className="h-4 w-4" /> Exit Fullscreen</>
                ) : (
                  <><Maximize2 className="h-4 w-4" /> Fullscreen</>
                )}
              </Button>
            </div>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div
              ref={containerRef}
              className={cn(
                "bg-[hsl(224,71%,4%)] flex items-center justify-center",
                isFullscreen ? "min-h-[calc(100vh-80px)]" : "min-h-[500px]"
              )}
            >
              <p className="text-slate-400">Loading simulation...</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {!isFullscreen && observationPrompts && observationPrompts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Things to Notice</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {observationPrompts.map((prompt, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-primary mt-1">👁️</span>
                  <span>{prompt}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {!isFullscreen && resolvedLearningGoals && resolvedLearningGoals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Learning Goals</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {resolvedLearningGoals.map((goal, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-primary mt-1">🎯</span>
                  <span>{goal}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
