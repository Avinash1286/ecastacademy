'use client';

import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';

import { CourseGridSkeleton } from '@/components/dashboard/CourseGridSkeleton';
import { useDashboard } from '@/context/DashboardContext';
import { Award, GraduationCap } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

// Extend session user type to include id
interface ExtendedUser {
  id: Id<"users">
  name?: string | null
  email?: string | null
  image?: string | null
}

const MyLearningsPage = () => {
  const { debouncedSearchTerm, searchTerm } = useDashboard();
  const { data: session, status } = useAuth();
  
  // Get userId from session
  const sessionUser = session?.user as unknown as ExtendedUser | undefined;
  const userId = sessionUser?.id;
  
  // Fetch enrolled courses with progress
  const enrolledCourses = useQuery(
    api.courses.getEnrolledCourses,
    userId && status === "authenticated" ? { userId } : "skip"
  );

  const loading = status === "loading" || (status === "authenticated" && userId && enrolledCourses === undefined);

  // Filter enrolled courses based on search
  const filteredEnrolledCourses = useMemo(() => {
    if (!enrolledCourses) return [];
    if (!debouncedSearchTerm) return enrolledCourses;
    return enrolledCourses.filter(
      (course) =>
        course.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        course.description?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    );
  }, [enrolledCourses, debouncedSearchTerm]);

  return (
    <main className="bg-background min-h-screen">
      <div className="container mx-auto max-w-7xl py-12 px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {/* Page Header */}
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">My Learnings</h1>
            <p className="text-muted-foreground text-lg">
              Continue your learning journey with your enrolled courses
            </p>
          </div>

          {/* Enrolled Courses Count */}
          {!loading && filteredEnrolledCourses.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <GraduationCap className="h-5 w-5" />
              <span>
                {filteredEnrolledCourses.length} course{filteredEnrolledCourses.length !== 1 ? 's' : ''} enrolled
              </span>
            </div>
          )}
          
          {loading ? (
            <CourseGridSkeleton />
          ) : filteredEnrolledCourses.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="mx-auto max-w-md">
                <div className="rounded-full bg-muted/50 w-20 h-20 flex items-center justify-center mx-auto mb-6">
                  <GraduationCap className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-2xl font-semibold mb-3">No Enrolled Courses</h3>
                <p className="text-muted-foreground mb-6">
                  {searchTerm 
                    ? 'No enrolled courses found matching your search.' 
                    : "You haven't enrolled in any courses yet. Start your learning journey by exploring available courses!"
                  }
                </p>
                {!searchTerm && (
                  <Link href="/dashboard">
                    <Button size="lg">
                      <BookOpen className="h-4 w-4 mr-2" />
                      Browse Courses
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredEnrolledCourses.map((course) => {
                const progressValue = Math.round(course.progressPercentage ?? 0);

                return (
                  <Link
                    key={course._id}
                    href={`/learnspace/${course._id}`}
                    className="block"
                  >
                    <article
                      className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover:-translate-y-1 hover:shadow-lg cursor-pointer"
                    >
                      <div className="relative w-full aspect-video bg-muted">
                      {course.thumbnailUrl ? (
                        <>
                          <Image
                            src={course.thumbnailUrl}
                            alt={`Thumbnail for ${course.name}`}
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            style={{ objectFit: 'cover' }}
                            className="transition-transform duration-500 hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        </>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
                          <BookOpen className="w-20 h-20 text-muted-foreground/40" />
                        </div>
                      )}

                      {course.isCertification && (
                        <div className="absolute top-3 right-3">
                          <Badge className="bg-amber-500/90 text-white shadow-lg">
                            <Award className="h-3 w-3 mr-1" />
                            Certificate
                          </Badge>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col gap-4 p-5">
                      <div className="space-y-2">
                        <h3 className="text-xl font-semibold text-card-foreground line-clamp-2">
                          {course.name}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {course.description || 'No description available for this course.'}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                          <span>Progress</span>
                          <span>{progressValue}%</span>
                        </div>
                        <Progress value={progressValue} className="h-2" />
                      </div>

                      <div className="mt-auto flex items-center justify-between gap-2">
                        <div className="text-xs text-muted-foreground">
                          {course.totalChapters ?? 0} chapter{(course.totalChapters ?? 0) === 1 ? '' : 's'}
                        </div>
                      </div>
                    </div>
                  </article>
                </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

function BookOpen({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

export default MyLearningsPage;
