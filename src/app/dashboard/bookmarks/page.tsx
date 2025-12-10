"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bookmark,
  BookmarkX,
  BookOpen,
  FileText,
  Globe,
  Loader2,
  Sparkles,
  Award,
} from "lucide-react";
import { toast } from "sonner";

export default function BookmarksPage() {
  const router = useRouter();
  const { data: session, status } = useAuth();
  const isAuthenticated = !!session?.user;
  const userId = session?.user?.id as Id<"users"> | undefined;

  const [activeTab, setActiveTab] = useState<"courses" | "capsules">("courses");

  // Fetch bookmarked items
  const bookmarkedCourses = useQuery(
    api.bookmarks.getBookmarkedCourses,
    userId ? { userId } : "skip"
  );
  const bookmarkedCapsules = useQuery(
    api.bookmarks.getBookmarkedCapsules,
    userId ? { userId } : "skip"
  );

  // Mutations for removing bookmarks
  const toggleCourseBookmark = useMutation(api.bookmarks.toggleCourseBookmark);
  const toggleCapsuleBookmark = useMutation(api.bookmarks.toggleCapsuleBookmark);

  const handleRemoveCourseBookmark = async (courseId: Id<"courses">) => {
    if (!userId) return;
    try {
      await toggleCourseBookmark({ userId, courseId });
      toast.success("Bookmark removed");
    } catch (error) {
      console.error("Error removing bookmark:", error);
      toast.error("Failed to remove bookmark");
    }
  };

  const handleRemoveCapsuleBookmark = async (capsuleId: Id<"capsules">) => {
    if (!userId) return;
    try {
      await toggleCapsuleBookmark({ userId, capsuleId });
      toast.success("Bookmark removed");
    } catch (error) {
      console.error("Error removing bookmark:", error);
      toast.error("Failed to remove bookmark");
    }
  };

  // Loading state for auth
  if (status === "loading") {
    return (
      <main className="bg-background min-h-screen">
        <div className="container mx-auto max-w-7xl py-12 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </main>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <main className="bg-background min-h-screen">
        <div className="container mx-auto max-w-7xl py-12 px-4 sm:px-6 lg:px-8">
          <div className="text-center py-20">
            <Bookmark className="mx-auto h-16 w-16 text-muted-foreground/50 mb-6" />
            <h1 className="text-3xl font-bold mb-4">Your Bookmarks</h1>
            <p className="text-muted-foreground mb-6">
              Sign in to save courses and capsules for later.
            </p>
            <Button asChild>
              <Link href="/sign-in">Sign In</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const isCoursesLoading = bookmarkedCourses === undefined;
  const isCapsulesLoading = bookmarkedCapsules === undefined;

  const courseCount = bookmarkedCourses?.length ?? 0;
  const capsuleCount = bookmarkedCapsules?.length ?? 0;

  return (
    <main className="bg-background min-h-screen">
      <div className="container mx-auto max-w-7xl py-12 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Bookmark className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Bookmarks</h1>
          </div>
          <p className="text-muted-foreground">
            Your saved courses and capsules for quick access.
          </p>
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "courses" | "capsules")}
          className="space-y-6"
        >
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="courses" className="gap-2">
              <BookOpen className="h-4 w-4" />
              Courses
              {courseCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {courseCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="capsules" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Capsules
              {capsuleCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {capsuleCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Courses Tab */}
          <TabsContent value="courses">
            {isCoursesLoading ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(3)].map((_, idx) => (
                  <Card key={idx} className="h-64 animate-pulse bg-muted/40" />
                ))}
              </div>
            ) : bookmarkedCourses.length === 0 ? (
              <Card className="border-2 border-dashed border-border/50">
                <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mb-4 text-primary/50" />
                  <p className="text-lg font-medium mb-2">No bookmarked courses</p>
                  <p className="text-sm text-center max-w-md mb-4">
                    Explore courses and bookmark the ones you&apos;re interested in to find them here.
                  </p>
                  <Button asChild variant="outline">
                    <Link href="/dashboard">Explore Courses</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {bookmarkedCourses.map((course) => (
                  <div key={course._id} className="group relative">
                    <Link
                      href={`/coursedetails/${course._id}`}
                      className="block rounded-lg border border-border bg-card overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-primary/50 transform hover:-translate-y-1"
                    >
                      <div className="relative w-full aspect-video bg-muted">
                        {course.thumbnailUrl ? (
                          <>
                            <Image
                              src={course.thumbnailUrl}
                              alt={`Thumbnail for ${course.name}`}
                              fill
                              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                              style={{ objectFit: "cover" }}
                              className="transition-transform duration-500 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                          </>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
                            <BookOpen className="w-20 h-20 text-muted-foreground/40" />
                          </div>
                        )}

                        {/* Certification Badge */}
                        {course.isCertification && (
                          <div className="absolute top-3 right-3">
                            <Badge className="bg-amber-500/90 hover:bg-amber-500 text-white border-none shadow-lg">
                              <Award className="h-3 w-3 mr-1" />
                              Certificate
                            </Badge>
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="text-lg font-bold text-card-foreground truncate group-hover:text-primary transition-colors">
                          {course.name}
                        </h3>
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                          {course.description || "No description available for this course."}
                        </p>
                      </div>
                    </Link>

                    {/* Remove bookmark button */}
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute top-3 left-3 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={(e) => {
                        e.preventDefault();
                        handleRemoveCourseBookmark(course._id);
                      }}
                      title="Remove bookmark"
                    >
                      <BookmarkX className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Capsules Tab */}
          <TabsContent value="capsules">
            {isCapsulesLoading ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(3)].map((_, idx) => (
                  <Card key={idx} className="h-64 animate-pulse bg-muted/40" />
                ))}
              </div>
            ) : bookmarkedCapsules.length === 0 ? (
              <Card className="border-2 border-dashed border-border/50">
                <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Sparkles className="h-12 w-12 mb-4 text-primary/50" />
                  <p className="text-lg font-medium mb-2">No bookmarked capsules</p>
                  <p className="text-sm text-center max-w-md mb-4">
                    Create your own capsules or explore community capsules and bookmark them.
                  </p>
                  <Button asChild variant="outline">
                    <Link href="/dashboard/capsule">Explore Capsules</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {bookmarkedCapsules.map((capsule) => (
                  <div key={capsule._id} className="group relative">
                    <Card
                      className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-md bg-card h-full"
                      onClick={() => router.push(`/capsule/learn/${capsule._id}`)}
                    >
                      <CardContent className="p-5 min-h-[220px] flex flex-col">
                        {/* Header with icon */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shrink-0">
                            {capsule.isPublic ? (
                              <Globe className="h-5 w-5 text-blue-500" />
                            ) : (
                              <FileText className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          {capsule.isPublic && (
                            <Badge
                              variant="secondary"
                              className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/20"
                            >
                              Public
                            </Badge>
                          )}
                        </div>

                        {/* Title */}
                        <h3 className="font-semibold text-base line-clamp-2 mb-2">
                          {capsule.title}
                        </h3>

                        {/* Description */}
                        {capsule.description ? (
                          <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                            {capsule.description}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground/50 italic mb-3">
                            No description
                          </p>
                        )}

                        {/* Footer with module count */}
                        <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/50">
                          <Badge variant="outline" className="text-xs">
                            {capsule.status === "completed" ? "Completed" : capsule.status}
                          </Badge>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {capsule.moduleCount && <span>{capsule.moduleCount} modules</span>}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Remove bookmark button */}
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute top-3 right-12 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-destructive hover:text-destructive-foreground z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveCapsuleBookmark(capsule._id);
                      }}
                      title="Remove bookmark"
                    >
                      <BookmarkX className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
