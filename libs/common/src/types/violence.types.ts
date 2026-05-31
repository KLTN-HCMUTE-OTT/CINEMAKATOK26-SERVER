/**
 * Represents a bounding box for censorship, with normalized coordinates [0.0 - 1.0].
 */
export interface CensorBox {
  x: number; // normalized X (top-left) relative to width
  y: number; // normalized Y (top-left) relative to height
  w: number; // normalized width relative to width
  h: number; // normalized height relative to height
  label: string; // label of the intimate part / weapon
  score: number; // confidence score
}

/**
 * Represents a frame containing nudity/violence/censorship coordinates.
 */
export interface CensorFrame {
  /** Timestamp in seconds */
  timestamp: number;
  /** Bounding boxes to censor in this frame */
  boxes: CensorBox[];
}

/** Sensitivity level for a content category */
export type ContentSensitivity = 'off' | 'moderate' | 'strict';

/**
 * User content sensitivity preferences.
 * Stored as JSONB — easily extensible for future categories
 * without requiring database migrations.
 */
export interface ContentPreferences {
  violence: ContentSensitivity;
  nudity: ContentSensitivity;
  // Future extensions (no migration needed):
  // flashingLights?: ContentSensitivity;
  // gore?: ContentSensitivity;
  // selfHarm?: ContentSensitivity;
}

export const DEFAULT_CONTENT_PREFERENCES: ContentPreferences = {
  violence: 'strict',
  nudity: 'strict',
};

/**
 * Result of running violence detection on a video.
 * Returned by ViolenceDetectorService.
 */
export interface ViolenceDetectionResult {
  /** Whether any violent segment was detected above threshold */
  isViolent: boolean;
  /** Max score across all detected frames */
  overallScore: number;
  /** Bounding box coordinates over time */
  violentSegments: CensorFrame[];
  /** Total number of frames analyzed */
  totalFramesAnalyzed: number;
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Result of running nudity detection on a video.
 * Returned by NudityDetectorService.
 */
export interface NudityDetectionResult {
  /** Whether any nudity was detected above threshold */
  isNude: boolean;
  /** Max score across all detected frames */
  overallScore: number;
  /** Bounding box coordinates over time */
  nuditySegments: CensorFrame[];
  /** Total number of frames analyzed */
  totalFramesAnalyzed: number;
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

