"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Clock,
  PlayCircle,
  FileText,
  ListChecks,
  FileCheck,
  Link as LinkIcon,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import Image from "next/image";

const getContentIcon = (type: string) => {
  switch (type) {
    case "video":
      return <PlayCircle className="h-4 w-4" />;
    case "text":
      return <FileText className="h-4 w-4" />;
    case "quiz":
      return <ListChecks className="h-4 w-4" />;
    case "assignment":
      return <FileCheck className="h-4 w-4" />;
    case "resource":
      return <LinkIcon className="h-4 w-4" />;
    default:
      return <BookOpen className="h-4 w-4" />;
  }
};

const getContentTypeBadge = (type: string) => {
  const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
    video: "default",
    text: "secondary",
    quiz: "outline",
    assignment: "destructive",
    resource: "default",
  };
  return (
    <Badge variant={variants[type] || "default"} className="capitalize">
      {type}
    </Badge>
  );
};

const Page = () => {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as Id<"courses">;

  const course = useQuery(api.courses.getCourse, { id: courseId });
  const chapters = useQuery(api.chapters.getChaptersByCourse, { courseId });

  if (!course || !chapters) {
    return (
      <div className="container mx-auto max-w-7xl py-12 px-4 sm:px-6 lg:px-8">
        <Skeleton className="h-64 w-full mb-8" />
        <Skeleton className="h-10 w-3/4 mb-4" />
        <Skeleton className="h-6 w-full mb-2" />
        <Skeleton className="h-6 w-full mb-2" />
        <Skeleton className="h-6 w-2/3" />
      </div>
    );
  }

  const totalContentItems = chapters.reduce(
    (acc, chapter) => acc + (chapter.contentItems?.length || 0),
    0
  );

  const contentTypeCounts = chapters.reduce((acc, chapter) => {
    chapter.contentItems?.forEach((item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="container mx-auto max-w-7xl py-12 px-4 sm:px-6 lg:px-8">
      {/* Course Header */}
      <div className="mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-6">
          {/* Thumbnail */}
          {course.thumbnailUrl && (
            <div className="lg:col-span-1">
              <div className="relative aspect-video rounded-lg overflow-hidden border">
                <Image
                  src={course.thumbnailUrl}
                  alt={course.name}
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          )}

          {/* Course Info */}
          <div className={course.thumbnailUrl ? "lg:col-span-2" : "lg:col-span-3"}>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant={course.isPublished ? "default" : "secondary"}>
                {course.isPublished ? "Published" : "Draft"}
              </Badge>
              {course.status && (
                <Badge variant="outline" className="capitalize">
                  {course.status}
                </Badge>
              )}
            </div>

            <h1 className="text-4xl font-bold mb-4">{course.name}</h1>
            
            {course.description && (
              <p className="text-muted-foreground text-lg mb-6 whitespace-pre-wrap">
                {course.description}
              </p>
            )}

            {/* Course Stats */}
            <div className="flex flex-wrap gap-6 mb-6">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm">
                  <strong>{chapters.length}</strong> Chapters
                </span>
              </div>
              <div className="flex items-center gap-2">
                <PlayCircle className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm">
                  <strong>{totalContentItems}</strong> Content Items
                </span>
              </div>
              {contentTypeCounts.video > 0 && (
                <div className="flex items-center gap-2">
                  <PlayCircle className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm">
                    <strong>{contentTypeCounts.video}</strong> Videos
                  </span>
                </div>
              )}
            </div>

            <Button size="lg" onClick={() => router.push(`/learnspace/${courseId}`)}>
              Start Learning
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Course Curriculum */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-6">Course Curriculum</h2>

        {chapters.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-muted-foreground">
                This course doesn&apos;t have any chapters yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {chapters.map((chapter, index) => (
              <Card key={chapter._id}>
                <CardHeader>
                  <CardTitle className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-normal text-muted-foreground">
                          Chapter {index + 1}
                        </span>
                      </div>
                      <h3 className="text-xl">{chapter.name}</h3>
                      {chapter.description && (
                        <p className="text-sm text-muted-foreground font-normal mt-2">
                          {chapter.description}
                        </p>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!chapter.contentItems || chapter.contentItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No content items in this chapter yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {chapter.contentItems.map((item, itemIndex) => (
                        <div
                          key={item._id}
                          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                        >
                          <span className="text-sm text-muted-foreground min-w-[2rem]">
                            {itemIndex + 1}.
                          </span>
                          {getContentIcon(item.type)}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{item.title}</span>
                              {getContentTypeBadge(item.type)}
                            </div>
                            {item.type === "video" &&
                              "video" in item &&
                              item.video?.durationInSeconds && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                  <Clock className="h-3 w-3" />
                                  <span>
                                    {Math.floor(item.video.durationInSeconds / 60)}:
                                    {String(item.video.durationInSeconds % 60).padStart(2, "0")}
                                  </span>
                                </div>
                              )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Start Button */}
      {chapters.length > 0 && (
        <div className="flex justify-center">
          <Button size="lg" onClick={() => router.push(`/learnspace/${courseId}`)}>
            Start Learning
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default Page;
