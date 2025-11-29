'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { useSession } from 'next-auth/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, LogIn, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface EnrollButtonProps {
  courseId: Id<'courses'>;
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

// Extend session user type to include id
interface ExtendedUser {
  id: Id<"users">
  name?: string | null
  email?: string | null
  image?: string | null
}

export function EnrollButton({ courseId, variant = 'default', size = 'default', className }: EnrollButtonProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  
  // Get userId from session
  const sessionUser = session?.user as unknown as ExtendedUser | undefined;
  const userId = sessionUser?.id;
  
  const enrollmentStatus = useQuery(
    api.courses.isUserEnrolled, 
    userId && status === "authenticated" ? { courseId, userId } : "skip"
  );
  const enrollInCourse = useMutation(api.courses.enrollInCourse);
  const unenrollFromCourse = useMutation(api.courses.unenrollFromCourse);

  const handleEnroll = async () => {
    if (!userId) {
      toast.error('Please sign in to enroll');
      router.push('/auth/signin');
      return;
    }

    setIsLoading(true);
    try {
      const result = await enrollInCourse({ courseId, userId });
      toast.success(result.message);
      
      // Redirect to learnspace after enrollment
      router.push(`/learnspace/${courseId}`);
    } catch (error) {
      console.error('Enrollment error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to enroll in course');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnenroll = async () => {
    if (!userId) {
      toast.error('Please sign in');
      return;
    }

    setIsLoading(true);
    try {
      const result = await unenrollFromCourse({ courseId, userId });
      toast.success(result.message);
    } catch (error) {
      console.error('Unenrollment error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to unenroll from course');
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state or not authenticated
  if (status === "loading" || enrollmentStatus === undefined) {
    return (
      <Button variant={variant} size={size} disabled className={className}>
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading...
      </Button>
    );
  }

  // Already enrolled
  if (enrollmentStatus.isEnrolled) {
    const handleContinueLearning = () => {
      setIsNavigating(true);
      router.push(`/learnspace/${courseId}`);
    };

    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size={size}
          onClick={handleContinueLearning}
          disabled={isNavigating}
          className={className}
        >
          {isNavigating ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
          )}
          Continue Learning
        </Button>
        <Button
          variant="ghost"
          size={size}
          onClick={handleUnenroll}
          disabled={isLoading || enrollmentStatus.status === 'completed'}
          title={enrollmentStatus.status === 'completed' ? 'Cannot unenroll from completed course' : 'Unenroll from course'}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
        </Button>
      </div>
    );
  }

  // Not enrolled
  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleEnroll}
      disabled={isLoading}
      className={className}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Enrolling...
        </>
      ) : (
        <>
          <LogIn className="h-4 w-4 mr-2" />
          Enroll Now
        </>
      )}
    </Button>
  );
}
