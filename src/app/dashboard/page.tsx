'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Course } from '@/lib/types';

import { CoursesPageHeader } from '@/components/dashboard/CoursesPageHeader';
import { CourseGrid } from '@/components/dashboard/CourseGrid';
import { CourseGridSkeleton } from '@/components/dashboard/CourseGridSkeleton';
import { useDashboard } from '@/context/DashboardContext';

const CoursesPage = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const { searchTerm } = useDashboard();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/courses');
        if (!response.ok) {
          throw new Error('Failed to fetch courses. Please try again later.');
        }
        const data: Course[] = await response.json();
        setCourses(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, []);

  const filteredCourses = useMemo(() => {
    if (!searchTerm) return courses;
    return courses.filter(
      (course) =>
        course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [courses, searchTerm]);

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
            <CourseGrid courses={filteredCourses} />
          )}
        </div>
      </div>
    </main>
  );
};

export default CoursesPage;