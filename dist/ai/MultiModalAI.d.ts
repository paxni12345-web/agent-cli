/**
 * Multi-Modal AI System
 * Handles text, image, audio, and video AI processing
 *
 * Part of the Ultimate Agent CLI (350K lines goal)
 */
import { EventEmitter } from 'events';
export interface MultiModalConfig {
    enableVision: boolean;
    enableAudio: boolean;
    enableVideo: boolean;
    enableOCR: boolean;
    maxImageSize: number;
    maxAudioDuration: number;
    maxVideoDuration: number;
    defaultProvider: AIProvider;
}
export type AIProvider = 'anthropic' | 'openai' | 'google' | 'local';
export interface VisionTask {
    id: string;
    type: VisionTaskType;
    image: ImageInput;
    options: VisionOptions;
    status: TaskStatus;
    result?: VisionResult;
    createdAt: Date;
    completedAt?: Date;
}
export type VisionTaskType = 'classification' | 'object_detection' | 'segmentation' | 'face_recognition' | 'ocr' | 'captioning' | 'embedding';
export interface ImageInput {
    data: Buffer | string;
    format: ImageFormat;
    width?: number;
    height?: number;
    url?: string;
}
export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'gif' | 'bmp';
export interface VisionOptions {
    model?: string;
    confidence?: number;
    maxResults?: number;
    language?: string;
}
export interface VisionResult {
    predictions: Prediction[];
    confidence: number;
    metadata: ResultMetadata;
}
export interface Prediction {
    label: string;
    score: number;
    boundingBox?: BoundingBox;
    metadata?: Record<string, any>;
}
export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface ResultMetadata {
    processingTime: number;
    model: string;
    provider: AIProvider;
    timestamp: Date;
}
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';
export interface AudioTask {
    id: string;
    type: AudioTaskType;
    audio: AudioInput;
    options: AudioOptions;
    status: TaskStatus;
    result?: AudioResult;
    createdAt: Date;
    completedAt?: Date;
}
export type AudioTaskType = 'transcription' | 'translation' | 'classification' | 'speaker_diarization' | 'emotion_detection' | 'tts' | 'noise_reduction';
export interface AudioInput {
    data: Buffer | string;
    format: AudioFormat;
    duration?: number;
    sampleRate?: number;
    channels?: number;
    url?: string;
}
export type AudioFormat = 'mp3' | 'wav' | 'ogg' | 'flac' | 'm4a';
export interface AudioOptions {
    model?: string;
    language?: string;
    speakers?: number;
    enhanceAudio?: boolean;
}
export interface AudioResult {
    text?: string;
    segments?: AudioSegment[];
    speakers?: Speaker[];
    emotions?: EmotionScore[];
    metadata: ResultMetadata;
}
export interface AudioSegment {
    start: number;
    end: number;
    text: string;
    confidence: number;
    speaker?: string;
}
export interface Speaker {
    id: string;
    name?: string;
    segments: number[];
    confidence: number;
}
export interface EmotionScore {
    emotion: EmotionType;
    score: number;
    timestamp: number;
}
export type EmotionType = 'joy' | 'sadness' | 'anger' | 'fear' | 'surprise' | 'neutral';
export interface VideoTask {
    id: string;
    type: VideoTaskType;
    video: VideoInput;
    options: VideoOptions;
    status: TaskStatus;
    result?: VideoResult;
    createdAt: Date;
    completedAt?: Date;
}
export type VideoTaskType = 'analysis' | 'scene_detection' | 'action_recognition' | 'object_tracking' | 'summarization' | 'captioning';
export interface VideoInput {
    data: Buffer | string;
    format: VideoFormat;
    duration?: number;
    fps?: number;
    resolution?: Resolution;
    url?: string;
}
export type VideoFormat = 'mp4' | 'avi' | 'mov' | 'mkv' | 'webm';
export interface Resolution {
    width: number;
    height: number;
}
export interface VideoOptions {
    model?: string;
    frameRate?: number;
    startTime?: number;
    endTime?: number;
}
export interface VideoResult {
    scenes: Scene[];
    actions: Action[];
    objects: DetectedObject[];
    summary?: string;
    metadata: ResultMetadata;
}
export interface Scene {
    start: number;
    end: number;
    description: string;
    keyFrame: number;
    confidence: number;
}
export interface Action {
    label: string;
    start: number;
    end: number;
    confidence: number;
    actors?: string[];
}
export interface DetectedObject {
    label: string;
    frames: number[];
    boundingBoxes: BoundingBox[];
    confidence: number;
}
export declare class MultiModalAIManager extends EventEmitter {
    private config;
    private visionTasks;
    private audioTasks;
    private videoTasks;
    private processingQueue;
    constructor(config?: Partial<MultiModalConfig>);
    classifyImage(image: ImageInput, options?: VisionOptions): Promise<VisionResult>;
    detectObjects(image: ImageInput, options?: VisionOptions): Promise<VisionResult>;
    recognizeFaces(image: ImageInput, options?: VisionOptions): Promise<VisionResult>;
    extractTextOCR(image: ImageInput, options?: VisionOptions): Promise<VisionResult>;
    generateCaption(image: ImageInput, options?: VisionOptions): Promise<VisionResult>;
    transcribeAudio(audio: AudioInput, options?: AudioOptions): Promise<AudioResult>;
    detectSpeakers(audio: AudioInput, options?: AudioOptions): Promise<AudioResult>;
    detectEmotions(audio: AudioInput, options?: AudioOptions): Promise<AudioResult>;
    textToSpeech(text: string, options?: AudioOptions): Promise<Buffer>;
    analyzeVideo(video: VideoInput, options?: VideoOptions): Promise<VideoResult>;
    detectScenes(video: VideoInput, options?: VideoOptions): Promise<VideoResult>;
    private createVisionTask;
    private createAudioTask;
    private createVideoTask;
    private generateId;
    getStats(): {
        visionTasks: number;
        audioTasks: number;
        videoTasks: number;
        processingQueue: number;
    };
}
//# sourceMappingURL=MultiModalAI.d.ts.map