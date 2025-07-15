import { CourseCard } from '@/components/dashboard/CourseCard';
import type { Course } from '@/lib/types';

interface CourseGridProps {
  courses: Course[];
}

export const CourseGrid = ({ courses }: CourseGridProps) => {
  if (courses.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-muted-foreground">No courses found matching your search.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((course) => (
        <CourseCard key={course.id} course={course} />
      ))}
    </div>
  );
};