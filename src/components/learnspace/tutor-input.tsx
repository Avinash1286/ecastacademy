'use client';

import { Button } from '@/components/ui/button';
import { Loader2, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRef, useEffect } from 'react';

const MAX_MESSAGE_LENGTH = 1000;

type TutorInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  isSending: boolean;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
};

export function TutorInput({
  value,
  onChange,
  onSubmit,
  isSending,
  disabled,
  placeholder = 'Learn anything',
  maxLength = MAX_MESSAGE_LENGTH,
}: TutorInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const charCount = value.length;
  const isOverLimit = charCount > maxLength;
  const isNearLimit = charCount > maxLength * 0.9;

  const handleSubmit = () => {
    if (disabled || !value.trim() || isOverLimit) return;
    onSubmit();
  };

  const handleChange = (newValue: string) => {
    onChange(newValue);
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [value]);

  return (
    <div className="border-t bg-background p-4">
      <div
        className={cn(
          "relative flex items-end gap-2 rounded-full border bg-muted/50 px-4 py-2 transition-colors",
          isOverLimit ? "border-destructive" : "border-border/60 focus-within:border-primary/50"
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          placeholder={placeholder}
          disabled={disabled || isSending}
          onChange={(event) => handleChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              handleSubmit();
            }
          }}
          aria-label="Ask the AI tutor"
          rows={1}
          className={cn(
            "flex-1 resize-none bg-transparent text-sm leading-6 placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
            "min-h-[24px] max-h-[150px] py-1"
          )}
        />
        <Button
          type="button"
          size="icon"
          className={cn(
            "h-8 w-8 shrink-0 rounded-full transition-all",
            value.trim() && !isOverLimit && !disabled && !isSending
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted-foreground/20 text-muted-foreground cursor-not-allowed"
          )}
          disabled={disabled || isSending || !value.trim() || isOverLimit}
          onClick={handleSubmit}
          aria-label="Send message"
          title={isOverLimit ? `Message too long (max ${maxLength} characters)` : "Send message"}
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowUp className="h-4 w-4" />
          )}
        </Button>
      </div>
      {/* Character count - only show when typing */}
      {charCount > 0 && (
        <div className="flex justify-end mt-1.5 px-2">
          <span
            className={cn(
              "text-xs tabular-nums",
              isOverLimit ? "text-destructive font-medium" : 
              isNearLimit ? "text-amber-500" : "text-muted-foreground"
            )}
          >
            {charCount}/{maxLength}
          </span>
        </div>
      )}
      {isOverLimit && (
        <p className="mt-1 px-2 text-xs text-destructive">
          Message is too long. Please shorten it to {maxLength} characters or less.
        </p>
      )}
    </div>
  );
}