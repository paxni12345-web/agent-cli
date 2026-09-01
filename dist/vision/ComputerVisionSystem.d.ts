/**
 * Computer Vision System
 * Image processing, object detection, face recognition, OCR, and image classification
 */
export interface ImageFile {
    id: string;
    filename: string;
    path: string;
    format: ImageFormat;
    width: number;
    height: number;
    size: number;
    metadata: ImageMetadata;
    status: ProcessingStatus;
    createdAt: Date;
}
export declare enum ImageFormat {
    JPEG = "jpeg",
    PNG = "png",
    WebP = "webp",
    GIF = "gif",
    BMP = "bmp",
    TIFF = "tiff"
}
export interface ImageMetadata {
    title?: string;
    description?: string;
    tags?: string[];
    location?: GeoLocation;
    capturedAt?: Date;
    camera?: CameraInfo;
}
export interface GeoLocation {
    latitude: number;
    longitude: number;
}
export interface CameraInfo {
    make?: string;
    model?: string;
    exposureTime?: string;
    fNumber?: number;
    iso?: number;
}
export declare enum ProcessingStatus {
    Uploading = "uploading",
    Processing = "processing",
    Ready = "ready",
    Failed = "failed"
}
export interface ObjectDetection {
    imageId: string;
    objects: DetectedObject[];
    detectedAt: Date;
}
export interface DetectedObject {
    label: string;
    confidence: number;
    boundingBox: BoundingBox;
    attributes?: Record<string, any>;
}
export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface FaceDetection {
    imageId: string;
    faces: DetectedFace[];
    detectedAt: Date;
}
export interface DetectedFace {
    id: string;
    confidence: number;
    boundingBox: BoundingBox;
    landmarks: FaceLandmark[];
    attributes: FaceAttributes;
    embedding?: number[];
}
export interface FaceLandmark {
    type: LandmarkType;
    x: number;
    y: number;
}
export declare enum LandmarkType {
    LeftEye = "left_eye",
    RightEye = "right_eye",
    Nose = "nose",
    LeftMouth = "left_mouth",
    RightMouth = "right_mouth"
}
export interface FaceAttributes {
    age?: number;
    gender?: 'male' | 'female';
    emotion?: Emotion;
    glasses?: boolean;
    beard?: boolean;
    mustache?: boolean;
    smile?: number;
}
export declare enum Emotion {
    Happy = "happy",
    Sad = "sad",
    Angry = "angry",
    Surprised = "surprised",
    Neutral = "neutral",
    Fear = "fear",
    Disgust = "disgust"
}
export interface FaceRecognition {
    faceId: string;
    personId?: string;
    confidence: number;
    recognizedAt: Date;
}
export interface Person {
    id: string;
    name: string;
    faceIds: string[];
    metadata: Record<string, any>;
    createdAt: Date;
}
export interface OCRResult {
    imageId: string;
    text: string;
    words: DetectedWord[];
    lines: DetectedLine[];
    confidence: number;
    extractedAt: Date;
}
export interface DetectedWord {
    text: string;
    confidence: number;
    boundingBox: BoundingBox;
}
export interface DetectedLine {
    text: string;
    words: DetectedWord[];
    boundingBox: BoundingBox;
}
export interface ImageClassification {
    imageId: string;
    labels: ClassificationLabel[];
    classifiedAt: Date;
}
export interface ClassificationLabel {
    name: string;
    confidence: number;
    category?: string;
}
export interface ImageSimilarity {
    image1Id: string;
    image2Id: string;
    similarity: number;
    method: SimilarityMethod;
    calculatedAt: Date;
}
export declare enum SimilarityMethod {
    Perceptual = "perceptual",
    Histogram = "histogram",
    Feature = "feature"
}
export interface ImageTransformation {
    id: string;
    imageId: string;
    operation: TransformOperation;
    parameters: Record<string, any>;
    outputPath?: string;
    status: ProcessingStatus;
    createdAt: Date;
}
export declare enum TransformOperation {
    Resize = "resize",
    Crop = "crop",
    Rotate = "rotate",
    Flip = "flip",
    Brightness = "brightness",
    Contrast = "contrast",
    Saturation = "saturation",
    Blur = "blur",
    Sharpen = "sharpen",
    Grayscale = "grayscale",
    Sepia = "sepia"
}
export interface ColorAnalysis {
    imageId: string;
    dominantColors: Color[];
    palette: Color[];
    averageColor: Color;
    analyzedAt: Date;
}
export interface Color {
    r: number;
    g: number;
    b: number;
    hex: string;
    percentage?: number;
}
export interface ImageQualityScore {
    imageId: string;
    overallScore: number;
    sharpness: number;
    brightness: number;
    contrast: number;
    noise: number;
    calculatedAt: Date;
}
/**
 * Image Manager
 */
export declare class ImageManager {
    private images;
    /**
     * Upload image
     */
    uploadImage(image: Omit<ImageFile, 'id' | 'status' | 'createdAt'>): Promise<ImageFile>;
    /**
     * Get image
     */
    getImage(imageId: string): ImageFile | undefined;
    /**
     * List images
     */
    listImages(filter?: {
        format?: ImageFormat;
        status?: ProcessingStatus;
    }): ImageFile[];
    /**
     * Update metadata
     */
    updateMetadata(imageId: string, metadata: Partial<ImageMetadata>): void;
    /**
     * Delete image
     */
    deleteImage(imageId: string): void;
    private generateImageId;
}
/**
 * Object Detector
 */
export declare class ObjectDetector {
    private detections;
    private imageManager;
    constructor(imageManager: ImageManager);
    /**
     * Detect objects
     */
    detect(imageId: string): Promise<ObjectDetection>;
    /**
     * Get detection
     */
    getDetection(imageId: string): ObjectDetection | undefined;
    /**
     * Find objects by label
     */
    findByLabel(imageId: string, label: string): DetectedObject[];
    private mockDetectObjects;
}
/**
 * Face Detector
 */
export declare class FaceDetector {
    private detections;
    private imageManager;
    constructor(imageManager: ImageManager);
    /**
     * Detect faces
     */
    detect(imageId: string): Promise<FaceDetection>;
    /**
     * Get detection
     */
    getDetection(imageId: string): FaceDetection | undefined;
    private mockDetectFaces;
    private mockLandmarks;
    private randomEmotion;
    private generateFaceId;
}
/**
 * Face Recognition Manager
 */
export declare class FaceRecognitionManager {
    private persons;
    private recognitions;
    private faceDetector;
    constructor(faceDetector: FaceDetector);
    /**
     * Create person
     */
    createPerson(person: Omit<Person, 'id' | 'faceIds' | 'createdAt'>): Person;
    /**
     * Add face to person
     */
    addFaceToPerson(personId: string, faceId: string): void;
    /**
     * Recognize face
     */
    recognize(faceId: string): Promise<FaceRecognition | null>;
    /**
     * Get person
     */
    getPerson(personId: string): Person | undefined;
    /**
     * List persons
     */
    listPersons(): Person[];
    /**
     * Delete person
     */
    deletePerson(personId: string): void;
    private generatePersonId;
}
/**
 * OCR Engine
 */
export declare class OCREngine {
    private results;
    private imageManager;
    constructor(imageManager: ImageManager);
    /**
     * Extract text from image
     */
    extractText(imageId: string): Promise<OCRResult>;
    /**
     * Get result
     */
    getResult(imageId: string): OCRResult | undefined;
    private mockExtractWords;
    private mockExtractLines;
}
/**
 * Image Classifier
 */
export declare class ImageClassifier {
    private classifications;
    private imageManager;
    constructor(imageManager: ImageManager);
    /**
     * Classify image
     */
    classify(imageId: string): Promise<ImageClassification>;
    /**
     * Get classification
     */
    getClassification(imageId: string): ImageClassification | undefined;
    private mockClassify;
}
/**
 * Image Processor
 */
export declare class ImageProcessor {
    private transformations;
    private imageManager;
    constructor(imageManager: ImageManager);
    /**
     * Transform image
     */
    transform(imageId: string, operation: TransformOperation, parameters: Record<string, any>): Promise<ImageTransformation>;
    /**
     * Get transformation
     */
    getTransformation(transformationId: string): ImageTransformation | undefined;
    /**
     * List transformations
     */
    listTransformations(imageId?: string): ImageTransformation[];
    private generateTransformationId;
}
/**
 * Color Analyzer
 */
export declare class ColorAnalyzer {
    private analyses;
    private imageManager;
    constructor(imageManager: ImageManager);
    /**
     * Analyze colors
     */
    analyze(imageId: string): Promise<ColorAnalysis>;
    /**
     * Get analysis
     */
    getAnalysis(imageId: string): ColorAnalysis | undefined;
    private mockDominantColors;
    private mockPalette;
    private calculateAverageColor;
}
/**
 * Image Quality Assessor
 */
export declare class ImageQualityAssessor {
    private scores;
    private imageManager;
    constructor(imageManager: ImageManager);
    /**
     * Assess quality
     */
    assess(imageId: string): Promise<ImageQualityScore>;
    /**
     * Get score
     */
    getScore(imageId: string): ImageQualityScore | undefined;
}
/**
 * Singleton instances
 */
export declare const imageManager: ImageManager;
export declare const objectDetector: ObjectDetector;
export declare const faceDetector: FaceDetector;
export declare const faceRecognitionManager: FaceRecognitionManager;
export declare const ocrEngine: OCREngine;
export declare const imageClassifier: ImageClassifier;
export declare const imageProcessor: ImageProcessor;
export declare const colorAnalyzer: ColorAnalyzer;
export declare const imageQualityAssessor: ImageQualityAssessor;
//# sourceMappingURL=ComputerVisionSystem.d.ts.map