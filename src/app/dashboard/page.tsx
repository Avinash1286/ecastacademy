'use client';

import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Course } from '@/lib/types';

import { CoursesPageHeader } from '@/components/dashboard/CoursesPageHeader';
import { CourseGrid } from '@/components/dashboard/CourseGrid';
import { CourseGridSkeleton } from '@/components/dashboard/CourseGridSkeleton';
import { useDashboard } from '@/context/DashboardContext';
import { BookOpen } from 'lucide-react';

const CoursesPage = () => {
  const { searchTerm } = useDashboard();
  
  // Fetch all published courses
  const allCourses = useQuery(api.courses.getAllCourses, { limit: 100, offset: 0 });

  const loading = allCourses === undefined;

  // Filter all courses based on search
  const filteredAllCourses = useMemo(() => {
    if (!allCourses) return [];
    if (!searchTerm) return allCourses;
    return allCourses.filter(
      (course) =>
        course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allCourses, searchTerm]);

  // Transform to Course type for display
  const allCoursesForGrid: Course[] = useMemo(() => {
    if (!filteredAllCourses) return [];
    return filteredAllCourses.map(course => ({
      id: course._id,
      name: course.name,
      description: course.description || '',
      thumbnailUrl: course.thumbnailUrl || '',
      createdAt: new Date(course.createdAt).toISOString(),
      isCertification: course.isCertification,
      passingGrade: course.passingGrade,
    }));
  }, [filteredAllCourses]);

  return (
    <main className="bg-background min-h-screen">
      <div className="container mx-auto max-w-7xl py-12 px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          <CoursesPageHeader />
          
          {loading ? (
            <CourseGridSkeleton />
          ) : allCoursesForGrid.length === 0 ? (
            <div className="text-center py-12 px-4">
              <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Courses Available</h3>
              <p className="text-muted-foreground">
                {searchTerm ? 'No courses found matching your search.' : 'No courses found. Check back later!'}
              </p>
            </div>
          ) : (
            <CourseGrid courses={allCoursesForGrid} />
          )}
        </div>
      </div>
    </main>
  );
};

export default CoursesPage;