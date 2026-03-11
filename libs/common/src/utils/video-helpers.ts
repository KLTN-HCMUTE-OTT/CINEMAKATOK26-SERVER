import { EntityVideo } from 'src/cms/entities/video.entity';

/**
 * Group videos by their source filename
 * Useful when you have multiple resolutions of the same video
 *
 * @example
 * Input: [
 *   { videoUrl: "/uploads/video-123/stream_0/playlist.m3u8", resolution: "HIGH" },
 *   { videoUrl: "/uploads/video-123/stream_1/playlist.m3u8", resolution: "MEDIUM" },
 *   { videoUrl: "/uploads/video-456/stream_0/playlist.m3u8", resolution: "HIGH" }
 * ]
 *
 * Output: {
 *   "video-123": [
 *     { videoUrl: "/uploads/video-123/stream_0/playlist.m3u8", resolution: "HIGH" },
 *     { videoUrl: "/uploads/video-123/stream_1/playlist.m3u8", resolution: "MEDIUM" }
 *   ],
 *   "video-456": [
 *     { videoUrl: "/uploads/video-456/stream_0/playlist.m3u8", resolution: "HIGH" }
 *   ]
 * }
 */
export function groupVideosBySource(videos: EntityVideo[]): Record<string, EntityVideo[]> {
  const grouped: Record<string, EntityVideo[]> = {};

  for (const video of videos) {
    // Extract source name from videoUrl
    // Example: "/uploads/video-123/stream_0/playlist.m3u8" → "video-123"
    const match = video.videoUrl.match(/\/uploads\/([^\/]+)\//);
    if (match) {
      const sourceName = match[1];
      if (!grouped[sourceName]) {
        grouped[sourceName] = [];
      }
      grouped[sourceName].push(video);
    }
  }

  return grouped;
}

/**
 * Extract source name from video URL
 *
 * @example
 * extractSourceName("/uploads/video-123/stream_0/playlist.m3u8") // "video-123"
 */
export function extractSourceName(videoUrl: string): string | null {
  const match = videoUrl.match(/\/uploads\/([^\/]+)\//);
  return match ? match[1] : null;
}

/**
 * Check if videos belong to the same source
 */
export function isSameSource(video1: EntityVideo, video2: EntityVideo): boolean {
  const source1 = extractSourceName(video1.videoUrl);
  const source2 = extractSourceName(video2.videoUrl);
  return source1 !== null && source1 === source2;
}

/**
 * Get all statuses available for a video source
 */
export function getAvailableStatuses(videos: EntityVideo[]): string[] {
  return [...new Set(videos.map(v => v.status))].sort();
}

/**
 * Find video with specific status
 */
export function findVideoByStatus(videos: EntityVideo[], status: string): EntityVideo | undefined {
  return videos.find(v => v.status === status);
}

/**
 * Get master playlist URL for a video source
 *
 * @example
 * getMasterPlaylistUrl("/uploads/video-123/stream_0/playlist.m3u8")
 * // "/uploads/video-123/master.m3u8"
 */
export function getMasterPlaylistUrl(videoUrl: string): string | null {
  const match = videoUrl.match(/\/uploads\/([^\/]+)\//);
  if (match) {
    return `/uploads/${match[1]}/master.m3u8`;
  }
  return null;
}

/**
 * Format video response with all resolutions
 * Useful for API responses
 */
export interface VideoResponse {
  source: string;
  masterPlaylist: string;
  variants: Array<{
    url: string;
    id: string;
    status: string;
  }>;
}

export function formatVideoResponse(videos: EntityVideo[]): VideoResponse | null {
  if (videos.length === 0) return null;

  const source = extractSourceName(videos[0].videoUrl);
  if (!source) return null;

  const masterPlaylist = getMasterPlaylistUrl(videos[0].videoUrl);
  if (!masterPlaylist) return null;

  return {
    source,
    masterPlaylist,
    variants: videos.map(v => ({
      url: v.videoUrl,
      id: v.id,
      status: v.status,
    })),
  };
}
