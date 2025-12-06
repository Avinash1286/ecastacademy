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
 * Sleep utility for delays
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch transcript via server-side proxy with exponential backoff retry
 * Handles 429 rate limit errors gracefully
 */
export const fetchTranscript = async (
  videoId: string,
  options?: { maxRetries?: number; initialDelay?: number }
): Promise<string> => {
  const maxRetries = options?.maxRetries ?? 5;
  const initialDelay = options?.initialDelay ?? 2000; // 2 seconds base delay
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`/api/transcript?v=${encodeURIComponent(videoId)}`);

      // Handle rate limiting with retry
      if (response.status === 429) {
        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s, 8s, 16s
          const delay = initialDelay * Math.pow(2, attempt);
          // Add jitter (±25%) to prevent thundering herd
          const jitter = delay * (0.75 + Math.random() * 0.5);
          await sleep(jitter);
          continue;
        }
        return '';
      }

      if (!response.ok) {
        // For other errors, check if retryable (5xx errors)
        if (response.status >= 500 && attempt < maxRetries) {
          const delay = initialDelay * Math.pow(2, attempt);
          await sleep(delay);
          continue;
        }
        return '';
      }
      
      const data = await response.json();
      return data.transcript || '';

    } catch {
      // Network errors are retryable
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }
    }
  }
  
  return ''; 
};

/**
 * Fetch transcripts for multiple videos with rate limiting
 * Uses sequential fetching with delays to avoid 429 errors
 */
export const fetchTranscriptsWithRateLimit = async (
  videoIds: string[],
  onProgress?: (completed: number, total: number, videoId: string) => void,
  options?: { delayBetweenRequests?: number; concurrency?: number }
): Promise<Map<string, string>> => {
  const results = new Map<string, string>();
  const delayBetweenRequests = options?.delayBetweenRequests ?? 1500; // 1.5s between requests
  const concurrency = options?.concurrency ?? 1; // Process 1 at a time by default
  
  // Process in batches with concurrency limit
  for (let i = 0; i < videoIds.length; i += concurrency) {
    const batch = videoIds.slice(i, i + concurrency);
    
    const batchResults = await Promise.all(
      batch.map(async (videoId) => {
        const transcript = await fetchTranscript(videoId);
        return { videoId, transcript };
      })
    );
    
    for (const { videoId, transcript } of batchResults) {
      results.set(videoId, transcript);
      onProgress?.(results.size, videoIds.length, videoId);
    }
    
    // Delay before next batch (except for last batch)
    if (i + concurrency < videoIds.length) {
      await sleep(delayBetweenRequests);
    }
  }
  
  return results;
};