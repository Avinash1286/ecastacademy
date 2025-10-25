'use client';

import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { useSession } from 'next-auth/react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import type { Course } from '@/lib/types';

import { CourseGrid } from '@/components/dashboard/CourseGrid';
import { CourseGridSkeleton } from '@/components/dashboard/CourseGridSkeleton';
import { useDashboard } from '@/context/DashboardContext';
import { GraduationCap } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

// Extend session user type to include id
interface ExtendedUser {
  id: Id<"users">
  name?: string | null
  email?: string | null
  image?: string | null
}

const MyLearningsPage = () => {
  const { searchTerm } = useDashboard();
  const { data: session, status } = useSession();
  
  // Get userId from session
  const userId = session?.user ? (session.user as ExtendedUser).id : undefined;
  
  // Fetch enrolled courses with progress
  const enrolledCourses = useQuery(
    api.courses.getEnrolledCourses,
    userId && status === "authenticated" ? { userId } : "skip"
  );

  const loading = status === "loading" || (status === "authenticated" && userId && enrolledCourses === undefined);

  // Filter enrolled courses based on search
  const filteredEnrolledCourses = useMemo(() => {
    if (!enrolledCourses) return [];
    if (!searchTerm) return enrolledCourses;
    return enrolledCourses.filter(
      (course) =>
        course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [enrolledCourses, searchTerm]);

  // Transform to Course type for display
  const enrolledCoursesForGrid: Course[] = useMemo(() => {
    return filteredEnrolledCourses.map(course => ({
      id: course._id,
      name: course.name,
      description: course.description || '',
      thumbnailUrl: course.thumbnailUrl || '',
      createdAt: new Date(course.createdAt).toISOString(),
      isCertification: course.isCertification,
      passingGrade: course.passingGrade,
    }));
  }, [filteredEnrolledCourses]);

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
          {!loading && enrolledCoursesForGrid.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <GraduationCap className="h-5 w-5" />
              <span>
                {enrolledCoursesForGrid.length} course{enrolledCoursesForGrid.length !== 1 ? 's' : ''} enrolled
              </span>
            </div>
          )}
          
          {loading ? (
            <CourseGridSkeleton />
          ) : enrolledCoursesForGrid.length === 0 ? (
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
            <CourseGrid courses={enrolledCoursesForGrid} />
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
