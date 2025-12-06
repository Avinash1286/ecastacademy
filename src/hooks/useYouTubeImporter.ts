import { useState } from 'react';
import { toast } from 'sonner';
import { extractPlaylistId, extractVideoId } from '@/lib/youtube';
import { fetchPlaylistVideos, fetchVideoInfo, fetchTranscript, fetchTranscriptsWithRateLimit } from '@/lib/services/youtubeApi';
import type { VideoInfo } from '@/lib/types';

export const useYouTubeImporter = () => {
  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleProgress = (p: number, text: string) => {
    setProgress(p);
    setLoadingText(text);
  };

  const importFromUrl = async (url: string, options?: { skipTranscript?: boolean }) => {
    setIsLoading(true);
    setError(null);
    handleProgress(5, "Analyzing URL...");

    const skipTranscript = options?.skipTranscript ?? false;

    const playlistId = extractPlaylistId(url);
    const videoId = extractVideoId(url);

    try {
      let fetchedVideos: VideoInfo[] = [];

      if (playlistId) {
        handleProgress(10, "Playlist detected. Fetching video details...");
        fetchedVideos = await fetchPlaylistVideos(playlistId, handleProgress);
      } else if (videoId) {
        handleProgress(25, "Single video detected. Fetching info...");
        const video = await fetchVideoInfo(videoId);
        fetchedVideos = [video];
        handleProgress(75, "Video info fetched.");
      } else {
        throw new Error("Invalid YouTube URL. Please provide a valid video or playlist link.");
      }

      if (fetchedVideos.length === 0) {
        toast.info("No videos found to import.");
        setIsLoading(false);
        return;
      }

      if (skipTranscript) {
        handleProgress(85, "Skipping transcript fetch (No Transcript selected)...");
      } else {
        handleProgress(85, `Fetching transcripts for ${fetchedVideos.length} video(s)...`);
      }

      let videosWithTranscripts: VideoInfo[];

      if (skipTranscript) {
        videosWithTranscripts = fetchedVideos.map((video) => ({
          ...video,
          transcript: '',
          skipTranscript: true,
        }));
      } else {
        // Use rate-limited fetching to avoid 429 errors
        // For single video, fetch directly; for multiple, use sequential with delays
        if (fetchedVideos.length === 1) {
          const transcript = await fetchTranscript(fetchedVideos[0].id);
          videosWithTranscripts = [{ ...fetchedVideos[0], transcript, skipTranscript: false }];
        } else {
          const videoIds = fetchedVideos.map(v => v.id);
          const transcriptMap = await fetchTranscriptsWithRateLimit(
            videoIds,
            (completed, total, videoId) => {
              const progressPercent = 85 + Math.round((completed / total) * 10);
              handleProgress(progressPercent, `Fetching transcript ${completed}/${total} (${videoId})...`);
            },
            { delayBetweenRequests: 1500, concurrency: 1 } // Sequential with 1.5s delay to avoid rate limits
          );
          
          videosWithTranscripts = fetchedVideos.map((video) => ({
            ...video,
            transcript: transcriptMap.get(video.id) || '',
            skipTranscript: false,
          }));
        }
      }
      
      handleProgress(95, skipTranscript ? "Finalizing import without transcripts..." : "Finalizing import...");
      setVideos(prevVideos => [...prevVideos, ...videosWithTranscripts]); 
      toast.success(`Successfully imported ${videosWithTranscripts.length} video(s)!${skipTranscript ? ' Transcript import skipped.' : ''}`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
      handleProgress(100, "Done");
    }
  };

  const removeVideo = (id: string) => {
    setVideos(prevVideos => prevVideos.filter(video => video.id !== id));
    toast.info("Video removed from collection.");
  };

  const clearAllVideos = () => {
    setVideos([]);
    toast.info("All videos removed from collection.");
  };

  const updateTranscript = (videoId: string, newTranscript: string) => {
    setVideos(prevVideos => 
      prevVideos.map(video => 
        video.id === videoId 
          ? { ...video, transcript: newTranscript }
          : video
      )
    );
  };

  return { 
    videos, 
    isLoading, 
    progress, 
    loadingText,
    error,
    importFromUrl,
    removeVideo,
    clearAllVideos,
    updateTranscript,
  };
};