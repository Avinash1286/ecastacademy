'use client';

import { useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
          background:#0f172a;
          color:#fff;
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
  instructions = 'Follow the instructions to interact with the simulation.',
  observationPrompts = [],
  learningGoals = [],
  learningObjective,
  onComplete,
}: SimulationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const hasRenderedRef = useRef(false);
  const onCompleteCalledRef = useRef(false);
  
  // Create a stable key based on the actual code content
  const codeKey = useMemo(() => {
    const html = code?.html || '';
    const css = code?.css || '';
    const js = code?.javascript || '';
    return `${html.length}-${css.length}-${js.length}-${html.slice(0, 50)}-${js.slice(0, 50)}`;
  }, [code?.html, code?.css, code?.javascript]);

  const resolvedInstructions = Array.isArray(instructions)
    ? instructions.join('\n')
    : instructions;
  const resolvedLearningGoals = learningGoals.length
    ? learningGoals
    : learningObjective
      ? [learningObjective]
      : [];

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
      iframe.style.height = '500px';
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
        containerRef.current.innerHTML = `<div class="text-red-500">Error loading simulation</div>`;
      }
    }
  }, [codeKey]); // Only depend on codeKey, not the full code object

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
  }, []); // Empty dependency - only run once on mount

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{title || 'Interactive Simulation'}</CardTitle>
          <p className="text-sm text-muted-foreground">{description || 'Explore this interactive simulation'}</p>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 whitespace-pre-wrap">
              {resolvedInstructions || 'Follow the instructions to interact with the simulation.'}
            </p>
          </div>

          <div
            ref={containerRef}
            className="bg-muted/30 rounded-lg min-h-[500px] flex items-center justify-center"
          >
            <p className="text-muted-foreground">Loading simulation...</p>
          </div>
        </CardContent>
      </Card>

      {observationPrompts && observationPrompts.length > 0 && (
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

      {resolvedLearningGoals && resolvedLearningGoals.length > 0 && (
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
