import { Button } from '@/components/ui/button';
import { Copy, FlaskConical } from 'lucide-react';
import { QuizQuestion } from '@/components/notes/QuizQuestion';
import { CalloutSection } from '@/components/notes/CalloutSection';
import { CodeBlock } from '@/components/notes/CodeBlock';
import { HighlightBox } from '@/components/notes/HighlightBox';
import { DefinitionCard } from '@/components/notes/DefinitionCard';
import { toast } from 'sonner';
import { InteractiveNotesProps } from '@/lib/types';



export function InteractiveNotes({ topic, sections }: InteractiveNotesProps) {

  const copyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast("Copied to clipboard!");
    } catch (err) {
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

                <div className="prose prose-gray dark:prose-invert max-w-none mb-6">
                  <p className="text-foreground leading-relaxed whitespace-pre-line">
                    {section.content}
                  </p>
                </div>

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
    {/* 1. Improved Section Header */}
    <div className="flex items-center gap-2 mb-4">
      <FlaskConical className="h-5 w-5 text-green-600 dark:text-green-400" />
      <h3 className="text-lg font-bold text-foreground">
        Practical Examples
      </h3>
    </div>

    {/* 2. A structured list of example cards */}
    <div className="space-y-4">
      {section.examples.map((example, exampleIndex) => (
        <div 
          key={exampleIndex} 
          className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4"
        >
          {/* Card-like header for each example */}
          <div className="flex items-center gap-2 mb-2">
            <FlaskConical className="h-4 w-4 text-green-700 dark:text-green-300" />
            <span className="text-sm font-semibold text-green-700 dark:text-green-300">
              Example {exampleIndex + 1}
            </span>
          </div>
          {/* Indented content */}
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
    </div>
  );
}