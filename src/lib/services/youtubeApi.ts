import { mapYouTubeItemToVideoInfo } from '@/lib/youtube';
import type { VideoInfo } from '@/lib/types';

const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

export const fetchVideoInfo = async (videoId: string, apiKey: string): Promise<VideoInfo> => {
  const response = await fetch(
    `${YOUTUBE_API_BASE_URL}/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`
  );
  if (!response.ok) throw new Error(`YouTube API error: ${response.statusText}`);
  
  const data = await response.json();
  if (!data.items || data.items.length === 0) {
    throw new Error('Video not found or is private.');
  }
  
  return mapYouTubeItemToVideoInfo(data.items[0]);
};

type ProgressCallback = (progress: number, text: string) => void;

export const fetchPlaylistVideos = async (playlistId: string, apiKey: string, onProgress: ProgressCallback): Promise<VideoInfo[]> => {
  onProgress(10, 'Fetching playlist items...');
  
  const playlistItemsResponse = await fetch(
    `${YOUTUBE_API_BASE_URL}/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&key=${apiKey}`
  );
  if (!playlistItemsResponse.ok) throw new Error(`YouTube API error: ${playlistItemsResponse.statusText}`);

  const playlistData = await playlistItemsResponse.json();
  const videoIds = playlistData.items.map((item: any) => item.snippet.resourceId.videoId);
  
  if (videoIds.length === 0) return [];

  const videos: VideoInfo[] = [];
  onProgress(20, `Found ${videoIds.length} videos. Fetching details...`);

  for (let i = 0; i < videoIds.length; i += 50) {
    const batchIds = videoIds.slice(i, i + 50);
    const batchResponse = await fetch(
      `${YOUTUBE_API_BASE_URL}/videos?part=snippet,contentDetails&id=${batchIds.join(',')}&key=${apiKey}`
    );
    if (!batchResponse.ok) continue;

    const batchData = await batchResponse.json();
    const batchVideos = batchData.items.map(mapYouTubeItemToVideoInfo);
    videos.push(...batchVideos);
    
    const progress = 20 + ((i + batchIds.length) / videoIds.length) * 70;
    onProgress(progress, `Fetched ${videos.length} of ${videoIds.length} videos...`);
  }
  
  onProgress(90, 'All video details fetched.');
  return videos;
};

export const fetchTranscript = async (videoId: string): Promise<string> => {
  try {
    const response = await fetch(`/api/transcript?v=${videoId}`);

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