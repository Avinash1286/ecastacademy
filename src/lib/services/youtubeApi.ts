/**
 * YouTube API Service (Server-Side Proxy)
 * 
 * All YouTube API calls are now routed through the server-side API
 * to protect the API key from exposure in the browser.
 */

import type { VideoInfo } from '@/lib/types';

type ProgressCallback = (progress: number, text: string) => void;

/**
 * Fetch single video info from server-side API
 */
export const fetchVideoInfo = async (videoId: string): Promise<VideoInfo> => {
  const response = await fetch(`/api/youtube?action=video&videoId=${encodeURIComponent(videoId)}`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch video: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  if (!data.video) {
    throw new Error('Video not found or is private.');
  }
  
  return {
    ...data.video,
    transcript: '',
    skipTranscript: false,
  };
};

/**
 * Fetch playlist videos from server-side API
 */
export const fetchPlaylistVideos = async (
  playlistId: string, 
  onProgress: ProgressCallback
): Promise<VideoInfo[]> => {
  onProgress(10, 'Fetching playlist from server...');
  
  const response = await fetch(`/api/youtube?action=playlist&playlistId=${encodeURIComponent(playlistId)}`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch playlist: ${response.statusText}`);
  }
  
  onProgress(50, 'Processing playlist data...');
  
  const data = await response.json();
  
  if (!data.videos || data.videos.length === 0) {
    return [];
  }
  
  onProgress(90, `Found ${data.videos.length} videos in playlist.`);
  
  // Add transcript fields to each video
  return data.videos.map((video: Omit<VideoInfo, 'transcript' | 'skipTranscript'>) => ({
    ...video,
    transcript: '',
    skipTranscript: false,
  }));
};

/**
 * Fetch batch of videos by IDs from server-side API
 */
export const fetchVideoBatch = async (videoIds: string[]): Promise<VideoInfo[]> => {
  if (videoIds.length === 0) return [];
  
  const response = await fetch(
    `/api/youtube?action=batch&videoId=${encodeURIComponent(videoIds.join(','))}`
  );
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch videos: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  return (data.videos || []).map((video: Omit<VideoInfo, 'transcript' | 'skipTranscript'>) => ({
    ...video,
    transcript: '',
    skipTranscript: false,
  }));
};

/**
 * Fetch transcript via server-side proxy
 * (Already server-side, no changes needed)
 */
export const fetchTranscript = async (videoId: string): Promise<string> => {
  try {
    const response = await fetch(`/api/transcript?v=${encodeURIComponent(videoId)}`);

    if (!response.ok) {
      console.warn(`Transcript API proxy returned an error for video ${videoId}.`);
      return '';
    }
    
    const data = await response.json();

    return data.transcript || '';

  } catch (error) {
    console.error(`Client-side error calling transcript proxy for ${videoId}:`, error);
    return ''; 
  }
};