'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Course } from '@/lib/types';

import { CoursesPageHeader } from '@/components/dashboard/CoursesPageHeader';
import { CourseGrid } from '@/components/dashboard/CourseGrid';
import { CourseGridSkeleton } from '@/components/dashboard/CourseGridSkeleton';
import { useDashboard } from '@/context/DashboardContext';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const PAGE_SIZE = 9;

const CoursesPage = () => {
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const { searchTerm } = useDashboard();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchCourses = useCallback(async (pageNum: number) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const response = await fetch(`/api/courses?page=${pageNum}&limit=${PAGE_SIZE}`);
      if (!response.ok) {
        throw new Error('Failed to fetch courses. Please try again later.');
      }
      const newCourses: Course[] = await response.json();
      
      setAllCourses(prev => pageNum === 1 ? newCourses : [...prev, ...newCourses]);
      setHasMore(newCourses.length === PAGE_SIZE);

    } catch (err: any) {
      setError(err.message);
    } finally {
      if (pageNum === 1) setLoading(false);
      else setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses(1);
  }, [fetchCourses]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchCourses(nextPage);
  };

  const filteredCourses = useMemo(() => {
    // When searching, we filter from all loaded courses.
    if (!searchTerm) return allCourses;
    return allCourses.filter(
      (course) =>
        course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allCourses, searchTerm]);

  return (
    <main className="bg-background min-h-screen">
      <div className="container mx-auto max-w-7xl py-12 px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          <CoursesPageHeader />
          
          {loading ? (
            <CourseGridSkeleton />
          ) : error ? (
            <div className="text-center py-10">
              <p className="font-semibold text-destructive">{error}</p>
            </div>
          ) : (
            <>
              <CourseGrid courses={filteredCourses} />
              {!searchTerm && hasMore && (
                <div className="flex justify-center pt-4">
                  <Button onClick={handleLoadMore} disabled={loadingMore}>
                    {loadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Load More
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