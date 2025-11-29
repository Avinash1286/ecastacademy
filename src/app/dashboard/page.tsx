'use client';

import { useMemo, useState, useCallback } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Course } from '@/lib/types';

import { CoursesPageHeader } from '@/components/dashboard/CoursesPageHeader';
import { CourseGrid } from '@/components/dashboard/CourseGrid';
import { CourseGridSkeleton } from '@/components/dashboard/CourseGridSkeleton';
import { useDashboard } from '@/context/DashboardContext';
import { Button } from '@/components/ui/button';
import { BookOpen, Loader2 } from 'lucide-react';

const COURSES_PER_PAGE = 12;

const CoursesPage = () => {
  const { debouncedSearchTerm } = useDashboard();
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [allLoadedCourses, setAllLoadedCourses] = useState<Course[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Fetch courses with cursor-based pagination
  const queryArgs = { 
    limit: COURSES_PER_PAGE,
    ...(cursor ? { cursor } : {})
  };
  
  const coursesResult = useQuery(api.courses.getAllCourses, queryArgs);

  // Track if this is initial load or load more
  const isInitialLoading = coursesResult === undefined && allLoadedCourses.length === 0;

  // Combine loaded courses with new results
  const displayCourses = useMemo(() => {
    if (!coursesResult?.courses) return allLoadedCourses;
    
    // Transform new courses to Course type
    const newCourses: Course[] = coursesResult.courses.map(course => ({
      id: course._id,
      name: course.name,
      description: course.description || '',
      thumbnailUrl: course.thumbnailUrl || '',
      createdAt: new Date(course.createdAt).toISOString(),
      isCertification: course.isCertification,
      passingGrade: course.passingGrade,
    }));

    // If no cursor was set, this is fresh data (first load or reset)
    if (!cursor) {
      return newCourses;
    }
    
    // Otherwise append to existing courses (avoiding duplicates)
    const existingIds = new Set(allLoadedCourses.map(c => c.id));
    const uniqueNewCourses = newCourses.filter(c => !existingIds.has(c.id));
    return [...allLoadedCourses, ...uniqueNewCourses];
  }, [coursesResult?.courses, cursor, allLoadedCourses]);

  // Filter courses based on search
  const filteredCourses = useMemo(() => {
    if (!debouncedSearchTerm) return displayCourses;
    return displayCourses.filter(
      (course) =>
        course.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        course.description?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    );
  }, [displayCourses, debouncedSearchTerm]);

  // Handle load more
  const handleLoadMore = useCallback(() => {
    if (coursesResult?.nextCursor) {
      setIsLoadingMore(true);
      setAllLoadedCourses(displayCourses);
      setCursor(coursesResult.nextCursor);
    }
  }, [coursesResult?.nextCursor, displayCourses]);

  // Reset loading state when new data arrives
  useMemo(() => {
    if (coursesResult !== undefined) {
      setIsLoadingMore(false);
    }
  }, [coursesResult]);

  // Check if there are more courses to load
  const hasMore = coursesResult?.hasMore ?? false;

  return (
    <main className="bg-background min-h-screen">
      <div className="container mx-auto max-w-7xl py-12 px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          <CoursesPageHeader />
          
          {isInitialLoading ? (
            <CourseGridSkeleton />
          ) : filteredCourses.length === 0 ? (
            <div className="text-center py-12 px-4">
              <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Courses Available</h3>
              <p className="text-muted-foreground">
                {debouncedSearchTerm ? 'No courses found matching your search.' : 'No courses found. Check back later!'}
              </p>
            </div>
          ) : (
            <>
              <CourseGrid courses={filteredCourses} />
              
              {/* Load More Button */}
              {hasMore && !debouncedSearchTerm && (
                <div className="flex justify-center pt-8">
                  <Button
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    variant="outline"
                    size="lg"
                    className="min-w-[200px]"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Load More Courses'
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
};

export default CoursesPage;