/**
 * Video Processing System
 * Video encoding, transcoding, streaming, thumbnails, and watermarking
 */
export interface VideoFile {
    id: string;
    filename: string;
    path: string;
    format: VideoFormat;
    codec: VideoCodec;
    duration: number;
    bitrate: number;
    frameRate: number;
    resolution: VideoResolution;
    size: number;
    metadata: VideoMetadata;
    status: VideoStatus;
    createdAt: Date;
}
export declare enum VideoFormat {
    MP4 = "mp4",
    WebM = "webm",
    AVI = "avi",
    MOV = "mov",
    MKV = "mkv",
    FLV = "flv"
}
export declare enum VideoCodec {
    H264 = "h264",
    H265 = "h265",
    VP8 = "vp8",
    VP9 = "vp9",
    AV1 = "av1"
}
export interface VideoResolution {
    width: number;
    height: number;
    label?: string;
}
export interface VideoMetadata {
    title?: string;
    description?: string;
    author?: string;
    tags?: string[];
    thumbnail?: string;
    subtitles?: SubtitleTrack[];
}
export interface SubtitleTrack {
    id: string;
    language: string;
    format: SubtitleFormat;
    url: string;
}
export declare enum SubtitleFormat {
    SRT = "srt",
    VTT = "vtt",
    ASS = "ass"
}
export declare enum VideoStatus {
    Uploading = "uploading",
    Processing = "processing",
    Ready = "ready",
    Failed = "failed"
}
export interface TranscodingJob {
    id: string;
    videoId: string;
    profile: TranscodingProfile;
    status: JobStatus;
    progress: number;
    outputPath?: string;
    startedAt: Date;
    completedAt?: Date;
    error?: string;
}
export declare enum JobStatus {
    Pending = "pending",
    Running = "running",
    Completed = "completed",
    Failed = "failed",
    Canceled = "canceled"
}
export interface TranscodingProfile {
    name: string;
    format: VideoFormat;
    codec: VideoCodec;
    resolution: VideoResolution;
    bitrate: number;
    frameRate: number;
    audioCodec: AudioCodec;
    audioBitrate: number;
}
export declare enum AudioCodec {
    AAC = "aac",
    MP3 = "mp3",
    Opus = "opus",
    Vorbis = "vorbis"
}
export interface StreamingSession {
    id: string;
    videoId: string;
    protocol: StreamingProtocol;
    quality: StreamingQuality;
    bandwidth: number;
    startedAt: Date;
    lastActivity: Date;
    viewerCount: number;
}
export declare enum StreamingProtocol {
    HLS = "hls",
    DASH = "dash",
    RTMP = "rtmp",
    WebRTC = "webrtc"
}
export declare enum StreamingQuality {
    Auto = "auto",
    Low = "low",
    Medium = "medium",
    High = "high",
    HD = "hd",
    UHD = "4k"
}
export interface Thumbnail {
    id: string;
    videoId: string;
    timestamp: number;
    url: string;
    width: number;
    height: number;
    format: ImageFormat;
    createdAt: Date;
}
export declare enum ImageFormat {
    JPEG = "jpeg",
    PNG = "png",
    WebP = "webp"
}
export interface Watermark {
    id: string;
    type: WatermarkType;
    content: string;
    position: WatermarkPosition;
    opacity: number;
    scale: number;
}
export declare enum WatermarkType {
    Text = "text",
    Image = "image"
}
export interface WatermarkPosition {
    x: number;
    y: number;
    anchor: PositionAnchor;
}
export declare enum PositionAnchor {
    TopLeft = "top-left",
    TopCenter = "top-center",
    TopRight = "top-right",
    MiddleLeft = "middle-left",
    MiddleCenter = "middle-center",
    MiddleRight = "middle-right",
    BottomLeft = "bottom-left",
    BottomCenter = "bottom-center",
    BottomRight = "bottom-right"
}
export interface VideoAnalytics {
    videoId: string;
    views: number;
    totalWatchTime: number;
    averageWatchTime: number;
    completionRate: number;
    engagementRate: number;
    viewsByRegion: Map<string, number>;
    viewsByDevice: Map<string, number>;
}
export interface VideoClip {
    id: string;
    videoId: string;
    startTime: number;
    endTime: number;
    duration: number;
    outputPath?: string;
    status: JobStatus;
    createdAt: Date;
}
export interface VideoConcat {
    id: string;
    videoIds: string[];
    outputPath?: string;
    status: JobStatus;
    createdAt: Date;
}
/**
 * Video Manager
 */
export declare class VideoManager {
    private videos;
    /**
     * Upload video
     */
    uploadVideo(video: Omit<VideoFile, 'id' | 'status' | 'createdAt'>): Promise<VideoFile>;
    /**
     * Get video
     */
    getVideo(videoId: string): VideoFile | undefined;
    /**
     * List videos
     */
    listVideos(filter?: {
        status?: VideoStatus;
        format?: VideoFormat;
    }): VideoFile[];
    /**
     * Update video metadata
     */
    updateMetadata(videoId: string, metadata: Partial<VideoMetadata>): void;
    /**
     * Delete video
     */
    deleteVideo(videoId: string): void;
    /**
     * Get video info
     */
    analyzeVideo(videoId: string): Promise<VideoFile | null>;
    private generateVideoId;
}
/**
 * Transcoding Manager
 */
export declare class TranscodingManager {
    private jobs;
    private profiles;
    private videoManager;
    constructor(videoManager: VideoManager);
    /**
     * Create transcoding job
     */
    createJob(videoId: string, profileName: string): Promise<TranscodingJob>;
    /**
     * Process transcoding job
     */
    private processJob;
    /**
     * Cancel job
     */
    cancelJob(jobId: string): void;
    /**
     * Get job
     */
    getJob(jobId: string): TranscodingJob | undefined;
    /**
     * List jobs
     */
    listJobs(filter?: {
        videoId?: string;
        status?: JobStatus;
    }): TranscodingJob[];
    /**
     * Register profile
     */
    registerProfile(name: string, profile: TranscodingProfile): void;
    /**
     * List profiles
     */
    listProfiles(): TranscodingProfile[];
    private initializeProfiles;
    private generateJobId;
}
/**
 * Streaming Manager
 */
export declare class StreamingManager {
    private sessions;
    private videoManager;
    constructor(videoManager: VideoManager);
    /**
     * Start streaming session
     */
    startSession(videoId: string, protocol: StreamingProtocol, quality: StreamingQuality): StreamingSession;
    /**
     * Update session activity
     */
    updateActivity(sessionId: string): void;
    /**
     * End session
     */
    endSession(sessionId: string): void;
    /**
     * Get session
     */
    getSession(sessionId: string): StreamingSession | undefined;
    /**
     * List sessions
     */
    listSessions(filter?: {
        videoId?: string;
        protocol?: StreamingProtocol;
    }): StreamingSession[];
    /**
     * Get concurrent viewers
     */
    getViewerCount(videoId: string): number;
    private calculateBandwidth;
    private generateSessionId;
}
/**
 * Thumbnail Manager
 */
export declare class ThumbnailManager {
    private thumbnails;
    private videoManager;
    constructor(videoManager: VideoManager);
    /**
     * Generate thumbnail
     */
    generateThumbnail(videoId: string, timestamp: number, options?: {
        width?: number;
        height?: number;
        format?: ImageFormat;
    }): Promise<Thumbnail>;
    /**
     * Generate multiple thumbnails
     */
    generateThumbnails(videoId: string, count: number): Promise<Thumbnail[]>;
    /**
     * Get thumbnail
     */
    getThumbnail(thumbnailId: string): Thumbnail | undefined;
    /**
     * List thumbnails
     */
    listThumbnails(videoId: string): Thumbnail[];
    /**
     * Delete thumbnail
     */
    deleteThumbnail(thumbnailId: string): void;
    private generateThumbnailId;
}
/**
 * Watermark Manager
 */
export declare class WatermarkManager {
    private watermarks;
    /**
     * Create watermark
     */
    createWatermark(watermark: Omit<Watermark, 'id'>): Watermark;
    /**
     * Apply watermark to video
     */
    applyWatermark(videoId: string, watermarkId: string): Promise<string>;
    /**
     * Get watermark
     */
    getWatermark(watermarkId: string): Watermark | undefined;
    /**
     * List watermarks
     */
    listWatermarks(): Watermark[];
    /**
     * Delete watermark
     */
    deleteWatermark(watermarkId: string): void;
    private generateWatermarkId;
}
/**
 * Video Analytics Manager
 */
export declare class VideoAnalyticsManager {
    private analytics;
    /**
     * Track view
     */
    trackView(videoId: string, watchTime: number, region?: string, device?: string): void;
    /**
     * Get analytics
     */
    getAnalytics(videoId: string): VideoAnalytics | undefined;
    /**
     * List analytics
     */
    listAnalytics(): VideoAnalytics[];
}
/**
 * Video Editor Manager
 */
export declare class VideoEditorManager {
    private clips;
    private concats;
    private videoManager;
    constructor(videoManager: VideoManager);
    /**
     * Create clip
     */
    createClip(videoId: string, startTime: number, endTime: number): Promise<VideoClip>;
    /**
     * Concatenate videos
     */
    concatenateVideos(videoIds: string[]): Promise<VideoConcat>;
    /**
     * Get clip
     */
    getClip(clipId: string): VideoClip | undefined;
    /**
     * List clips
     */
    listClips(videoId?: string): VideoClip[];
    private processClip;
    private processConcat;
    private generateClipId;
    private generateConcatId;
}
/**
 * Singleton instances
 */
export declare const videoManager: VideoManager;
export declare const transcodingManager: TranscodingManager;
export declare const streamingManager: StreamingManager;
export declare const thumbnailManager: ThumbnailManager;
export declare const watermarkManager: WatermarkManager;
export declare const videoAnalyticsManager: VideoAnalyticsManager;
export declare const videoEditorManager: VideoEditorManager;
//# sourceMappingURL=VideoProcessingSystem.d.ts.map