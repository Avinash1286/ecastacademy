'use client';

import { Button } from '@/components/ui/button';
import { Loader2, SendHorizonal } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

type TutorInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  isSending: boolean;
  disabled?: boolean;
  placeholder?: string;
};

export function TutorInput({
  value,
  onChange,
  onSubmit,
  isSending,
  disabled,
  placeholder = 'Ask anything',
}: TutorInputProps) {
  const handleSubmit = () => {
    if (disabled || !value.trim()) return;
    onSubmit();
  };

  return (
    <div className="border-t bg-background p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Textarea
          value={value}
          placeholder={placeholder}
          disabled={disabled || isSending}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              handleSubmit();
            }
          }}
          aria-label="Ask the AI tutor"
          rows={2}
          className="min-h-[52px] flex-1 resize-none border border-border/60 bg-background text-sm leading-6"
        />
        <Button
          type="button"
          size="icon"
          className="h-12 w-12 shrink-0 disabled:opacity-50"
          disabled={disabled || isSending || !value.trim()}
          onClick={handleSubmit}
          aria-label="Send message"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizonal className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}