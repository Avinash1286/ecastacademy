'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '../../../../../../convex/_generated/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Video, ArrowLeft, Check, Search } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';

export default function SelectVideosPage() {
  const router = useRouter();
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [courseData, setCourseData] = useState<{ name: string; description: string; type: string; isCertification?: boolean; passingGrade?: number } | null>(null);

  // Fetch all completed videos
  const allVideos = useQuery(api.videos.getAllVideos, {}) || [];
  const completedVideos = allVideos.filter(v => v.status === 'completed');

  useEffect(() => {
    // Retrieve course data from sessionStorage
    const stored = sessionStorage.getItem('newCourse');
    if (stored) {
      setCourseData(JSON.parse(stored));
    } else {
      // Redirect back if no course data
      router.push('/admin/create/course');
    }
  }, [router]);

  const filteredVideos = completedVideos.filter(video =>
    video.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleVideo = (videoId: string) => {
    const newSelected = new Set(selectedVideos);
    if (newSelected.has(videoId)) {
      newSelected.delete(videoId);
    } else {
      newSelected.add(videoId);
    }
    setSelectedVideos(newSelected);
  };

  const handleCreateCourse = async () => {
    if (selectedVideos.size === 0) {
      toast.error('Please select at least one video');
      return;
    }

    if (!courseData) {
      toast.error('Course data not found');
      return;
    }

    setIsCreating(true);

    try {
      // Create course with selected videos
      const response = await fetch('/api/course/create-from-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseName: courseData.name,
          courseDescription: courseData.description,
          videoIds: Array.from(selectedVideos),
          isCertification: courseData.isCertification,
          passingGrade: courseData.passingGrade,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create course');
      }

      const data = await response.json();

      toast.success('Course created successfully!');
      sessionStorage.removeItem('newCourse');
      router.push(`/admin/courses/${data.courseId}`);
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
    <div className="container mx-auto max-w-6xl py-8 px-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Video className="h-6 w-6" />
                Select Videos for: {courseData.name}
              </CardTitle>
              <CardDescription>
                Choose videos from your library. Each video will become a chapter in your course.
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search videos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Selected Count */}
          <div className="flex items-center justify-between py-2 px-4 bg-muted rounded-lg">
            <span className="text-sm font-medium">
              {selectedVideos.size} video(s) selected
            </span>
            {selectedVideos.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedVideos(new Set())}
              >
                Clear All
              </Button>
            )}
          </div>

          {/* Video List */}
          {filteredVideos.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <Video className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">No Videos Available</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchQuery ? 'No videos match your search.' : 'No completed videos found in your library.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredVideos.map((video) => {
                const isSelected = selectedVideos.has(video._id);
                return (
                  <Card
                    key={video._id}
                    className={`cursor-pointer transition-all ${
                      isSelected ? 'border-primary shadow-md' : 'hover:border-primary/50'
                    }`}
                    onClick={() => toggleVideo(video._id)}
                  >
                    <CardContent className="p-0">
                      <div className="relative aspect-video bg-muted">
                        {video.thumbnailUrl && (
                          <Image
                            src={video.thumbnailUrl}
                            alt={video.title}
                            fill
                            className="object-cover"
                          />
                        )}
                        {isSelected && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                            <div className="bg-primary rounded-full p-2">
                              <Check className="h-6 w-6 text-primary-foreground" />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="p-4 space-y-2">
                        <div className="flex items-start gap-2">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleVideo(video._id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <h3 className="font-medium text-sm line-clamp-2 flex-1">
                            {video.title}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {video.durationInSeconds
                              ? `${Math.floor(video.durationInSeconds / 60)}:${String(video.durationInSeconds % 60).padStart(2, '0')}`
                              : 'N/A'}
                          </Badge>
                          {video.notes && video.quiz && (
                            <Badge variant="outline" className="text-xs">
                              AI Generated
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => router.back()}
              disabled={isCreating}
            >
              Back
            </Button>
            <Button
              onClick={handleCreateCourse}
              disabled={selectedVideos.size === 0 || isCreating}
              className="gap-2"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating Course...
                </>
              ) : (
                <>
                  Create Course with {selectedVideos.size} Video(s)
                  <Check className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
