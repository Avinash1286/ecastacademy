import { useState } from 'react';
import { toast } from 'sonner';
import { extractPlaylistId, extractVideoId } from '@/lib/youtube';
import { fetchPlaylistVideos, fetchVideoInfo, fetchTranscript } from '@/lib/services/youtubeApi';
import type { VideoInfo } from '@/lib/types';

export const useYouTubeImporter = () => {
  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;

  const handleProgress = (p: number, text: string) => {
    setProgress(p);
    setLoadingText(text);
  };

  const importFromUrl = async (url: string, options?: { skipTranscript?: boolean }) => {
    if (!apiKey) {
      toast.error("Configuration Error: YouTube API key is missing.");
      return;
    }

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
        fetchedVideos = await fetchPlaylistVideos(playlistId, apiKey, handleProgress);
      } else if (videoId) {
        handleProgress(25, "Single video detected. Fetching info...");
        const video = await fetchVideoInfo(videoId, apiKey);
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
        const videoPromises = fetchedVideos.map(async (video) => {
          const transcript = await fetchTranscript(video.id);
          return { ...video, transcript, skipTranscript: false };
        });

        videosWithTranscripts = await Promise.all(videoPromises);
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