"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { useState, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Switch } from "@/components/ui/switch";
import { Info } from "lucide-react";
import {
  ChevronLeft,
  Plus,
  GripVertical,
  Pencil,
  Trash2,
  TriangleAlert,
  Video,
  FileText,
  ListChecks,
  FileCheck,
  Link as LinkIcon,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle,
  RotateCcw,
  Search,
  Play,
} from "lucide-react";
import { toast } from "sonner";

type ContentType = "video" | "text" | "quiz" | "assignment" | "resource";

export default function CourseBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as Id<"courses">;

  const course = useQuery(api.courses.getCourse, { id: courseId });
  const chapters = useQuery(api.chapters.getChaptersByCourse, { courseId });
  
  // Video selector dialog states - moved up so we can use for conditional query
  const [videoSelectorDialog, setVideoSelectorDialog] = useState(false);
  const [videoSearchQuery, setVideoSearchQuery] = useState("");
  
  // Video pagination states
  const [videoCursor, setVideoCursor] = useState<string | undefined>(undefined);
  const [allLoadedVideos, setAllLoadedVideos] = useState<Array<{
    _id: Id<"videos">;
    title: string;
    thumbnailUrl?: string;
    channelTitle?: string;
    durationInSeconds?: number;
    status?: string;
  }>>([]);
  const [isLoadingMoreVideos, setIsLoadingMoreVideos] = useState(false);
  const [lastKnownHasMoreVideos, setLastKnownHasMoreVideos] = useState(false);
  
  const VIDEOS_PER_PAGE = 20;
  
  // Lazy load videos only when the video selector dialog is opened
  // This significantly improves initial page load time
  const videosResult = useQuery(
    api.videoProcessing.getVideosPaginated,
    videoSelectorDialog ? { limit: VIDEOS_PER_PAGE, cursor: videoCursor, status: "completed" } : "skip"
  );
  
  // Combine loaded videos with new results
  const completedVideos = useMemo(() => {
    if (!videosResult?.videos) return allLoadedVideos;
    
    // If no cursor was set, this is fresh data (first load or reset)
    if (!videoCursor) {
      return videosResult.videos;
    }
    
    // Otherwise append to existing videos (avoiding duplicates)
    const existingIds = new Set(allLoadedVideos.map(v => v._id));
    const uniqueNewVideos = videosResult.videos.filter(v => !existingIds.has(v._id));
    return [...allLoadedVideos, ...uniqueNewVideos];
  }, [videosResult?.videos, videoCursor, allLoadedVideos]);

  // Handle load more videos
  const handleLoadMoreVideos = useCallback(() => {
    if (videosResult?.nextCursor) {
      setIsLoadingMoreVideos(true);
      setAllLoadedVideos(completedVideos);
      setVideoCursor(videosResult.nextCursor);
    }
  }, [videosResult?.nextCursor, completedVideos]);

  // Update hasMore and reset loading state when new data arrives
  useEffect(() => {
    if (videosResult !== undefined) {
      setLastKnownHasMoreVideos(videosResult.hasMore);
      setIsLoadingMoreVideos(false);
    }
  }, [videosResult]);

  // Reset video pagination when dialog closes
  useEffect(() => {
    if (!videoSelectorDialog) {
      setVideoCursor(undefined);
      setAllLoadedVideos([]);
      setIsLoadingMoreVideos(false);
    }
  }, [videoSelectorDialog]);

  // Use lastKnownHasMoreVideos while loading to prevent button from hiding
  const hasMoreVideos = isLoadingMoreVideos ? lastKnownHasMoreVideos : (videosResult?.hasMore ?? lastKnownHasMoreVideos);
  
  // Filter videos by search query (client-side filtering of loaded videos)
  const filteredVideos = useMemo(() => {
    if (!videoSearchQuery) return completedVideos;
    return completedVideos.filter((video) =>
      video.title.toLowerCase().includes(videoSearchQuery.toLowerCase())
    );
  }, [completedVideos, videoSearchQuery]);

  const createChapter = useMutation(api.chapters.createChapterV2);
  const updateChapter = useMutation(api.chapters.updateChapterV2);
  const deleteChapter = useMutation(api.chapters.deleteChapterV2);
  const reorderChapters = useMutation(api.chapters.reorderChapters);
  const createContentItem = useMutation(api.contentItems.createContentItem);
  const updateContentItem = useMutation(api.contentItems.updateContentItem);
  const deleteContentItem = useMutation(api.contentItems.deleteContentItem);
  const reorderContentItems = useMutation(api.contentItems.reorderContentItems);

  const [chapterDialog, setChapterDialog] = useState(false);
  const [contentDialog, setContentDialog] = useState(false);
  const [editingChapter, setEditingChapter] = useState<{
    _id: Id<"chapters">;
    title: string;
    description?: string;
  } | null>(null);
  const [editingContentItem, setEditingContentItem] = useState<{
    _id: Id<"contentItems">;
    type: ContentType;
    title: string;
    videoId?: string;
    textContent?: string;
    resourceUrl?: string;
  } | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<Id<"chapters"> | null>(null);
  const [contentType, setContentType] = useState<ContentType>("video");
  const [generatingQuizForContentId, setGeneratingQuizForContentId] = useState<Id<"contentItems"> | null>(null);
  // Loading states for DB operations
  const [creatingChapter, setCreatingChapter] = useState(false);
  const [updatingChapter, setUpdatingChapter] = useState(false);
  const [deletingChapterId, setDeletingChapterId] = useState<Id<"chapters"> | null>(null);
  const [creatingContent, setCreatingContent] = useState(false);
  const [updatingContent, setUpdatingContent] = useState(false);
  const [deletingContentId, setDeletingContentId] = useState<Id<"contentItems"> | null>(null);
  const [reorderingChaptersLoading, setReorderingChaptersLoading] = useState(false);
  const [reorderingContentLoading, setReorderingContentLoading] = useState(false);

  // Delete confirmation dialog states
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'chapter' | 'content';
    id: Id<"chapters"> | Id<"contentItems">;
    title: string;
  } | null>(null);

  // Drag and drop states
  const [draggedChapterIndex, setDraggedChapterIndex] = useState<number | null>(null);
  const [draggedContentIndex, setDraggedContentIndex] = useState<number | null>(null);
  const [draggedContentChapterId, setDraggedContentChapterId] = useState<Id<"chapters"> | null>(null);

  // Form states
  const [chapterTitle, setChapterTitle] = useState("");
  const [chapterDescription, setChapterDescription] = useState("");
  const [contentTitle, setContentTitle] = useState("");
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [textContent, setTextContent] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");

  // Grading configuration states
  const [isGraded, setIsGraded] = useState(false);
  const [maxPoints, setMaxPoints] = useState("100");
  const [passingScore, setPassingScore] = useState("70");
  const [allowRetakes, setAllowRetakes] = useState(true);

  const handleSelectVideo = (videoId: string, videoTitle: string) => {
    setSelectedVideoId(videoId);
    setContentTitle(videoTitle);
    setVideoSelectorDialog(false);
    setVideoSearchQuery("");
  };

  const handleCreateChapter = async () => {
    setCreatingChapter(true);
    try {
      await createChapter({
        courseId,
        title: chapterTitle,
        description: chapterDescription,
        order: (chapters?.length || 0) + 1,
      });
      toast.success("Chapter created successfully");
      setChapterDialog(false);
      setChapterTitle("");
      setChapterDescription("");
    } catch (error) {
      toast.error("Failed to create chapter");
      console.error(error);
    } finally {
      setCreatingChapter(false);
    }
  };

  const handleUpdateChapter = async () => {
    if (!editingChapter) return;
    setUpdatingChapter(true);
    try {
      await updateChapter({
        chapterId: editingChapter._id,
        title: chapterTitle,
        description: chapterDescription,
      });
      toast.success("Chapter updated successfully");
      setChapterDialog(false);
      setEditingChapter(null);
      setChapterTitle("");
      setChapterDescription("");
    } catch (error) {
      toast.error("Failed to update chapter");
      console.error(error);
    } finally {
      setUpdatingChapter(false);
    }
  };

  const openDeleteDialog = (type: 'chapter' | 'content', id: Id<"chapters"> | Id<"contentItems">, title: string) => {
    setDeleteTarget({ type, id, title });
    setDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === 'chapter') {
      setDeletingChapterId(deleteTarget.id as Id<"chapters">);
      try {
        await deleteChapter({ chapterId: deleteTarget.id as Id<"chapters"> });
        toast.success("Chapter deleted successfully");
        setDeleteDialog(false);
        setDeleteTarget(null);
      } catch (error) {
        toast.error("Failed to delete chapter");
        console.error(error);
      } finally {
        setDeletingChapterId(null);
      }
    } else {
      setDeletingContentId(deleteTarget.id as Id<"contentItems">);
      try {
        await deleteContentItem({ id: deleteTarget.id as Id<"contentItems"> });
        toast.success("Content item deleted successfully");
        setDeleteDialog(false);
        setDeleteTarget(null);
      } catch (error) {
        toast.error("Failed to delete content item");
        console.error(error);
      } finally {
        setDeletingContentId(null);
      }
    }
  };

  const handleDeleteChapter = async (chapterId: Id<"chapters">, title: string) => {
    openDeleteDialog('chapter', chapterId, title);
  };

  const openChapterDialog = (
    chapter?: { _id: Id<"chapters">; name: string; description?: string }
  ) => {
    if (chapter) {
      setEditingChapter({
        _id: chapter._id,
        title: chapter.name,
        description: chapter.description,
      });
      setChapterTitle(chapter.name);
      setChapterDescription(chapter.description || "");
    } else {
      setEditingChapter(null);
      setChapterTitle("");
      setChapterDescription("");
    }
    setChapterDialog(true);
  };

  const openContentDialog = (chapterId: Id<"chapters">) => {
    setEditingContentItem(null);
    setSelectedChapterId(chapterId);
    setContentType("video");
    setContentTitle("");
    setSelectedVideoId("");
    setTextContent("");
    setResourceUrl("");
    // Reset grading configuration to defaults
    setIsGraded(false);
    setMaxPoints("100");
    setPassingScore(course?.passingGrade?.toString() || "70");
    setAllowRetakes(true);
    setContentDialog(true);
  };

  const handleCreateContent = async () => {
    if (!selectedChapterId) return;

    // Get content items for this chapter to calculate order
    const chapterContentItems = chapters
      ?.find((ch) => ch._id === selectedChapterId)
      ?.contentItems || [];

    setCreatingContent(true);
    try {
      const baseData = {
        chapterId: selectedChapterId,
        type: contentType,
        title: contentTitle,
        order: chapterContentItems.length + 1,
        // Add grading configuration
        isGraded,
        maxPoints: isGraded ? Number(maxPoints) : undefined,
        passingScore: isGraded ? Number(passingScore) : undefined,
        allowRetakes: isGraded ? allowRetakes : undefined,
      };

      let additionalData = {};
      switch (contentType) {
        case "video":
          if (!selectedVideoId) {
            toast.error("Please select a video");
            return;
          }
          additionalData = { videoId: selectedVideoId as Id<"videos"> };
          break;
        case "text":
          if (!textContent) {
            toast.error("Please enter text content");
            return;
          }
          additionalData = { textContent };
          break;
        case "resource":
          if (!resourceUrl) {
            toast.error("Please enter resource URL");
            return;
          }
          additionalData = { resourceUrl, resourceTitle: contentTitle };
          break;
      }

      await createContentItem({ ...baseData, ...additionalData });
      toast.success("Content item added successfully");
      setContentDialog(false);
    } catch (error) {
      toast.error("Failed to add content item");
      console.error(error);
    }
    finally {
      setCreatingContent(false);
    }
  };

  const openEditContentDialog = (
    contentItem: {
      _id: Id<"contentItems">;
      type: ContentType;
      title: string;
      videoId?: Id<"videos">;
      textContent?: string;
      resourceUrl?: string;
      isGraded?: boolean;
      maxPoints?: number;
      passingScore?: number;
      allowRetakes?: boolean;
    },
    chapterId: Id<"chapters">
  ) => {
    setEditingContentItem({
      _id: contentItem._id,
      type: contentItem.type,
      title: contentItem.title,
      videoId: contentItem.videoId,
      textContent: contentItem.textContent,
      resourceUrl: contentItem.resourceUrl,
    });
    setSelectedChapterId(chapterId);
    setContentType(contentItem.type);
    setContentTitle(contentItem.title);
    setSelectedVideoId(contentItem.videoId || "");
    setTextContent(contentItem.textContent || "");
    setResourceUrl(contentItem.resourceUrl || "");
    // Load existing grading configuration
    setIsGraded(contentItem.isGraded || false);
    setMaxPoints(contentItem.maxPoints?.toString() || "100");
    setPassingScore(contentItem.passingScore?.toString() || course?.passingGrade?.toString() || "70");
    setAllowRetakes(contentItem.allowRetakes !== undefined ? contentItem.allowRetakes : true);
    setContentDialog(true);
  };

  const handleUpdateContent = async () => {
    if (!editingContentItem) return;
    setUpdatingContent(true);
    try {
      const baseData = {
        id: editingContentItem._id,
        title: contentTitle,
        // Update grading configuration
        isGraded,
        maxPoints: isGraded ? Number(maxPoints) : undefined,
        passingScore: isGraded ? Number(passingScore) : undefined,
        allowRetakes: isGraded ? allowRetakes : undefined,
      };

      let additionalData = {};
      switch (contentType) {
        case "video":
          if (!selectedVideoId) {
            toast.error("Please select a video");
            return;
          }
          additionalData = { videoId: selectedVideoId as Id<"videos"> };
          break;
        case "text":
          if (!textContent) {
            toast.error("Please enter text content");
            return;
          }
          additionalData = { textContent };
          break;
        case "resource":
          if (!resourceUrl) {
            toast.error("Please enter resource URL");
            return;
          }
          additionalData = { resourceUrl, resourceTitle: contentTitle };
          break;
      }

      await updateContentItem({ ...baseData, ...additionalData });
      toast.success("Content item updated successfully");
      setContentDialog(false);
      setEditingContentItem(null);
    } catch (error) {
      toast.error("Failed to update content item");
      console.error(error);
    } finally {
      setUpdatingContent(false);
    }
  };

  const handleDeleteContent = async (contentItemId: Id<"contentItems">, title: string) => {
    openDeleteDialog('content', contentItemId, title);
  };

  const handleGenerateTextQuiz = async (contentItemId: Id<"contentItems">) => {
    try {
      setGeneratingQuizForContentId(contentItemId);

      const response = await fetch("/api/ai/generate-text-quiz", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ contentItemId }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Extract user-friendly error message
        const errorMessage = data.error || "Failed to generate quiz";
        throw new Error(errorMessage);
      }

      // Quiz generation started in background - status will update via Convex subscription
      toast.success("Quiz generation started! The status will update automatically.");
    } catch (error) {
      // Show clean error message
      const errorMessage = error instanceof Error ? error.message : "Failed to generate quiz";

      // Show different messages based on error type
      if (errorMessage.includes("quota") || errorMessage.includes("Rate limit")) {
        toast.error(errorMessage, {
          duration: 5000,
        });
      } else {
        toast.error(errorMessage);
      }

      console.error("Quiz generation error:", error);
    } finally {
      setGeneratingQuizForContentId(null);
    }
  };

  const handleRetryTextQuiz = async (contentItemId: Id<"contentItems">) => {
    await handleGenerateTextQuiz(contentItemId);
  };

  // Drag and drop handlers for chapters
  const handleChapterDragStart = (index: number) => {
    setDraggedChapterIndex(index);
  };

  const handleChapterDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleChapterDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedChapterIndex === null || !chapters) return;
    if (draggedChapterIndex === dropIndex) return;

    setReorderingChaptersLoading(true);
    try {
      const reorderedChapters = [...chapters];
      const [draggedChapter] = reorderedChapters.splice(draggedChapterIndex, 1);
      reorderedChapters.splice(dropIndex, 0, draggedChapter);

      // Update order for all chapters
      const updates = reorderedChapters.map((chapter, idx) => ({
        chapterId: chapter._id,
        order: idx + 1,
      }));

      await reorderChapters({ updates });
      toast.success("Chapters reordered successfully");
    } catch (error) {
      toast.error("Failed to reorder chapters");
      console.error(error);
    } finally {
      setDraggedChapterIndex(null);
      setReorderingChaptersLoading(false);
    }
  };

  // Drag and drop handlers for content items
  const handleContentDragStart = (chapterId: Id<"chapters">, index: number) => {
    setDraggedContentIndex(index);
    setDraggedContentChapterId(chapterId);
  };

  const handleContentDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleContentDrop = async (e: React.DragEvent, chapterId: Id<"chapters">, dropIndex: number) => {
    e.preventDefault();
    if (draggedContentIndex === null || draggedContentChapterId !== chapterId) {
      setDraggedContentIndex(null);
      setDraggedContentChapterId(null);
      return;
    }
    if (draggedContentIndex === dropIndex) {
      setDraggedContentIndex(null);
      setDraggedContentChapterId(null);
      return;
    }

    setReorderingContentLoading(true);
    try {
      const chapter = chapters?.find((ch) => ch._id === chapterId);
      if (!chapter || !chapter.contentItems) return;

      const reorderedItems = [...chapter.contentItems];
      const [draggedItem] = reorderedItems.splice(draggedContentIndex, 1);
      reorderedItems.splice(dropIndex, 0, draggedItem);

      // Update order for all content items
      const updates = reorderedItems.map((item, idx) => ({
        id: item._id,
        order: idx + 1,
      }));

      await reorderContentItems({ items: updates });
      toast.success("Content items reordered successfully");
    } catch (error) {
      toast.error("Failed to reorder content items");
      console.error(error);
    } finally {
      setDraggedContentIndex(null);
      setDraggedContentChapterId(null);
      setReorderingContentLoading(false);
    }
  };

  const getContentIcon = (type: ContentType) => {
    switch (type) {
      case "video": return <Video className="h-4 w-4" />;
      case "text": return <FileText className="h-4 w-4" />;
      case "quiz": return <ListChecks className="h-4 w-4" />;
      case "assignment": return <FileCheck className="h-4 w-4" />;
      case "resource": return <LinkIcon className="h-4 w-4" />;
    }
  };

  const getContentTypeBadge = (type: ContentType) => {
    const variants = {
      video: "default",
      text: "secondary",
      quiz: "outline",
      assignment: "destructive",
      resource: "default",
    } as const;
    return <Badge variant={variants[type]}>{type}</Badge>;
  };

  if (!course) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading course...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl py-12 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/admin/courses")}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{course.name}</h1>
            <p className="text-muted-foreground">{course.description}</p>
          </div>
        </div>
        <Button size="sm" onClick={() => openChapterDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Chapter
        </Button>
      </div>

      {/* Chapters List */}
      {!chapters || chapters.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-muted-foreground mb-4">No chapters yet. Start building your course!</p>
            <Button onClick={() => openChapterDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Chapter
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {chapters.map((chapter, index) => (
            <Card
              key={chapter._id}
              draggable={!reorderingChaptersLoading}
              onDragStart={() => handleChapterDragStart(index)}
              onDragOver={handleChapterDragOver}
              onDrop={(e) => handleChapterDrop(e, index)}
              className={`cursor-move ${reorderingChaptersLoading ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 cursor-grab active:cursor-grabbing">
                      <GripVertical className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">
                        {index + 1}. {chapter.name}
                      </CardTitle>
                      {chapter.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {chapter.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openChapterDialog(chapter)}
                      disabled={deletingChapterId === chapter._id}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteChapter(chapter._id, chapter.name)}
                      disabled={deletingChapterId === chapter._id}
                    >
                      {deletingChapterId === chapter._id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Content Items */}
                {!chapter.contentItems || chapter.contentItems.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground mb-3">No content items yet</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openContentDialog(chapter._id)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Content
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {chapter.contentItems.map((item, itemIndex) => {
                      const videoDetails = item.type === "video" && "video" in item ? item.video : null;
                      const isGeneratingQuiz = generatingQuizForContentId === item._id;
                      const textQuizStatus = item.type === "text" ? item.textQuizStatus : null;

                      return (
                        <div
                          key={item._id}
                          draggable={!reorderingContentLoading}
                          onDragStart={() => handleContentDragStart(chapter._id, itemIndex)}
                          onDragOver={handleContentDragOver}
                          onDrop={(e) => handleContentDrop(e, chapter._id, itemIndex)}
                          className={`flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-move ${reorderingContentLoading ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
                            {getContentIcon(item.type)}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{item.title}</span>
                                {getContentTypeBadge(item.type)}
                                {item.isGraded && (
                                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
                                    Graded
                                  </Badge>
                                )}
                                {item.type === "video" && (
                                  videoDetails?.notes ? (
                                    <Badge variant="outline" className="text-green-600">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Notes Ready
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-yellow-600">
                                      <AlertCircle className="h-3 w-3 mr-1" />
                                      Notes Missing
                                    </Badge>
                                  )
                                )}
                                {item.type === "text" && textQuizStatus && (
                                  <>
                                    {textQuizStatus === "pending" && (
                                      <Badge variant="outline" className="text-yellow-600">
                                        <AlertCircle className="h-3 w-3 mr-1" />
                                        Quiz Pending
                                      </Badge>
                                    )}
                                    {textQuizStatus === "processing" && (
                                      <Badge variant="outline" className="text-blue-600">
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                        Generating Quiz
                                      </Badge>
                                    )}
                                    {textQuizStatus === "completed" && (
                                      <Badge variant="outline" className="text-green-600">
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        Quiz Ready
                                      </Badge>
                                    )}
                                    {textQuizStatus === "failed" && (
                                      <Badge variant="outline" className="text-red-600">
                                        <AlertCircle className="h-3 w-3 mr-1" />
                                        Quiz Failed
                                      </Badge>
                                    )}
                                  </>
                                )}
                              </div>
                              {videoDetails && videoDetails.durationInSeconds && (
                                <p className="text-xs text-muted-foreground">
                                  {Math.floor(videoDetails.durationInSeconds / 60)}:{String(videoDetails.durationInSeconds % 60).padStart(2, '0')} • {videoDetails.channelTitle}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {item.type === "text" && (
                              <>
                                {!textQuizStatus || textQuizStatus === "failed" ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => textQuizStatus === "failed" ? handleRetryTextQuiz(item._id) : handleGenerateTextQuiz(item._id)}
                                    disabled={isGeneratingQuiz}
                                    title={textQuizStatus === "failed" ? "Retry generating quiz" : "Generate quiz from text content"}
                                  >
                                    {isGeneratingQuiz ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : textQuizStatus === "failed" ? (
                                      <RotateCcw className="h-4 w-4" />
                                    ) : (
                                      <Sparkles className="h-4 w-4" />
                                    )}
                                  </Button>
                                ) : textQuizStatus === "pending" || textQuizStatus === "processing" ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled
                                    title="Quiz generation in progress"
                                  >
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  </Button>
                                ) : textQuizStatus === "completed" ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleGenerateTextQuiz(item._id)}
                                    disabled={isGeneratingQuiz}
                                    title="Regenerate quiz"
                                  >
                                    {isGeneratingQuiz ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <RotateCcw className="h-4 w-4" />
                                    )}
                                  </Button>
                                ) : null}
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditContentDialog(item, chapter._id)}
                              disabled={deletingContentId === item._id}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteContent(item._id, item.title)}
                              disabled={deletingContentId === item._id}
                            >
                              {deletingContentId === item._id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => openContentDialog(chapter._id)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Content Item
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Chapter Dialog */}
      <Dialog open={chapterDialog} onOpenChange={setChapterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingChapter ? "Edit Chapter" : "Add Chapter"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="chapter-title">Title</Label>
              <Input
                id="chapter-title"
                value={chapterTitle}
                onChange={(e) => setChapterTitle(e.target.value)}
                placeholder="Enter chapter title"
              />
            </div>
            <div>
              <Label htmlFor="chapter-description">Description (Optional)</Label>
              <Textarea
                id="chapter-description"
                value={chapterDescription}
                onChange={(e) => setChapterDescription(e.target.value)}
                placeholder="Enter chapter description"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChapterDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={editingChapter ? handleUpdateChapter : handleCreateChapter}
              disabled={!chapterTitle.trim() || creatingChapter || updatingChapter}
            >
              {creatingChapter || updatingChapter ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {editingChapter ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Content Item Dialog */}
      <Dialog open={contentDialog} onOpenChange={setContentDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingContentItem ? "Edit Content Item" : "Add Content Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Content Type</Label>
              <Select
                value={contentType}
                onValueChange={(v) => setContentType(v as ContentType)}
                disabled={!!editingContentItem}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="resource">Resource</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Title</Label>
              <Input
                value={contentTitle}
                onChange={(e) => setContentTitle(e.target.value)}
                placeholder="Enter content title"
              />
            </div>

            {/* Type-specific fields */}
            {contentType === "video" && (
              <div>
                <Label>Select Video</Label>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  onClick={() => setVideoSelectorDialog(true)}
                >
                  <Video className="mr-2 h-4 w-4" />
                  {selectedVideoId && completedVideos.find(v => v._id === selectedVideoId)
                    ? completedVideos.find(v => v._id === selectedVideoId)?.title
                    : "Choose a video from library"}
                </Button>
              </div>
            )}

            {contentType === "text" && (
              <div>
                <Label className="mb-2 block">Text Content</Label>
                <RichTextEditor
                  content={textContent}
                  onChange={setTextContent}
                  placeholder="Start writing your content... Use the toolbar for formatting."
                  className="min-h-[400px]"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Use the toolbar to format your text. Supports headings, lists, links, images, and more.
                </p>
              </div>
            )}

            {contentType === "resource" && (
              <div>
                <Label>Resource URL</Label>
                <Input
                  value={resourceUrl}
                  onChange={(e) => setResourceUrl(e.target.value)}
                  placeholder="https://example.com/resource.pdf"
                />
              </div>
            )}

            {/* Grading Configuration Section */}
            {(contentType === "quiz" || contentType === "assignment") && (
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="grading-toggle" className="text-base font-semibold">
                      Graded Content
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Enable grading to track student performance and require passing scores
                    </p>
                  </div>
                  <Switch
                    id="grading-toggle"
                    checked={isGraded}
                    onCheckedChange={setIsGraded}
                  />
                </div>

                {isGraded && (
                  <div className="space-y-4 pl-4 border-l-2 border-amber-500/50">
                    <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <Info className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-amber-900 dark:text-amber-100">
                        <p className="font-medium mb-1">Grading Impact:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                          <li>Students must achieve the passing score to progress</li>
                          <li>Scores are tracked and displayed in their progress</li>
                          <li>Affects overall course completion percentage</li>
                          {course?.isCertification && (
                            <li className="font-medium text-amber-700 dark:text-amber-400">
                              Required for certificate eligibility
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="max-points">Maximum Points</Label>
                        <Input
                          id="max-points"
                          type="number"
                          min="1"
                          max="1000"
                          value={maxPoints}
                          onChange={(e) => setMaxPoints(e.target.value)}
                          placeholder="100"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Total points possible (typically 100)
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="passing-score">Passing Score (%)</Label>
                        <Input
                          id="passing-score"
                          type="number"
                          min="0"
                          max="100"
                          value={passingScore}
                          onChange={(e) => setPassingScore(e.target.value)}
                          placeholder="70"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Minimum percentage to pass (0-100)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="space-y-0.5">
                        <Label htmlFor="allow-retakes" className="font-medium">
                          Allow Retakes
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Let students retake this content if they fail
                        </p>
                      </div>
                      <Switch
                        id="allow-retakes"
                        checked={allowRetakes}
                        onCheckedChange={setAllowRetakes}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContentDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={editingContentItem ? handleUpdateContent : handleCreateContent}
              disabled={!contentTitle.trim() || creatingContent || updatingContent}
            >
              {creatingContent || updatingContent ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {editingContentItem ? "Update Content" : "Add Content"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TriangleAlert className="h-5 w-5 text-destructive" />
              Confirm Deletion
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-2">
              Are you sure you want to delete this {deleteTarget?.type === 'chapter' ? 'chapter' : 'content item'}?
            </p>
            <p className="text-sm font-medium mb-2">
              {deleteTarget?.title}
            </p>
            {deleteTarget?.type === 'chapter' && (
              <p className="text-sm text-destructive">
                Warning: All content items within this chapter will be permanently deleted.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialog(false);
                setDeleteTarget(null);
              }}
              disabled={deletingChapterId !== null || deletingContentId !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deletingChapterId !== null || deletingContentId !== null}
            >
              {(deletingChapterId !== null || deletingContentId !== null) ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Selector Dialog */}
      <Dialog open={videoSelectorDialog} onOpenChange={setVideoSelectorDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Select Video</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search videos..."
                value={videoSearchQuery}
                onChange={(e) => setVideoSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Video List */}
            <div className="border rounded-lg overflow-hidden max-h-[50vh] overflow-y-auto">
              {videosResult === undefined && completedVideos.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Loader2 className="mx-auto h-8 w-8 mb-2 animate-spin" />
                  <p>Loading videos...</p>
                </div>
              ) : filteredVideos.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Video className="mx-auto h-12 w-12 mb-2 opacity-50" />
                  <p>{videoSearchQuery ? "No videos found matching your search" : "No completed videos available"}</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredVideos.map((video) => {
                    const duration = video.durationInSeconds
                      ? `${Math.floor(video.durationInSeconds / 60)}:${String(video.durationInSeconds % 60).padStart(2, '0')}`
                      : 'Unknown';
                    const isSelected = selectedVideoId === video._id;

                    return (
                      <button
                        key={video._id}
                        onClick={() => handleSelectVideo(video._id, video.title)}
                        className={`w-full p-4 text-left hover:bg-accent transition-colors flex items-start gap-3 ${isSelected ? 'bg-accent' : ''
                          }`}
                      >
                        <div className="relative w-32 h-20 flex-shrink-0 bg-muted rounded overflow-hidden">
                          {video.thumbnailUrl ? (
                            <Image
                              src={video.thumbnailUrl}
                              alt={video.title}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Video className="w-8 h-8 text-muted-foreground" />
                            </div>
                          )}
                          <div className="absolute bottom-1 right-1 bg-black/75 text-white px-1.5 py-0.5 rounded text-xs">
                            {duration}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium line-clamp-2 mb-1">{video.title}</h4>
                          {video.channelTitle && (
                            <p className="text-sm text-muted-foreground">{video.channelTitle}</p>
                          )}
                          {isSelected && (
                            <Badge variant="default" className="mt-2">Selected</Badge>
                          )}
                        </div>
                        <Play className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1" />
                      </button>
                    );
                  })}
                  
                  {/* Load More Button */}
                  {hasMoreVideos && !videoSearchQuery && (
                    <div className="p-4 flex justify-center">
                      <Button
                        onClick={handleLoadMoreVideos}
                        disabled={isLoadingMoreVideos}
                        variant="outline"
                        size="sm"
                      >
                        {isLoadingMoreVideos ? (
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
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setVideoSelectorDialog(false);
                setVideoSearchQuery("");
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
