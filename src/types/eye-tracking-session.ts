/**
 * Common Eye Tracking Session Data Structure
 * 
 * Shared between browser plugin and frontend for consistency
 * Copy of cogix-frontend/types/eye-tracking-session.ts
 */

// Base gaze data point
export interface GazePoint {
  timestamp: number;    // Milliseconds from recording start
  x: number;           // Screen X coordinate (pixels)
  y: number;           // Screen Y coordinate (pixels)
  confidence?: number; // Confidence score (0-1)
}

// Recording metadata
export interface RecordingMetadata {
  duration: number;           // Total duration in seconds
  screen_width: number;       // Screen resolution width
  screen_height: number;      // Screen resolution height
  device: string;            // Recording device type
  source: string;            // Source of the recording
  gaze_points_count: number; // Total number of gaze points
  has_video: boolean;        // Whether video file exists
  has_gaze_file: boolean;    // Whether gaze data file exists
  storage_type: 'edge_r2' | 'backend' | 'local'; // Storage location
  
  // Browser context (for browser plugin recordings)
  url?: string;              // Page URL during recording
  title?: string;            // Page title during recording
  user_agent?: string;       // Browser user agent
  
  // Recording settings
  recording_settings?: {
    fps: number;             // Video frame rate
    resolution: string;      // Video resolution (e.g., "1280x720")
    codec: string;           // Video codec used
    bitrate?: number;        // Video bitrate
  };
  
  // Eye tracking settings
  eye_tracking_settings?: {
    sampling_rate: number;   // Eye tracking sampling rate (Hz)
    calibration_points?: number; // Number of calibration points used
    tracker_model?: string;  // Eye tracker model/type
  };
  
  // Additional metadata
  [key: string]: any;
}

// Session submission metadata
export interface SessionSubmissionMetadata {
  source: 'browser-extension' | 'frontend-test' | 'api-upload' | 'manual-test';
  type: 'eye_tracking_session';
  storage_method: 'edge_worker' | 'backend' | 'local';
  submitted_at: string;      // ISO timestamp
  extension_version?: string; // Browser extension version
  frontend_version?: string;  // Frontend version
  api_version?: string;      // API version used
}

// Complete session data structure for storage
export interface EyeTrackingSessionData {
  data: {
    session_id: string;
    
    // Video file information
    video_file_key?: string;        // R2 file key for video
    video_file_uploaded: boolean;
    video_signed_url?: string;      // Generated signed URL (not stored)
    
    // Gaze data file information  
    gaze_data_file_key?: string;    // R2 file key for gaze data file
    gaze_data_file_uploaded: boolean;
    gaze_data_signed_url?: string;  // Generated signed URL (not stored)
    
    // Gaze data (for quick access without file download)
    gaze_data: GazePoint[];
    
    // Session metadata
    metadata: RecordingMetadata;
  };
  
  // Submission metadata
  metadata: SessionSubmissionMetadata;
}

// Constants
export const EYE_TRACKING_CONSTANTS = {
  // Default values
  DEFAULT_SAMPLING_RATE: 60,     // Hz
  DEFAULT_VIDEO_FPS: 30,         // FPS
  DEFAULT_SCREEN_WIDTH: 1920,    // Pixels
  DEFAULT_SCREEN_HEIGHT: 1080,   // Pixels
  
  // File constraints
  MAX_VIDEO_SIZE_MB: 500,        // Maximum video file size
  MAX_GAZE_POINTS: 100000,       // Maximum gaze points per session
  MAX_DURATION_SECONDS: 3600,    // Maximum session duration (1 hour)
  
  // URL expiration
  SIGNED_URL_EXPIRES_HOURS: 1,   // Signed URL expiration time
  
  // Session ID patterns
  BROWSER_PLUGIN_PREFIX: 'ext_',
  FRONTEND_TEST_PREFIX: 'test_',
  API_UPLOAD_PREFIX: 'api_',
} as const;

// Validation helpers
export const validateGazePoint = (point: any): point is GazePoint => {
  return (
    typeof point === 'object' &&
    typeof point.timestamp === 'number' &&
    typeof point.x === 'number' &&
    typeof point.y === 'number' &&
    (point.confidence === undefined || typeof point.confidence === 'number')
  );
};

export const validateSessionData = (data: any): data is EyeTrackingSessionData => {
  return (
    typeof data === 'object' &&
    typeof data.data === 'object' &&
    typeof data.data.session_id === 'string' &&
    Array.isArray(data.data.gaze_data) &&
    data.data.gaze_data.every(validateGazePoint) &&
    typeof data.data.metadata === 'object' &&
    typeof data.metadata === 'object'
  );
};

export default EyeTrackingSessionData;
