"use client";

import { useState } from "react";
import YouTube from "react-youtube";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Download,
  ExternalLink,
  CheckCircle2,
  Clock,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

type ContentItem = {
  _id: string;
  type: "video" | "text" | "quiz" | "assignment" | "resource";
  title: string;
  order: number;
  // Type-specific fields
  videoId?: string;
  video?: {
    youtubeVideoId: string;
    title: string;
    url: string;
    thumbnailUrl?: string;
    durationInSeconds?: number;
    notes?: Record<string, unknown>;
    quiz?: {
      questions: Array<{
        question: string;
        options: string[];
        correctAnswer: number;
      }>;
    };
    transcript?: string;
  };
  textContent?: string;
  quizData?: {
    questions: Array<{
      question: string;
      options: string[];
      correctAnswer: number;
    }>;
  };
  assignmentData?: {
    description?: string;
    dueDate?: number | null;
  };
  resourceUrl?: string;
  resourceTitle?: string;
};

interface ContentRendererProps {
  contentItem: ContentItem;
  onComplete?: (contentItemId: string) => void;
  isCompleted?: boolean;
}

export function ContentRenderer({
  contentItem,
  onComplete,
  isCompleted = false,
}: ContentRendererProps) {
  const [quizCompleted, setQuizCompleted] = useState(false);

  const handleMarkComplete = () => {
    if (onComplete) {
      onComplete(contentItem._id);
    }
  };

  const handleQuizComplete = () => {
    setQuizCompleted(true);
    if (onComplete) {
      onComplete(contentItem._id);
    }
  };

  // Render based on content type
  switch (contentItem.type) {
    case "video":
      if (!contentItem.video) {
        return (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">Video not available</p>
            </CardContent>
          </Card>
        );
      }

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">{contentItem.title}</h2>
              <div className="flex items-center gap-2 mt-2">
                <Badge>Video</Badge>
                {isCompleted && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Completed
                  </Badge>
                )}
                {contentItem.video.durationInSeconds && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {Math.floor(contentItem.video.durationInSeconds / 60)}:
                    {String(contentItem.video.durationInSeconds % 60).padStart(2, "0")}
                  </span>
                )}
              </div>
            </div>
            {!isCompleted && (
              <Button onClick={handleMarkComplete}>Mark as Complete</Button>
            )}
          </div>

          <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
            <YouTube
              videoId={contentItem.video.youtubeVideoId}
              opts={{
                width: "100%",
                height: "100%",
                playerVars: {
                  autoplay: 0,
                  controls: 1,
                  rel: 0,
                  showinfo: 0,
                  modestbranding: 1,
                },
              }}
            />
          </div>

          {/* Notes Section */}
          {contentItem.video.notes && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Video notes will be displayed here.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Quiz Section */}
          {contentItem.video.quiz && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Quiz</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Video quiz will be displayed here ({contentItem.video.quiz.questions?.length || 0} questions).
                </p>
              </CardContent>
            </Card>
          )}

          {/* Transcript Section */}
          {contentItem.video.transcript && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Transcript</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="whitespace-pre-wrap">{contentItem.video.transcript}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      );

    case "text":
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">{contentItem.title}</h2>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary">Text Content</Badge>
                {isCompleted && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Completed
                  </Badge>
                )}
              </div>
            </div>
            {!isCompleted && (
              <Button onClick={handleMarkComplete}>Mark as Complete</Button>
            )}
          </div>

          <Card>
            <CardContent className="pt-6">
              <div 
                className="prose prose-lg dark:prose-invert max-w-none tiptap"
                dangerouslySetInnerHTML={{ __html: contentItem.textContent || "" }}
              />
            </CardContent>
          </Card>
        </div>
      );

    case "quiz":
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">{contentItem.title}</h2>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline">Quiz</Badge>
                {(isCompleted || quizCompleted) && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Completed
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {contentItem.quizData && contentItem.quizData.questions && contentItem.quizData.questions.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Quiz Content</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {contentItem.quizData.questions.length} questions available.
                </p>
                <Button onClick={handleQuizComplete}>
                  Complete Quiz
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  Quiz content is not available yet.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      );

    case "assignment":
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">{contentItem.title}</h2>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="destructive">Assignment</Badge>
                {isCompleted && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Submitted
                  </Badge>
                )}
                {contentItem.assignmentData?.dueDate && (
                  <span className="text-sm text-muted-foreground">
                    Due: {new Date(contentItem.assignmentData.dueDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            {!isCompleted && (
              <Button onClick={handleMarkComplete}>Submit Assignment</Button>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Assignment Details</CardTitle>
            </CardHeader>
            <CardContent>
              {contentItem.assignmentData?.description ? (
                <div className="prose prose-lg dark:prose-invert max-w-none">
                  <ReactMarkdown>
                    {contentItem.assignmentData.description}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  No assignment description available.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      );

    case "resource":
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">{contentItem.title}</h2>
              <div className="flex items-center gap-2 mt-2">
                <Badge>Resource</Badge>
                {isCompleted && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Accessed
                  </Badge>
                )}
              </div>
            </div>
            {!isCompleted && (
              <Button onClick={handleMarkComplete}>Mark as Accessed</Button>
            )}
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <FileText className="h-16 w-16 text-muted-foreground" />
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-2">
                    {contentItem.resourceTitle || contentItem.title}
                  </h3>
                  {contentItem.resourceUrl && (
                    <div className="flex gap-2 justify-center mt-4">
                      <Button
                        variant="default"
                        onClick={() => window.open(contentItem.resourceUrl, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open Resource
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          const link = document.createElement("a");
                          link.href = contentItem.resourceUrl!;
                          link.download = contentItem.resourceTitle || "resource";
                          link.click();
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );

    default:
      return (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              Unknown content type: {contentItem.type}
            </p>
          </CardContent>
        </Card>
      );
  }
}
