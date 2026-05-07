/**
 * Shaka Player + ClearKey DRM Integration for CINEMAKATOK26
 *
 * This replaces HLS.js for DRM-protected content.
 * Install: npm install shaka-player
 *
 * Usage:
 *   import { initDrmPlayer, loadDrmVideo, destroyPlayer } from './shaka-drm-player';
 *
 *   const videoEl = document.getElementById('video') as HTMLVideoElement;
 *   const player = await initDrmPlayer(videoEl);
 *   await loadDrmVideo(player, videoId, jwtToken, apiBaseUrl);
 *
 *   // Cleanup
 *   destroyPlayer(player);
 */

// @ts-ignore - Shaka Player types
import shaka from 'shaka-player/dist/shaka-player.compiled';

const SHAKA_LOG_LEVEL = 1; // 0=NONE, 1=ERROR, 2=WARNING, 3=INFO, 4=DEBUG

/**
 * Initialize Shaka Player with ClearKey DRM support.
 */
export async function initDrmPlayer(
  videoElement: HTMLVideoElement,
): Promise<any> {
  // Install polyfills (required for some browsers)
  shaka.polyfill.installAll();

  // Check browser support
  if (!shaka.Player.isBrowserSupported()) {
    throw new Error(
      'Browser does not support Shaka Player. Use Chrome or Edge.',
    );
  }

  const player = new shaka.Player();
  await player.attach(videoElement);

  // Configure logging
  shaka.log.setLevel(SHAKA_LOG_LEVEL);

  // Error handler
  player.addEventListener('error', (event: any) => {
    const error = event.detail;
    console.error(
      `[Shaka Player Error] Code: ${error.code}, Category: ${error.category}`,
      error,
    );
  });

  console.log('[DRM] Shaka Player initialized');
  return player;
}

/**
 * Load a DRM-protected video.
 *
 * Flow:
 * 1. Fetch manifest URL + DRM key info from the API
 * 2. Configure Shaka Player with ClearKey license URL
 * 3. Load the DASH manifest
 * 4. Shaka automatically requests a license when it encounters encrypted content
 */
export async function loadDrmVideo(
  player: any,
  videoId: string,
  jwtToken: string,
  apiBaseUrl: string,
): Promise<void> {
  // Step 1: Get the manifest URL from the API
  const manifestResponse = await fetch(
    `${apiBaseUrl}/videos/${videoId}/manifest`,
    {
      headers: {
        Authorization: `Bearer ${jwtToken}`,
      },
      credentials: 'include', // Include signed cookies
    },
  );

  if (!manifestResponse.ok) {
    throw new Error(
      `Failed to get manifest URL: ${manifestResponse.status}`,
    );
  }

  const manifestData = await manifestResponse.json();
  const manifestUrl = manifestData.data?.manifestUrl;

  if (!manifestUrl) {
    throw new Error('No manifest URL returned from API');
  }

  // Step 2: Configure ClearKey DRM
  // The license server URL points to our API gateway
  const licenseUrl = `${apiBaseUrl}/drm/license/clearkey`;

  player.configure({
    drm: {
      servers: {
        'org.w3.clearkey': licenseUrl,
      },
    },
  });

  // Step 3: Register a license request filter to inject the JWT
  player.getNetworkingEngine().registerRequestFilter(
    (type: number, request: any) => {
      // Only modify license requests
      if (type === shaka.net.NetworkingEngine.RequestType.LICENSE) {
        request.headers['Authorization'] = `Bearer ${jwtToken}`;
        request.headers['Content-Type'] = 'application/json';

        // Transform the ClearKey license request body
        // Shaka sends the raw EME license request; we need to extract kids
        // and send them in our expected format
        if (request.body) {
          try {
            const requestBody = JSON.parse(
              new TextDecoder().decode(request.body),
            );

            // The ClearKey license request contains "kids" (Key IDs in base64url)
            if (requestBody.kids) {
              request.body = new TextEncoder().encode(
                JSON.stringify({ kids: requestBody.kids }),
              );
            }
          } catch {
            // If parsing fails, let the original body pass through
          }
        }
      }
    },
  );

  // Step 4: Load the manifest
  console.log(`[DRM] Loading manifest: ${manifestUrl}`);
  await player.load(manifestUrl);
  console.log('[DRM] Video loaded successfully with DRM');
}

/**
 * Destroy the Shaka Player instance and free resources.
 */
export async function destroyPlayer(player: any): Promise<void> {
  if (player) {
    await player.destroy();
    console.log('[DRM] Player destroyed');
  }
}

/**
 * Get available video quality tracks.
 */
export function getQualityTracks(player: any) {
  const tracks = player.getVariantTracks();
  return tracks.map((track: any) => ({
    id: track.id,
    width: track.width,
    height: track.height,
    bandwidth: track.bandwidth,
    label: `${track.height}p`,
    active: track.active,
  }));
}

/**
 * Set video quality by track ID.
 * Pass null to enable ABR (auto quality selection).
 */
export function setQuality(player: any, trackId: number | null): void {
  if (trackId === null) {
    // Enable ABR
    player.configure({ abr: { enabled: true } });
  } else {
    // Disable ABR and select specific track
    player.configure({ abr: { enabled: false } });
    const tracks = player.getVariantTracks();
    const target = tracks.find((t: any) => t.id === trackId);
    if (target) {
      player.selectVariantTrack(target, /* clearBuffer= */ true);
    }
  }
}

// ─── React Hook Example ───────────────────────────────────────────────────────

/**
 * Example React hook for DRM video playback.
 *
 * Usage in a React component:
 *
 * ```tsx
 * import { useRef, useEffect } from 'react';
 * import { useDrmPlayer } from './shaka-drm-player';
 *
 * function VideoPlayer({ videoId }: { videoId: string }) {
 *   const videoRef = useRef<HTMLVideoElement>(null);
 *   const { isLoading, error } = useDrmPlayer(videoRef, videoId);
 *
 *   return (
 *     <div>
 *       <video ref={videoRef} controls autoPlay style={{ width: '100%' }} />
 *       {isLoading && <p>Loading...</p>}
 *       {error && <p>Error: {error}</p>}
 *     </div>
 *   );
 * }
 * ```
 */
