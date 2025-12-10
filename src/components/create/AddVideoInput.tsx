"use client"
import { Link as LinkIcon, Loader2, Plus, VideoOff } from 'lucide-react'
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useYouTubeImporter } from '@/hooks/useYouTubeImporter'
import { VideoCard } from './VideoCard'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useAuthenticatedFetchRaw } from '@/hooks/useAuthenticatedFetch'

const formSchema = z.object({
  link: z.string().url({ message: "Please enter a valid YouTube URL." }).min(1, {
    message: "URL cannot be empty.",
  }),
});

const AddVideoInput = () => {
  const router = useRouter();
  const { videos, isLoading, progress, loadingText, error, updateTranscript, importFromUrl, removeVideo, clearAllVideos } = useYouTubeImporter();
  const authenticatedFetch = useAuthenticatedFetchRaw();
  
  const [isCreating, setIsCreating] = useState(false);
  const [noTranscript, setNoTranscript] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { link: "" },
  });

  function onUrlSubmit(values: z.infer<typeof formSchema>) {
    importFromUrl(values.link, { skipTranscript: noTranscript });
    form.reset();
  }

  const handleProcessVideos = async () => {
    setIsCreating(true);

    try {
      const videosToSend = videos.map(v => ({
        id: v.id,
        title: v.title,
        url: v.url,
        thumbnail: v.thumbnail,
        channelTitle: v.channelTitle,
        publishedAt: v.publishedAt,
        durationInSeconds: v.durationInSeconds,
        transcript: v.transcript || '',
        skipTranscript: v.skipTranscript ?? false,
      }));

      const response = await authenticatedFetch('/api/videos/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videos: videosToSend
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process videos');
      }

      const { created, existing, total, skippedProcessing = 0, queued = 0 } = data;
      const processingCount = Math.max(Number(queued), 0);

      const messageParts = [
        `${total} video(s) submitted — ${created} added${existing ? `, ${existing} already existed` : ''}.`,
        processingCount > 0 ? `Processing ${processingCount} video(s) in background. Check the Video Library to see progress.` : undefined,
        skippedProcessing > 0 ? `AI content generation skipped for ${skippedProcessing} video(s).` : undefined,
      ].filter(Boolean);

      toast.success(messageParts.join(' '), { duration: 5000 });
      
      // Clear videos after successful creation
      clearAllVideos();
      
      // Redirect to video library
      router.push('/admin/videos');

    } catch (error) {
      console.error("Failed to create videos:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      toast.error(`Failed to create videos: ${errorMessage}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main className="container mx-auto max-w-4xl py-12 px-4 space-y-12">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-6 w-6" />
            Add New Video or Playlist
          </CardTitle>
          <CardDescription>
            Paste a YouTube video or playlist URL below to add it to your collection.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onUrlSubmit)} className="flex w-full items-start gap-4">
              <FormField
                control={form.control}
                name="link"
                render={({ field }) => (
                  <FormItem className="flex-grow">
                    <FormLabel className="sr-only">YouTube URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., https://www.youtube.com/watch?v=..."
                        className="h-12 text-base"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" size="sm" className="h-12" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-5 w-5 sm:mr-2" />
                    <span className="sr-only sm:not-sr-only">Add</span>
                  </>
                )}
              </Button>
            </form>
          </Form>

          <div className="mt-3 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Checkbox
                id="no-transcript"
                checked={noTranscript}
                onCheckedChange={(checked) => setNoTranscript(checked === true)}
                disabled={isLoading}
              />
              <Label htmlFor="no-transcript" className="text-sm font-medium">
                No Transcript
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              When checked, transcripts are not imported and AI-generated content is skipped.
            </p>
          </div>
          
          {isLoading && (
            <div className="mt-4 space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-muted-foreground">{loadingText}</p>
            </div>
          )}
          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {videos.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Your Video Collection</CardTitle>
                <CardDescription>
                  You have {videos.length} video(s) ready to be processed. 
                  Videos will be saved to the library and AI will generate notes & quizzes in the background.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={clearAllVideos} disabled={isCreating}>
                  Clear All
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={handleProcessVideos}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Process Videos'
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {videos.map(video => (
                <VideoCard 
                  key={video.id} 
                  video={video} 
                  onRemove={removeVideo} 
                  onTranscriptUpdate={updateTranscript}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && videos.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <VideoOff className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">No Videos Added</h3>
          <p className="mt-1 text-sm text-muted-foreground">Your video collection is empty. Add a video to get started.</p>
        </div>
      )}
    </main>
  );
};

export default AddVideoInput;