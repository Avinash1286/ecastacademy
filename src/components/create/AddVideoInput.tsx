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
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import dynamic from 'next/dynamic';


const CourseInfoDialog = dynamic(() => import('@/components/create/CourseInfoDialog'), {
  loading: () => <Button variant="default" size="sm" disabled>Create Course</Button>,
  ssr: false
});

const formSchema = z.object({
  link: z.string().url({ message: "Please enter a valid YouTube URL." }).min(1, {
    message: "URL cannot be empty.",
  }),
});

const AddVideoInput = () => {
  const router = useRouter();
  const { videos, isLoading, progress, loadingText, error, updateTranscript, importFromUrl, removeVideo, clearAllVideos } = useYouTubeImporter();
  
  const [isCreating, setIsCreating] = useState(false);
  const [creationStatus, setCreationStatus] = useState("");
  const [creationProgress, setCreationProgress] = useState(0);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { link: "" },
  });

  function onUrlSubmit(values: z.infer<typeof formSchema>) {
    importFromUrl(values.link);
    form.reset();
  }

  const handleCreateCourse = async (data: { title: string; description: string }) => {
    setIsCreating(true);
    setCreationStatus("Initializing course creation...");
    setCreationProgress(0);

    try {
      const response = await fetch('/api/course/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          videos: videos.map(v => ({ ...v, transcript: v.transcript || '' }))
        }),
      });

      if (!response.body) {
        throw new Error("The response body is empty.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accumulatedData = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        accumulatedData += decoder.decode(value, { stream: true });

        // Process server-sent events
        const events = accumulatedData.split('\n\n');
        accumulatedData = events.pop() || ''; // Keep the last, possibly incomplete event

        for (const event of events) {
          if (event.startsWith('data: ')) {
            const eventData = JSON.parse(event.substring(6));
            if (eventData.error) {
              throw new Error(eventData.error);
            }
            if (eventData.message) {
              setCreationStatus(eventData.message);
            }
            if (eventData.progress) {
              setCreationProgress(eventData.progress);
            }
            if (eventData.courseId) {
              toast.success("Course created successfully!");
              // router.push(`/course/${eventData.courseId}`);
            }
          }
        }
      }

    } catch (error) {
      console.error("Failed to create course:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      toast.error(`Failed to create course: ${errorMessage}`);
    } finally {
      setIsCreating(false);
      setCreationProgress(0);
      setCreationStatus("");
    }
  };

  if (isCreating) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full space-y-4 p-8">
        <div className="w-full max-w-md text-center">
          <h2 className="text-2xl font-semibold mb-2">Creating Your Course</h2>
          <p className="text-muted-foreground mb-4">Please wait, this may take a few moments...</p>
          <Progress value={creationProgress} className="w-full mb-2" />
          <p className="text-sm text-muted-foreground">{creationStatus}</p>
        </div>
      </div>
    )
  }

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
                <CardDescription>You have {videos.length} video(s) ready to be organized into a course.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={clearAllVideos}>Clear All</Button>
                <CourseInfoDialog onFormSubmit={handleCreateCourse} videos={videos} />
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