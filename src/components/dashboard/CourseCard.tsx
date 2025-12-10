'use client';

import Link from 'next/link';
import Image from 'next/image';
import { BookOpen, Award, Bookmark, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Course } from '@/lib/types';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { toast } from 'sonner';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

export const CourseCard = ({ course }: { course: Course }) => {
  const { data: session } = useAuth();
  const isAuthenticated = !!session?.user;
  const userId = session?.user?.id as Id<"users"> | undefined;
  
  const [isToggling, setIsToggling] = useState(false);
  
  // Check if course is bookmarked
  const isBookmarked = useQuery(
    api.bookmarks.isCourseBookmarked,
    userId ? { userId, courseId: course.id as Id<"courses"> } : "skip"
  );
  
  const toggleBookmark = useMutation(api.bookmarks.toggleCourseBookmark);

  const handleBookmarkClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isAuthenticated || !userId) {
      toast.error("Please sign in to bookmark courses");
      return;
    }
    
    setIsToggling(true);
    try {
      const result = await toggleBookmark({ userId, courseId: course.id as Id<"courses"> });
      toast.success(result.action === "added" ? "Course bookmarked" : "Bookmark removed");
    } catch (error) {
      console.error("Error toggling bookmark:", error);
      toast.error("Failed to update bookmark");
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div className="group relative">
      <Link
        href={`/coursedetails/${course.id}`}
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
                style={{ objectFit: 'cover' }}
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
            {course.description || 'No description available for this course.'}
          </p>
        </div>
      </Link>
      
      {/* Bookmark Button */}
      <Button
        size="icon"
        variant="secondary"
        className={`absolute top-3 left-3 h-8 w-8 transition-all bg-background/80 hover:bg-background ${
          isBookmarked 
            ? 'opacity-100 text-primary' 
            : 'opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary'
        }`}
        onClick={handleBookmarkClick}
        disabled={isToggling}
        title={isBookmarked ? "Remove bookmark" : "Add bookmark"}
      >
        {isToggling ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Bookmark className={`h-4 w-4 ${isBookmarked ? 'fill-current' : ''}`} />
        )}
      </Button>
    </div>
  );
};