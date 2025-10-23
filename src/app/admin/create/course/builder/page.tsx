'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import { api } from '../../../../../../convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Plus, Save } from 'lucide-react';
import { toast } from 'sonner';

interface CourseData {
  name: string;
  description: string;
  type: 'videos-only' | 'mixed';
}

export default function CourseBuilderPage() {
  const router = useRouter();
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  const createCourse = useMutation(api.courses.createCourse);

  useEffect(() => {
    const savedData = sessionStorage.getItem('newCourse');
    if (savedData) {
      const data = JSON.parse(savedData);
      if (data.type !== 'mixed') {
        toast.error('Invalid course type');
        router.push('/admin/create/course');
        return;
      }
      setCourseData(data);
    } else {
      toast.error('No course data found');
      router.push('/admin/create/course');
    }
  }, [router]);

  const handleCreateCourse = async () => {
    if (!courseData) {
      toast.error('Course data not found');
      return;
    }

    setIsCreating(true);

    try {
      // Create the course as draft
      const courseId = await createCourse({
        name: courseData.name,
        description: courseData.description,
      });

      toast.success('Course created successfully!');
      sessionStorage.removeItem('newCourse');
      
      // Redirect to admin course page where they can add chapters and content
      router.push(`/admin/courses/${courseId}`);
    } catch (error) {
      console.error('Error creating course:', error);
      toast.error('Failed to create course');
    } finally {
      setIsCreating(false);
    }
  };

  if (!courseData) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="container max-w-6xl py-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Course Builder</h1>
            <p className="text-muted-foreground">
              Create a mixed content course with custom chapters
            </p>
          </div>
        </div>

        {/* Course Info Summary */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Course Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Course Name</Label>
              <p className="text-lg">{courseData.name}</p>
            </div>
            {courseData.description && (
              <div>
                <Label className="text-sm font-medium">Description</Label>
                <p className="text-muted-foreground">{courseData.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Builder Info */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Next Steps
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-6">
              <h3 className="mb-4 text-lg font-semibold">
                Build Your Course Structure
              </h3>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  After creating your course, you&apos;ll be redirected to the admin panel where you can:
                </p>
                <ul className="ml-6 list-disc space-y-2">
                  <li>Add and organize chapters</li>
                  <li>Add multiple content types to each chapter (videos, text, quizzes, resources)</li>
                  <li>Reorder chapters and content items</li>
                  <li>Set chapter descriptions and metadata</li>
                  <li>Publish your course when ready</li>
                </ul>
              </div>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
              <p className="text-sm text-blue-900 dark:text-blue-300">
                <strong>Note:</strong> The course will be created as a draft. You can add content 
                and publish it when you&apos;re ready.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button
            variant="outline"
            onClick={() => router.back()}
            disabled={isCreating}
          >
            Back
          </Button>
          <Button
            onClick={handleCreateCourse}
            disabled={isCreating}
            className="min-w-[150px]"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Create Course
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
