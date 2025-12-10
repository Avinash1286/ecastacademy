"use client"

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Video, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2, 
  Search,
  RotateCw,
  Play,
  Plus,
  Trash2
} from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type VideoStatus = "pending" | "processing" | "completed" | "failed" | undefined;

type VideoData = {
  _id: Id<"videos">;
  title: string;
  url: string;
  thumbnailUrl?: string;
  channelTitle?: string;
  durationInSeconds?: number;
  status?: VideoStatus;
  errorMessage?: string;
  createdAt: number;
};

const VIDEOS_PER_PAGE = 12;

export default function VideosLibraryPage() {
  const { data: session } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<{ id: Id<"videos">; title: string } | null>(null);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [allLoadedVideos, setAllLoadedVideos] = useState<VideoData[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Fetch videos with cursor-based pagination
  const queryArgs = { 
    limit: VIDEOS_PER_PAGE,
    ...(cursor ? { cursor } : {})
  };
  
  const videosResult = useQuery(api.videoProcessing.getVideosPaginated, queryArgs);
  const retryVideo = useMutation(api.videoProcessing.retryFailedVideo);
  const deleteVideo = useMutation(api.videos.deleteVideo);

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
  useMemo(() => {
    if (videosResult !== undefined) {
      setIsLoadingMore(false);
    }
  }, [videosResult]);

  // Check if there are more videos to load
  const hasMore = videosResult?.hasMore ?? false;

  // Get total count for display
  const totalVideosLoaded = displayVideos.length;

  const handleRetry = async (videoId: string) => {
    try {
      await retryVideo({ videoId: videoId as Id<"videos"> });
      toast.success("Video queued for retry");
    } catch (error) {
      toast.error("Failed to retry video");
      console.error(error);
    }
  };

  const openDeleteDialog = (videoId: Id<"videos">, title: string) => {
    setVideoToDelete({ id: videoId, title });
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!videoToDelete) return;
    try {
      await deleteVideo({ 
        id: videoToDelete.id,
        currentUserId: session?.user?.id as Id<"users"> | undefined,
      });
      toast.success("Video deleted successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete video";
      toast.error(message);
      console.error(error);
    } finally {
      setDeleteDialogOpen(false);
      setVideoToDelete(null);
    }
  };

  const getStatusBadge = (status: VideoStatus) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
      case "processing":
        return <Badge className="bg-blue-500"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processing</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "failed":
        return <Badge className="bg-red-500"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  if (isInitialLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Video className="w-8 h-8" />
            Video Library
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your video collection and monitor processing status
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            {totalVideosLoaded}{hasMore ? '+' : ''} videos
          </div>
          <Button asChild>
            <Link href="/admin/addvideos">
              <Plus className="w-4 h-4 mr-2" />
              Add Videos
            </Link>
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search videos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Videos Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredVideos.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Video className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">No videos found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {searchQuery ? "Try adjusting your search" : "Add videos from the Create page"}
            </p>
          </div>
        ) : (
          filteredVideos.map((video) => (
            <Card key={video._id} className="overflow-hidden">
              <div className="relative aspect-video bg-muted overflow-hidden">
                {video.thumbnailUrl ? (
                  <Image
                    src={video.thumbnailUrl}
                    alt={video.title}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Video className="w-12 h-12 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  {getStatusBadge(video.status)}
                </div>
                {video.durationInSeconds && (
                  <div className="absolute bottom-2 right-2 bg-black/75 text-white px-2 py-1 rounded text-xs">
                    {formatDuration(video.durationInSeconds)}
                  </div>
                )}
              </div>

              <CardHeader>
                <CardTitle className="text-base line-clamp-2">{video.title}</CardTitle>
                {video.channelTitle && (
                  <CardDescription className="text-sm">{video.channelTitle}</CardDescription>
                )}
              </CardHeader>

              <CardContent className="space-y-3">
                {video.errorMessage && (
                  <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950 p-2 rounded">
                    {video.errorMessage}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => window.open(video.url, '_blank')}
                  >
                    <Play className="w-4 h-4 mr-1" />
                    Watch
                  </Button>

                  {(video.status === "failed" || video.status === "completed") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRetry(video._id)}
                      title={video.status === "completed" ? "Regenerate video processing" : "Retry failed video"}
                    >
                      <RotateCw className="w-4 h-4" />
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDeleteDialog(video._id, video.title)}
                    title="Delete video"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground">
                  Created: {new Date(video.createdAt).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))
        )}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Video</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{videoToDelete?.title}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setVideoToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <Skeleton className="aspect-video w-full" />
            <CardHeader>
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
