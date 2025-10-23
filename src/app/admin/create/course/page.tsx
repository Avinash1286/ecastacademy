'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { BookOpen, Video, Layers, ArrowRight } from 'lucide-react';

export default function CreateCoursePage() {
  const router = useRouter();
  const [courseType, setCourseType] = useState<'videos-only' | 'mixed'>('videos-only');
  const [courseName, setCourseName] = useState('');
  const [courseDescription, setCourseDescription] = useState('');

  const handleNext = () => {
    if (!courseName.trim()) {
      return;
    }

    // Store course data in sessionStorage for next step
    sessionStorage.setItem('newCourse', JSON.stringify({
      name: courseName,
      description: courseDescription,
      type: courseType
    }));

    if (courseType === 'videos-only') {
      // Redirect to video selection page
      router.push('/admin/create/course/select-videos');
    } else {
      // Redirect to course builder page
      router.push('/admin/create/course/builder');
    }
  };

  return (
    <div className="container mx-auto max-w-3xl py-12 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <BookOpen className="h-6 w-6" />
            Create New Course
          </CardTitle>
          <CardDescription>
            Set up your course structure and choose how you want to build it
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Course Name */}
          <div className="space-y-2">
            <Label htmlFor="courseName">Course Name *</Label>
            <Input
              id="courseName"
              placeholder="e.g., Introduction to Machine Learning"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              className="text-base"
            />
          </div>

          {/* Course Description */}
          <div className="space-y-2">
            <Label htmlFor="courseDescription">Course Description (Optional)</Label>
            <Textarea
              id="courseDescription"
              placeholder="Describe what students will learn in this course..."
              value={courseDescription}
              onChange={(e) => setCourseDescription(e.target.value)}
              rows={4}
              className="text-base resize-none"
            />
          </div>

          {/* Course Type Selection */}
          <div className="space-y-4">
            <Label>Course Type *</Label>
            <RadioGroup value={courseType} onValueChange={(value) => setCourseType(value as 'videos-only' | 'mixed')}>
              {/* Videos Only Option */}
              <Card className={`cursor-pointer transition-all ${courseType === 'videos-only' ? 'border-primary shadow-md' : 'hover:border-primary/50'}`}>
                <label htmlFor="videos-only" className="cursor-pointer">
                  <CardContent className="flex items-start gap-4 p-6">
                    <RadioGroupItem value="videos-only" id="videos-only" className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Video className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold text-lg">Videos Only</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Quick setup: Select existing videos from your library. Each video becomes one chapter automatically.
                      </p>
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="px-2 py-1 bg-muted rounded">Fast</span>
                        <span className="px-2 py-1 bg-muted rounded">Auto-organized</span>
                        <span className="px-2 py-1 bg-muted rounded">Video-based</span>
                      </div>
                    </div>
                  </CardContent>
                </label>
              </Card>

              {/* Mixed Type Option */}
              <Card className={`cursor-pointer transition-all ${courseType === 'mixed' ? 'border-primary shadow-md' : 'hover:border-primary/50'}`}>
                <label htmlFor="mixed" className="cursor-pointer">
                  <CardContent className="flex items-start gap-4 p-6">
                    <RadioGroupItem value="mixed" id="mixed" className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Layers className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold text-lg">Mixed Content</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Advanced: Manually create chapters and add different content types (videos, text, quizzes, resources).
                      </p>
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="px-2 py-1 bg-muted rounded">Flexible</span>
                        <span className="px-2 py-1 bg-muted rounded">Custom structure</span>
                        <span className="px-2 py-1 bg-muted rounded">Multi-format</span>
                      </div>
                    </div>
                  </CardContent>
                </label>
              </Card>
            </RadioGroup>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard')}
            >
              Cancel
            </Button>
            <Button
              onClick={handleNext}
              disabled={!courseName.trim()}
              className="gap-2"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
