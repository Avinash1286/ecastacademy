import type { YouTubeVideoItem, VideoInfo } from '@/lib/types';

export const extractVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

export const extractPlaylistId = (url: string): string | null => {
  const match = url.match(/[?&]list=([^&?#]+)/);
  return match ? match[1] : null;
};

export const formatDuration = (duration: string): string => {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return '0:00';

  const hours = parseInt(match[1]?.slice(0, -1)) || 0;
  const minutes = parseInt(match[2]?.slice(0, -1)) || 0;
  const seconds = parseInt(match[3]?.slice(0, -1)) || 0;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const parseDurationToSeconds = (duration: string): number => {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1]?.slice(0, -1)) || 0;
  const minutes = parseInt(match[2]?.slice(0, -1)) || 0;
  const seconds = parseInt(match[3]?.slice(0, -1)) || 0;

  return hours * 3600 + minutes * 60 + seconds;
};

const selectBestThumbnail = (thumbnails: any): string => {
  return thumbnails.maxres?.url || thumbnails.high?.url || thumbnails.medium?.url || '/placeholder.svg';
};

export const mapYouTubeItemToVideoInfo = (item: YouTubeVideoItem): VideoInfo => {
  return {
    id: item.id,
    title: item.snippet.title,
    thumbnail: selectBestThumbnail(item.snippet.thumbnails),
    duration: formatDuration(item.contentDetails.duration),
    durationInSeconds: parseDurationToSeconds(item.contentDetails.duration),
    channelTitle: item.snippet.channelTitle,
    publishedAt: new Date(item.snippet.publishedAt).toISOString(),
    url: `https://www.youtube.com/watch?v=${item.id}`,
    transcript: "",
  };
};