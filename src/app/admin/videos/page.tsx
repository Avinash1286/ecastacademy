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
  Plus
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import Image from "next/image";
import Link from "next/link";

type VideoStatus = "pending" | "processing" | "completed" | "failed" | undefined;

export default function VideosLibraryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  
  // Fetch all videos
  const allVideos = useQuery(api.videoProcessing.getVideosByStatus, {});
  const retryVideo = useMutation(api.videoProcessing.retryFailedVideo);

  // Filter videos by search only
  const filteredVideos = allVideos?.filter(video => {
    const matchesSearch = video.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  }) || [];

  const handleRetry = async (videoId: string) => {
    try {
      await retryVideo({ videoId: videoId as Id<"videos"> });
      toast.success("Video queued for retry");
    } catch (error) {
      toast.error("Failed to retry video");
      console.error(error);
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

  if (allVideos === undefined) {
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
            {allVideos?.length || 0} videos
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
                </div>

                <div className="text-xs text-muted-foreground">
                  Created: {new Date(video.createdAt).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
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
