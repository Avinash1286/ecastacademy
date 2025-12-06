import { Button } from '@/components/ui/button';
import { Copy, FlaskConical, Lightbulb, Sparkles, ClipboardList, Target } from 'lucide-react';
import { QuizQuestion } from '@/components/notes/QuizQuestion';
import { CalloutSection } from '@/components/notes/CalloutSection';
import { CodeBlock } from '@/components/notes/CodeBlock';
import { HighlightBox } from '@/components/notes/HighlightBox';
import { DefinitionCard } from '@/components/notes/DefinitionCard';
import { toast } from 'sonner';
import { InteractiveNotesProps } from '@/lib/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import 'katex/dist/katex.min.css';



export function InteractiveNotes({ topic, sections, learningObjectives, summary }: InteractiveNotesProps) {

  const copyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast("Copied to clipboard!");
    } catch{
      toast("Copy failed");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {topic}
          </h1>
          <p className="text-muted-foreground">
            Comprehensive notes with interactive quiz questions to test your understanding
          </p>
        </div>
      </div>

      {learningObjectives && learningObjectives.length > 0 && (
        <div className="rounded-xl border border-primary/10 bg-primary/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Learning Objectives</h2>
          </div>
          <ul className="grid gap-3 md:grid-cols-2">
            {learningObjectives.map((objective, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-foreground">
                <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-primary" />
                <span>{objective}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-8">
        {sections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="space-y-6">
            <div className="border-border">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-foreground">
                    {section.title}
                  </h2>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(section.content)}
                      className="p-2 text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {section.introHook && (
                  <div className="mb-4 flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950/40">
                    <Sparkles className="mt-1 h-4 w-4 text-yellow-600 dark:text-yellow-300" />
                    <p className="text-sm text-muted-foreground">
                      {section.introHook}
                    </p>
                  </div>
                )}

                <div className="prose prose-gray dark:prose-invert max-w-none mb-6">
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
                      h4: (props) => (
                        <h4 className="mb-2 mt-3 text-sm font-semibold first:mt-0 text-foreground" {...props} />
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
                      em: (props) => (
                        <em className="italic" {...props} />
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
                      pre: (props) => (
                        <pre className="my-3 overflow-x-auto rounded-lg bg-[#282c34] p-4" {...props} />
                      ),
                      table: (props) => (
                        <div className="my-4 overflow-x-auto">
                          <table className="min-w-full divide-y divide-border border border-border rounded-lg" {...props} />
                        </div>
                      ),
                      thead: (props) => (
                        <thead className="bg-muted/50" {...props} />
                      ),
                      th: (props) => (
                        <th className="px-4 py-2 text-left text-sm font-semibold text-foreground" {...props} />
                      ),
                      td: (props) => (
                        <td className="px-4 py-2 text-sm text-foreground border-t border-border" {...props} />
                      ),
                      hr: (props) => (
                        <hr className="my-6 border-border" {...props} />
                      ),
                    }}
                  >
                    {section.content}
                  </ReactMarkdown>
                </div>

                {section.microSummary && (
                  <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/40">
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                      <span className="text-sm font-semibold text-blue-700 dark:text-blue-200">
                        Quick Recap
                      </span>
                    </div>
                    <p className="text-sm text-blue-800 dark:text-blue-100">
                      {section.microSummary}
                    </p>
                  </div>
                )}

                {section.keyPoints && section.keyPoints.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-semibold text-primary mb-3">Key Points:</h3>
                    <ul className="space-y-2">
                      {section.keyPoints.map((point, pointIndex) => (
                        <li key={pointIndex} className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                          <span className="text-foreground">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

{section.examples && section.examples.length > 0 && (
  <div className="my-8">
    <div className="flex items-center gap-2 mb-4">
      <FlaskConical className="h-5 w-5 text-green-600 dark:text-green-400" />
      <h3 className="text-lg font-bold text-foreground">
        Practical Examples
      </h3>
    </div>

    <div className="space-y-4">
      {section.examples.map((example, exampleIndex) => (
        <div 
          key={exampleIndex} 
          className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <FlaskConical className="h-4 w-4 text-green-700 dark:text-green-300" />
            <span className="text-sm font-semibold text-green-700 dark:text-green-300">
              Example {exampleIndex + 1}
            </span>
          </div>
          <p className="pl-6 text-sm text-green-800 dark:text-green-200">
            {example}
          </p>
        </div>
      ))}
    </div>
  </div>
)}

                {section.callouts && section.callouts.length > 0 && (
                  <div className="mb-6 space-y-4">
                    {section.callouts.map((callout, calloutIndex) => (
                      <CalloutSection
                        key={calloutIndex}
                        type={callout.type}
                        title={callout.title}
                        content={callout.content}
                        bullets={callout.bullets}
                      />
                    ))}
                  </div>
                )}

                {section.codeBlocks && section.codeBlocks.length > 0 && (
                  <div className="mb-6 space-y-4">
                    {section.codeBlocks.map((codeBlock, codeIndex) => (
                      <CodeBlock
                        key={codeIndex}
                        code={codeBlock.code}
                        language={codeBlock.language}
                        title={codeBlock.title}
                      />
                    ))}
                  </div>
                )}

                {section.highlights && section.highlights.length > 0 && (
                  <div className="mb-6 space-y-4">
                    {section.highlights.map((highlight, highlightIndex) => (
                      <HighlightBox
                        key={highlightIndex}
                        type={highlight.type}
                        title={highlight.title}
                        content={highlight.content}
                      />
                    ))}
                  </div>
                )}

                {section.definitions && section.definitions.length > 0 && (
                  <div className="mb-6 space-y-4">
                    {section.definitions.map((definition, defIndex) => (
                      <DefinitionCard
                        key={defIndex}
                        term={definition.term}
                        definition={definition.definition}
                        example={definition.example}
                      />
                    ))}
                  </div>
                )}

                {section.interactivePrompts && section.interactivePrompts.length > 0 && (
                  <div className="mb-6 space-y-4">
                    <h3 className="text-lg font-semibold text-foreground">Try It Yourself</h3>
                    {section.interactivePrompts.map((activity, activityIndex) => (
                      <div
                        key={activityIndex}
                        className="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-900 dark:bg-purple-950/40"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-300" />
                          <span className="text-sm font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-200">
                            {activity.type.replace('-', ' ')}
                          </span>
                        </div>
                        <h4 className="text-base font-semibold text-foreground">{activity.title}</h4>
                        <p className="mt-2 text-sm text-muted-foreground">{activity.prompt}</p>
                        {activity.steps && (
                          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-foreground">
                            {activity.steps.map((step, stepIndex) => (
                              <li key={stepIndex}>{step}</li>
                            ))}
                          </ol>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {section.reflectionQuestions && section.reflectionQuestions.length > 0 && (
                  <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
                    <div className="flex items-center gap-2 mb-3">
                      <ClipboardList className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                      <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-200">Reflection Prompts</h3>
                    </div>
                    <ul className="space-y-2 text-sm text-emerald-800 dark:text-emerald-100">
                      {section.reflectionQuestions.map((question, questionIndex) => (
                        <li key={questionIndex}>• {question}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {section.quiz && section.quiz.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">
                  Test Your Understanding:
                </h3>
                <div className="space-y-4">
                  {section.quiz.map((quizQuestion, questionIndex) => (
                    <QuizQuestion
                      key={`${sectionIndex}-${questionIndex}`}
                      question={quizQuestion}
                      questionIndex={questionIndex}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {summary && (
        <div className="rounded-xl border border-muted bg-muted/40 p-6">
          <div className="flex items-center gap-3 mb-4">
            <ClipboardList className="h-5 w-5 text-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Session Wrap-up</h2>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">{summary.recap}</p>
          {summary.keyTakeaway && (
            <p className="mb-3 text-sm font-semibold text-foreground">Key Takeaway: {summary.keyTakeaway}</p>
          )}
          {summary.nextSteps && summary.nextSteps.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">Next Steps</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {summary.nextSteps.map((step, index) => (
                  <li key={index}>• {step}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}