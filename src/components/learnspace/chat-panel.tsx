'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
// import { useChat } from '@ai-sdk/react'; // Removed
import { useAuth } from '@/hooks/useAuth';
import { useMutation, usePaginatedQuery, useAction } from 'convex/react';
import { toast } from 'sonner';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { type UIMessage } from 'ai'; // Removed DefaultChatTransport
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { Bot, Loader2, MessageSquareText, User } from 'lucide-react';
import { ChapterWithVideo, ContentItem } from '@/lib/types';
import { TutorInput } from '@/components/learnspace/tutor-input';
import { cn } from '@/lib/utils';
import 'katex/dist/katex.min.css';

type ChatPanelProps = {
  activeChapter: ChapterWithVideo;
  activeContentItem?: ContentItem | null;
};

type VideoWithTranscript = (NonNullable<ChapterWithVideo['video']> & { transcript?: string | null }) | null;

type QuizPayload = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  // Add index signature to allow for other properties if needed
  [key: string]: unknown;
};

type ExtendedUser = {
  id: Id<'users'>;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export function ChatPanel({ activeChapter, activeContentItem }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [isThinking, setIsThinking] = useState(false);

  // Check if transcript is available (using hasTranscript flag since transcript is loaded on demand)
  const hasTranscript = useMemo(() => {
    if (activeContentItem?.type === 'video') {
      return activeContentItem.videoDetails?.hasTranscript || !!activeContentItem.videoDetails?.transcript;
    }
    // Check the chapter video for hasTranscript flag or actual transcript
    const video = activeChapter.video as VideoWithTranscript & { hasTranscript?: boolean };
    return video?.hasTranscript || !!video?.transcript;
  }, [activeChapter.video, activeContentItem]);

  const videoTitle = useMemo(() => {
    if (activeContentItem?.type === 'video' && activeContentItem.title) {
      return activeContentItem.title;
    }
    return activeChapter.video?.title ?? activeChapter.name;
  }, [activeChapter.name, activeChapter.video?.title, activeContentItem]);

  const courseTitle = activeChapter.course?.name ?? 'Current course';
  const chapterKey = `${activeChapter.id}-${activeContentItem?.id ?? 'chapter'}`;
  const transcriptReady = hasTranscript;

  // Welcome message is now just a static item we can prepend if history is empty
  const welcomeMessage: UIMessage = useMemo(() => ({
    id: 'welcome',
    role: 'assistant',
    parts: [
      {
        type: 'text',
        text: `Hey there! 👋 I'm your AI tutor for this lesson.\n\nFeel free to ask me anything about **${videoTitle}** - whether you want me to:\n\n- Explain a concept in simpler terms\n- Walk through a formula step-by-step  \n- Quiz you on what you've learned\n- Clarify something that's confusing\n\nI'm here to help you truly understand the material. What would you like to explore?`,
      },
    ],
    content: '', // Legacy field for type compatibility
  }), [videoTitle]);

  const chatId = useMemo(() => {
    return `${chapterKey}-${transcriptReady ? 'ready' : 'pending'}`;
  }, [chapterKey, transcriptReady]);

  const { data: session, status: sessionStatus } = useAuth();
  const sessionUser = session?.user as unknown as ExtendedUser | undefined;
  const userId = sessionUser?.id;

  // New State for Session ID
  const [sessionId, setSessionId] = useState<Id<"chatSessions"> | null>(null);
  const getOrCreateSession = useMutation(api.chatSessions.getOrCreateSession);
  const saveMessage = useMutation(api.messages.send);
  const generateResponse = useAction(api.ai.generateTutorResponse);

  // Fetch Session ID - wait for session to be fully loaded
  useEffect(() => {
    if (sessionStatus !== "authenticated" || !userId || !chatId) return;

    const initSession = async () => {
      try {
        // Pass userId directly to the mutation
        const id = await getOrCreateSession({
          userId: userId as Id<"users">,
          chatId,
          chapterId: activeChapter.id,
          contentItemId: activeContentItem?.id,
          courseId: activeChapter.course?.id,
          title: videoTitle,
        });
        setSessionId(id);
      } catch (error) {
        console.error("Failed to init session:", error);
      }
    };

    initSession();
  }, [sessionStatus, userId, chatId, activeChapter.id, activeChapter.course?.id, activeContentItem?.id, videoTitle, getOrCreateSession]);

  // Paginated Query for Messages
  const { results: historicalMessages, status: queryStatus, loadMore } = usePaginatedQuery(
    api.messages.list,
    sessionId ? { sessionId } : "skip",
    { initialNumItems: 50 }
  );

  // Combine history with welcome message
  const messages: UIMessage[] = useMemo(() => {
    if (!historicalMessages) return [welcomeMessage];

    const converted = [...historicalMessages].reverse().map((msg) => ({
      id: msg._id,
      role: msg.role as 'user' | 'assistant',
      parts: [{ type: 'text' as const, text: msg.content }],
      content: msg.content,
    }));

    if (converted.length === 0) return [welcomeMessage];
    return converted;
  }, [historicalMessages, welcomeMessage]);

  const [input, setInput] = useState('');

  // Scroll handling
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const previousScrollHeightRef = useRef<number>(0);
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);

  useEffect(() => {
    if (isThinking) {
      setIsAutoScrolling(true);
    } else {
      const timer = setTimeout(() => setIsAutoScrolling(false), 100);
      return () => clearTimeout(timer);
    }
  }, [isThinking]);

  useEffect(() => {
    if (isAutoScrolling && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isAutoScrolling]);

  // Restore scroll position after loading more messages
  useEffect(() => {
    if (queryStatus !== "LoadingFirstPage" && previousScrollHeightRef.current > 0 && scrollRef.current) {
      const newScrollHeight = scrollRef.current.scrollHeight;
      const scrollDiff = newScrollHeight - previousScrollHeightRef.current;

      // Only adjust if content grew
      if (scrollDiff > 0) {
        scrollRef.current.scrollTop = scrollDiff;
      }

      previousScrollHeightRef.current = 0;
    }
  }, [historicalMessages, queryStatus]);

  // Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && queryStatus === "CanLoadMore") {
          // Capture current scroll height before loading
          if (scrollRef.current) {
            previousScrollHeightRef.current = scrollRef.current.scrollHeight;
            loadMore(20);
          }
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [queryStatus, loadMore]);

  const handleSend = async () => {
    if (!input.trim() || isThinking || !transcriptReady) {
      return;
    }

    if (!sessionId || !userId) {
      toast.error('Session starting', {
        description: 'Tutor session is still starting up. Please try again in a moment.',
        duration: 3000,
      });
      return;
    }

    const question = input.trim();
    setInput('');
    setIsThinking(true);
    setIsAutoScrolling(true);

    try {
      // 1. Save User Message
      await saveMessage({
        sessionId,
        userId,
        role: 'user',
        content: question,
      });

      // 2. Generate AI Response
      // Prepare context from recent messages (last 10)
      const recentMessages = messages.slice(-10).map(m => ({
        role: m.role as "user" | "assistant",
        content: messageToPlainText(m)
      }));

      // Add the new user message to the context if it's not already there
      recentMessages.push({ role: "user", content: question });

      // Get content item ID if applicable
      const contentItemId = activeContentItem?.type === 'video' ? activeContentItem.id : undefined;

      await generateResponse({
        userId: userId as Id<"users">,
        chatId: chatId,
        messages: recentMessages,
        // Pass chapter/content IDs for server-side transcript loading (transcript loaded on demand)
        chapterId: activeChapter.id,
        contentItemId: contentItemId,
        courseTitle: courseTitle,
        chapterTitle: activeChapter.name,
        videoTitle: videoTitle,
      });

      // The action saves the response, so the UI will update automatically via subscription

    } catch (error) {
      console.error('[TUTOR_CHAT_SEND_ERROR]', error);
      const errorMessage = error instanceof Error ? error.message : '';
      
      // Parse error and show user-friendly toast
      if (errorMessage.includes('overloaded') || errorMessage.includes('overload')) {
        toast.error('AI Tutor is busy', {
          description: 'The AI model is currently overloaded. Please try again in a few moments.',
          duration: 5000,
        });
      } else if (errorMessage.includes('rate limit') || errorMessage.includes('too many')) {
        toast.error('Too many requests', {
          description: 'Please wait a moment before sending another message.',
          duration: 5000,
        });
      } else if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
        toast.error('Request timed out', {
          description: 'The response took too long. Please try again.',
          duration: 5000,
        });
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        toast.error('Connection error', {
          description: 'Please check your internet connection and try again.',
          duration: 5000,
        });
      } else {
        toast.error('Unable to get response', {
          description: 'Something went wrong. Please try again.',
          duration: 5000,
        });
      }
      
      setInput(question); // Restore input
    } finally {
      setIsThinking(false);
    }
  };

  if (!transcriptReady) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-card p-8 text-center text-muted-foreground">
        <MessageSquareText className="h-12 w-12 text-primary/50" />
        <div>
          <p className="text-lg font-semibold">Transcript not available yet</p>
          <p className="mt-2 text-sm">
            We need the video transcript to power the AI tutor. Please wait a moment or choose another lesson
            that has finished processing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-background">
      {/* Messages Area */}
      <div
        ref={scrollRef}
        className="chat-scroll-area flex-1 space-y-6 overflow-y-auto px-6 py-8"
      >
        {/* Load More Trigger */}
        <div ref={loadMoreRef} className="h-1 w-full" />

        {queryStatus === "LoadingMore" && (
          <div className="flex justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        <ChatMessagesList messages={messages} status={isThinking ? 'streaming' : 'ready'} />
      </div>

      {/* Thinking Indicator */}
      {isThinking && (
        <div className="px-6 pb-4">
          <ThinkingIndicator />
        </div>
      )}

      {/* Input Area */}
      <TutorInput
        value={input}
        onChange={setInput}
        onSubmit={handleSend}
        isSending={isThinking}
        placeholder="Ask anything..."
        disabled={!transcriptReady}
      />
    </div>
  );
}

type ChatMessagesListProps = {
  messages: UIMessage[];
  status: 'streaming' | 'ready';
};

const ChatMessagesList = memo(function ChatMessagesList({ messages, status }: ChatMessagesListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-md space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5">
            <MessageSquareText className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h4 className="text-lg font-semibold text-foreground">Start a conversation</h4>
            <p className="text-sm leading-relaxed text-muted-foreground">
              I&apos;m here to help you understand the material. Ask me to explain concepts,
              clarify confusion, or quiz you on what you&apos;ve learned.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {messages.map((message, index) => (
        <ChatBubble
          key={message.id}
          message={message}
          isStreaming={
            status === 'streaming' &&
            message.role === 'assistant' &&
            index === messages.length - 1
          }
        />
      ))}
    </>
  );
});

type TextMessagePart = { type: 'text'; text: string };

type MessageWithOptionalParts = UIMessage & {
  parts?: Array<{ type?: string; text?: string }>;
  content?: string | Array<{ type?: string; text?: string }>;
};

function isTextPart(part: { type?: string; text?: unknown } | null | undefined): part is TextMessagePart {
  return Boolean(part && part.type === 'text' && typeof part.text === 'string');
}

function getMessageTextParts(message: UIMessage): TextMessagePart[] {
  const candidate = message as MessageWithOptionalParts;

  if (Array.isArray(candidate.parts)) {
    return candidate.parts.filter(isTextPart).map((part) => ({ type: 'text', text: part.text }));
  }

  if (Array.isArray(candidate.content)) {
    return candidate.content.filter(isTextPart).map((part) => ({ type: 'text', text: part.text }));
  }

  if (typeof candidate.content === 'string') {
    return [{ type: 'text', text: candidate.content }];
  }

  return [];
}

function messageToPlainText(message: UIMessage): string {
  const parts = getMessageTextParts(message);
  if (parts.length === 0) {
    const candidate = message as MessageWithOptionalParts;
    return typeof candidate.content === 'string' ? candidate.content : '';
  }
  return parts.map((part) => part.text).join('\n\n').trim();
}





function ChatBubble({ message, isStreaming }: { message: UIMessage; isStreaming: boolean }) {
  if (message.role !== 'user' && message.role !== 'assistant') {
    return null;
  }

  const isUser = message.role === 'user';
  const textParts = getMessageTextParts(message);

  const extracted = textParts.reduce(
    (
      acc: { quiz: QuizPayload | null; texts: string[] },
      part
    ) => {
      if (acc.quiz) {
        acc.texts.push(part.text);
        return acc;
      }
      const { quiz, markdown } = extractQuizPayload(part.text);
      if (quiz && !acc.quiz) {
        acc.quiz = quiz;
      }
      acc.texts.push(markdown);
      return acc;
    },
    { quiz: null, texts: [] }
  );

  const quizPayload = extracted.quiz;
  const sanitizedTextParts = extracted.texts;
  const hasMarkdown = sanitizedTextParts.some((text) => text.trim().length > 0);

  return (
    <div className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/10">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-3.5 text-sm shadow-sm',
          isUser
            ? 'bg-primary text-primary-foreground shadow-primary/10'
            : 'bg-card text-card-foreground border border-border/40'
        )}
      >
        {quizPayload && (
          <div className="mb-4">
            <QuizBubble quiz={quizPayload} />
          </div>
        )}
        {hasMarkdown ? (
          <div className="markdown-content space-y-3">
            {sanitizedTextParts.map((text, index) => (
              text.trim() ? (
                <ReactMarkdown
                  key={`${message.id}-part-${index}`}
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    h1: (props) => (
                      <h1 className="mb-3 mt-4 text-xl font-bold first:mt-0" {...props} />
                    ),
                    h2: (props) => (
                      <h2 className="mb-2.5 mt-4 text-lg font-semibold first:mt-0" {...props} />
                    ),
                    h3: (props) => (
                      <h3 className="mb-2 mt-3 text-base font-semibold first:mt-0" {...props} />
                    ),
                    h4: (props) => (
                      <h4 className="mb-2 mt-3 text-sm font-semibold first:mt-0" {...props} />
                    ),
                    p: (props) => (
                      <p className="mb-3 leading-relaxed last:mb-0" {...props} />
                    ),
                    ul: (props) => (
                      <ul className="mb-3 ml-4 list-disc space-y-1.5" {...props} />
                    ),
                    ol: (props) => (
                      <ol className="mb-3 ml-4 list-decimal space-y-1.5" {...props} />
                    ),
                    li: (props) => (
                      <li className="leading-relaxed" {...props} />
                    ),
                    blockquote: (props) => (
                      <blockquote className="my-3 border-l-4 border-primary/30 bg-primary/5 py-2 pl-4 pr-3 italic" {...props} />
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
                              className="!my-0 !bg-[#282c34] text-xs"
                            >
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          </div>
                        );
                      }

                      return (
                        <code
                          className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-primary"
                          {...rest}
                        >
                          {children}
                        </code>
                      );
                    },
                    table: (props) => (
                      <div className="my-3 overflow-x-auto">
                        <table className="w-full border-collapse border border-border text-sm" {...props} />
                      </div>
                    ),
                    thead: (props) => <thead className="bg-muted/50" {...props} />,
                    tbody: (props) => <tbody {...props} />,
                    tr: (props) => <tr className="border-b border-border" {...props} />,
                    th: (props) => (
                      <th className="border border-border px-3 py-2 text-left font-semibold" {...props} />
                    ),
                    td: (props) => (
                      <td className="border border-border px-3 py-2" {...props} />
                    ),
                    strong: (props) => (
                      <strong className="font-bold text-foreground" {...props} />
                    ),
                    em: (props) => <em className="italic" {...props} />,
                    hr: (props) => <hr className="my-4 border-t border-border" {...props} />,
                    a: (props) => (
                      <a
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
                        {...props}
                      />
                    ),
                  }}
                >
                  {text}
                </ReactMarkdown>
              ) : null
            ))}
          </div>
        ) : !quizPayload && isStreaming ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Thinking...
          </div>
        ) : null}
      </div>
      {isUser && (
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted ring-1 ring-border/40">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

function QuizBubble({ quiz }: { quiz: QuizPayload }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const reveal = selectedIndex !== null;
  const isCorrect = reveal && selectedIndex === quiz.correctIndex;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-foreground">{quiz.question}</p>
        <div className="mt-3 space-y-2">
          {quiz.options.map((option, index) => {
            const optionLetter = String.fromCharCode(65 + index);
            const isSelected = selectedIndex === index;
            const optionCorrect = index === quiz.correctIndex;
            return (
              <button
                key={`${quiz.question}-${index}`}
                type="button"
                disabled={reveal}
                onClick={() => {
                  if (!reveal) {
                    setSelectedIndex(index);
                  }
                }}
                className={cn(
                  'w-full rounded-xl border px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  reveal
                    ? optionCorrect
                      ? 'border-emerald-400/50 bg-emerald-500/10 text-foreground'
                      : 'border-border/40 bg-muted text-muted-foreground'
                    : 'border-border/40 bg-card/50 hover:border-primary/50 hover:bg-primary/5'
                )}
              >
                <span className="font-semibold text-foreground/80">{optionLetter}.</span>{' '}
                <span className="text-foreground/90">{option}</span>
                {reveal && isSelected && (
                  <span className="ml-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {optionCorrect ? 'Selected · Correct' : 'Selected'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      {reveal && (
        <div
          className={cn(
            'rounded-xl border px-3 py-2 text-sm leading-relaxed',
            isCorrect
              ? 'border-emerald-400/60 bg-emerald-500/5'
              : 'border-amber-400/60 bg-amber-500/5'
          )}
        >
          <p className="text-foreground/90">{quiz.explanation}</p>
        </div>
      )}
    </div>
  );
}

function extractQuizPayload(text: string): { quiz: QuizPayload | null; markdown: string } {
  const quizBlockRegex = /```quiz\s*([\s\S]*?)```/i;
  const match = quizBlockRegex.exec(text);
  if (!match) {
    return { quiz: null, markdown: text };
  }

  try {
    const parsed = JSON.parse(match[1].trim());
    const question = typeof parsed?.question === 'string' ? parsed.question.trim() : '';
    const explanation = typeof parsed?.explanation === 'string' ? parsed.explanation.trim() : '';
    const options = Array.isArray(parsed?.options)
      ? parsed.options
        .filter((option: unknown): option is string => typeof option === 'string')
        .map((option: string) => option.trim())
        .filter(Boolean)
      : [];
    const correctIndex = typeof parsed?.correctIndex === 'number' ? parsed.correctIndex : 0;

    if (!question || options.length < 2 || !explanation) {
      return { quiz: null, markdown: text };
    }

    const safeCorrectIndex = Math.min(Math.max(0, correctIndex), options.length - 1);
    const quiz: QuizPayload = {
      question,
      options,
      correctIndex: safeCorrectIndex,
      explanation,
    };

    const markdown = text.replace(match[0], '').trim();

    return { quiz, markdown };
  } catch (error) {
    console.warn('[QUIZ_PARSE_ERROR]', error);
    const markdown = text.replace(match[0], '').trim();
    return { quiz: null, markdown };
  }
}

function ThinkingIndicator() {
  return (
    <div className="inline-flex items-center gap-2.5 rounded-full border border-border/40 bg-card px-4 py-2.5 shadow-sm">
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.15s' }} />
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.3s' }} />
      </div>
      <span className="text-xs font-medium text-muted-foreground">AI is thinking...</span>
    </div>
  );
}
