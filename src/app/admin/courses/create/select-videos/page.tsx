'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '../../../../../../convex/_generated/api';
import { Id } from '../../../../../../convex/_generated/dataModel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Video, ArrowLeft, Check, Search } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';

type VideoData = {
  _id: Id<"videos">;
  title: string;
  url: string;
  thumbnailUrl?: string;
  channelTitle?: string;
  durationInSeconds?: number;
  status?: string;
};

const VIDEOS_PER_PAGE = 12;

export default function SelectVideosPage() {
  const router = useRouter();
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [courseData, setCourseData] = useState<{ name: string; description: string; type: string } | null>(null);
  
  // Pagination state
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [allLoadedVideos, setAllLoadedVideos] = useState<VideoData[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Fetch videos with cursor-based pagination (only completed videos)
  const queryArgs = { 
    limit: VIDEOS_PER_PAGE,
    status: 'completed' as const,
    ...(cursor ? { cursor } : {})
  };
  
  const videosResult = useQuery(api.videoProcessing.getVideosPaginated, queryArgs);

  // Track if this is initial load
  const isInitialLoading = videosResult === undefined && allLoadedVideos.length === 0;

  // Combine loaded videos with new results
  const displayVideos = useMemo(() => {
    if (!videosResult?.videos) return allLoadedVideos;
    
    const newVideos = videosResult.videos as VideoData[];

    // If no cursor was set, this is fresh data (first load or reset)
    if (!cursor) {
      return newVideos;
    }
    
    // Otherwise append to existing videos (avoiding duplicates)
    const existingIds = new Set(allLoadedVideos.map(v => v._id));
    const uniqueNewVideos = newVideos.filter(v => !existingIds.has(v._id));
    return [...allLoadedVideos, ...uniqueNewVideos];
  }, [videosResult?.videos, cursor, allLoadedVideos]);

  // Filter videos based on search
  const filteredVideos = useMemo(() => {
    if (!searchQuery) return displayVideos;
    return displayVideos.filter(video =>
      video.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [displayVideos, searchQuery]);

  // Handle load more
  const handleLoadMore = useCallback(() => {
    if (videosResult?.nextCursor) {
      setIsLoadingMore(true);
      setAllLoadedVideos(displayVideos);
      setCursor(videosResult.nextCursor);
    }
  }, [videosResult?.nextCursor, displayVideos]);

  // Reset loading state when new data arrives
  useEffect(() => {
    if (videosResult !== undefined) {
      setIsLoadingMore(false);
    }
  }, [videosResult]);

  // Check if there are more videos to load
  const hasMore = videosResult?.hasMore ?? false;

  useEffect(() => {
    // Retrieve course data from sessionStorage
    const stored = sessionStorage.getItem('newCourse');
    if (stored) {
      setCourseData(JSON.parse(stored));
    } else {
      // Redirect back if no course data
      router.push('/admin/courses/create');
    }
  }, [router]);

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
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create course');
      }

      //const data = await response.json();

      toast.success('Course created successfully!');
      sessionStorage.removeItem('newCourse');
      router.push(`/admin/courses`);
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
          {isInitialLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, idx) => (
                <Card key={idx}>
                  <CardContent className="p-0">
                    <Skeleton className="aspect-video w-full" />
                    <div className="p-4 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <Video className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">No Videos Available</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchQuery ? 'No videos match your search.' : 'No completed videos found in your library.'}
              </p>
            </div>
          ) : (
            <>
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
                            {video.status === 'completed' && (
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

              {/* Load More Button */}
              {hasMore && !searchQuery && (
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
                      'Load More Videos'
                    )}
                  </Button>
                </div>
              )}
            </>
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
