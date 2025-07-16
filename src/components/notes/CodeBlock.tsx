import { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
}

export function CodeBlock({ code, language = 'javascript', title }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copyCode = useCallback(async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast.success("Code copied to clipboard!");
    } catch (err) {
      toast.error("Failed to copy code.");
      console.error("Copy failed:", err);
    }
  }, [code]);

  return (
    <TooltipProvider delayDuration={100}>
      <div className="relative my-6 rounded-xl border bg-[#0d1117]">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
          <div className="flex items-center gap-2">
            {title ? (
              <span className="text-sm text-gray-300">{title}</span>
            ) : (
              <div />
            )}
          </div>
          <div className="flex items-center gap-3">
            {language && (
              <span className="text-xs text-gray-400 uppercase">{language}</span>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-gray-400 hover:bg-white/10 hover:text-white"
                  onClick={copyCode}
                >
                  <span className="sr-only">Copy code</span>
                  {copied ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {copied ? 'Copied!' : 'Copy code'}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        
        <SyntaxHighlighter
          language={language}
          style={oneDark}
          customStyle={{
            margin: 0,
            padding: '1rem',
            backgroundColor: 'transparent',
            fontSize: '0.875rem',
          }}
          codeTagProps={{
            className: 'font-mono',
          }}
        >
          {code.trim()}
        </SyntaxHighlighter>
      </div>
    </TooltipProvider>
  );
}