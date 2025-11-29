/**
 * Server-Side YouTube API Route
 * 
 * Handles all YouTube Data API calls server-side to protect the API key.
 * Supports fetching single videos, playlists, and video details.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/security/rateLimit';
import { logger } from '@/lib/logging/logger';

const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

// YouTube API key is now server-side only (no NEXT_PUBLIC_ prefix)
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

interface YouTubeVideoSnippet {
  title: string;
  publishedAt: string;
  channelTitle: string;
  thumbnails: {
    [key: string]: { url: string };
  };
}

interface YouTubeVideoContentDetails {
  duration: string;
}

interface YouTubeVideoItem {
  id: string;
  snippet: YouTubeVideoSnippet;
  contentDetails: YouTubeVideoContentDetails;
}

interface YouTubePlaylistItem {
  snippet: {
    resourceId: {
      videoId: string;
    };
  };
}

function selectBestThumbnail(thumbnails: { [key: string]: { url: string } }): string {
  return thumbnails.maxres?.url || thumbnails.high?.url || thumbnails.medium?.url || '/placeholder.svg';
}

function formatDuration(duration: string): string {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return '0:00';

  const hours = parseInt(match[1]?.slice(0, -1)) || 0;
  const minutes = parseInt(match[2]?.slice(0, -1)) || 0;
  const seconds = parseInt(match[3]?.slice(0, -1)) || 0;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function parseDurationToSeconds(duration: string): number {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1]?.slice(0, -1)) || 0;
  const minutes = parseInt(match[2]?.slice(0, -1)) || 0;
  const seconds = parseInt(match[3]?.slice(0, -1)) || 0;

  return hours * 3600 + minutes * 60 + seconds;
}

function mapYouTubeItemToVideoInfo(item: YouTubeVideoItem) {
  return {
    id: item.id,
    title: item.snippet.title,
    thumbnail: selectBestThumbnail(item.snippet.thumbnails),
    duration: formatDuration(item.contentDetails.duration),
    durationInSeconds: parseDurationToSeconds(item.contentDetails.duration),
    channelTitle: item.snippet.channelTitle,
    publishedAt: new Date(item.snippet.publishedAt).toISOString(),
    url: `https://www.youtube.com/watch?v=${item.id}`,
  };
}

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await withRateLimit(request, RATE_LIMIT_PRESETS.YOUTUBE);
  if (rateLimitResponse) return rateLimitResponse;

  // Check API key configuration
  if (!YOUTUBE_API_KEY) {
    return NextResponse.json(
      { error: 'YouTube API is not configured. Please contact the administrator.' },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId');
  const playlistId = searchParams.get('playlistId');
  const action = searchParams.get('action') || 'video';

  try {
    if (action === 'video' && videoId) {
      // Fetch single video info
      const response = await fetch(
        `${YOUTUBE_API_BASE_URL}/videos?part=snippet,contentDetails&id=${videoId}&key=${YOUTUBE_API_KEY}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        logger.error('[YOUTUBE_API] API error', { videoId, errorData });
        throw new Error(`YouTube API error: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.items || data.items.length === 0) {
        return NextResponse.json(
          { error: 'Video not found or is private.' },
          { status: 404 }
        );
      }

      const videoInfo = mapYouTubeItemToVideoInfo(data.items[0]);
      return NextResponse.json({ video: videoInfo });

    } else if (action === 'playlist' && playlistId) {
      // Fetch playlist videos
      const videos = [];
      let nextPageToken: string | undefined;

      // Fetch all playlist items (handles pagination)
      do {
        const playlistUrl = new URL(`${YOUTUBE_API_BASE_URL}/playlistItems`);
        playlistUrl.searchParams.set('part', 'snippet');
        playlistUrl.searchParams.set('playlistId', playlistId);
        playlistUrl.searchParams.set('maxResults', '50');
        playlistUrl.searchParams.set('key', YOUTUBE_API_KEY);
        if (nextPageToken) {
          playlistUrl.searchParams.set('pageToken', nextPageToken);
        }

        const playlistResponse = await fetch(playlistUrl.toString());
        if (!playlistResponse.ok) {
          throw new Error(`YouTube API error: ${playlistResponse.statusText}`);
        }

        const playlistData = await playlistResponse.json();
        const videoIds = playlistData.items.map(
          (item: YouTubePlaylistItem) => item.snippet.resourceId.videoId
        );

        // Fetch video details for this batch
        if (videoIds.length > 0) {
          const videosUrl = new URL(`${YOUTUBE_API_BASE_URL}/videos`);
          videosUrl.searchParams.set('part', 'snippet,contentDetails');
          videosUrl.searchParams.set('id', videoIds.join(','));
          videosUrl.searchParams.set('key', YOUTUBE_API_KEY);

          const videosResponse = await fetch(videosUrl.toString());
          if (videosResponse.ok) {
            const videosData = await videosResponse.json();
            const mappedVideos = videosData.items.map(mapYouTubeItemToVideoInfo);
            videos.push(...mappedVideos);
          }
        }

        nextPageToken = playlistData.nextPageToken;
      } while (nextPageToken);

      return NextResponse.json({ 
        videos,
        total: videos.length,
      });

    } else if (action === 'batch' && videoId) {
      // Fetch multiple videos by comma-separated IDs
      const videoIds = videoId.split(',').slice(0, 50); // Limit to 50 videos

      const response = await fetch(
        `${YOUTUBE_API_BASE_URL}/videos?part=snippet,contentDetails&id=${videoIds.join(',')}&key=${YOUTUBE_API_KEY}`
      );

      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.statusText}`);
      }

      const data = await response.json();
      const videos = data.items.map(mapYouTubeItemToVideoInfo);

      return NextResponse.json({ videos });

    } else {
      return NextResponse.json(
        { error: 'Invalid request. Provide videoId or playlistId with appropriate action.' },
        { status: 400 }
      );
    }

  } catch (error) {
    logger.error('[YOUTUBE_API] Request failed', { action: searchParams.get('action') }, error as Error);
    // Don't leak internal error details to client
    return NextResponse.json(
      { error: 'Failed to fetch YouTube data. Please try again later.' },
      { status: 500 }
    );
  }
}
