"use strict";
/**
 * Computer Vision System
 * Image processing, object detection, face recognition, OCR, and image classification
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.imageQualityAssessor = exports.colorAnalyzer = exports.imageProcessor = exports.imageClassifier = exports.ocrEngine = exports.faceRecognitionManager = exports.faceDetector = exports.objectDetector = exports.imageManager = exports.ImageQualityAssessor = exports.ColorAnalyzer = exports.ImageProcessor = exports.ImageClassifier = exports.OCREngine = exports.FaceRecognitionManager = exports.FaceDetector = exports.ObjectDetector = exports.ImageManager = exports.TransformOperation = exports.SimilarityMethod = exports.Emotion = exports.LandmarkType = exports.ProcessingStatus = exports.ImageFormat = void 0;
const EventBus_1 = require("../core/EventBus");
var ImageFormat;
(function (ImageFormat) {
    ImageFormat["JPEG"] = "jpeg";
    ImageFormat["PNG"] = "png";
    ImageFormat["WebP"] = "webp";
    ImageFormat["GIF"] = "gif";
    ImageFormat["BMP"] = "bmp";
    ImageFormat["TIFF"] = "tiff";
})(ImageFormat || (exports.ImageFormat = ImageFormat = {}));
var ProcessingStatus;
(function (ProcessingStatus) {
    ProcessingStatus["Uploading"] = "uploading";
    ProcessingStatus["Processing"] = "processing";
    ProcessingStatus["Ready"] = "ready";
    ProcessingStatus["Failed"] = "failed";
})(ProcessingStatus || (exports.ProcessingStatus = ProcessingStatus = {}));
var LandmarkType;
(function (LandmarkType) {
    LandmarkType["LeftEye"] = "left_eye";
    LandmarkType["RightEye"] = "right_eye";
    LandmarkType["Nose"] = "nose";
    LandmarkType["LeftMouth"] = "left_mouth";
    LandmarkType["RightMouth"] = "right_mouth";
})(LandmarkType || (exports.LandmarkType = LandmarkType = {}));
var Emotion;
(function (Emotion) {
    Emotion["Happy"] = "happy";
    Emotion["Sad"] = "sad";
    Emotion["Angry"] = "angry";
    Emotion["Surprised"] = "surprised";
    Emotion["Neutral"] = "neutral";
    Emotion["Fear"] = "fear";
    Emotion["Disgust"] = "disgust";
})(Emotion || (exports.Emotion = Emotion = {}));
var SimilarityMethod;
(function (SimilarityMethod) {
    SimilarityMethod["Perceptual"] = "perceptual";
    SimilarityMethod["Histogram"] = "histogram";
    SimilarityMethod["Feature"] = "feature";
})(SimilarityMethod || (exports.SimilarityMethod = SimilarityMethod = {}));
var TransformOperation;
(function (TransformOperation) {
    TransformOperation["Resize"] = "resize";
    TransformOperation["Crop"] = "crop";
    TransformOperation["Rotate"] = "rotate";
    TransformOperation["Flip"] = "flip";
    TransformOperation["Brightness"] = "brightness";
    TransformOperation["Contrast"] = "contrast";
    TransformOperation["Saturation"] = "saturation";
    TransformOperation["Blur"] = "blur";
    TransformOperation["Sharpen"] = "sharpen";
    TransformOperation["Grayscale"] = "grayscale";
    TransformOperation["Sepia"] = "sepia";
})(TransformOperation || (exports.TransformOperation = TransformOperation = {}));
/**
 * Image Manager
 */
class ImageManager {
    images = new Map();
    /**
     * Upload image
     */
    async uploadImage(image) {
        const fullImage = {
            ...image,
            id: this.generateImageId(),
            status: ProcessingStatus.Uploading,
            createdAt: new Date(),
        };
        this.images.set(fullImage.id, fullImage);
        EventBus_1.eventBus.emitSync('vision.image_uploaded', fullImage, 'ImageManager');
        // Simulate upload completion
        setTimeout(() => {
            fullImage.status = ProcessingStatus.Ready;
            EventBus_1.eventBus.emitSync('vision.image_ready', fullImage, 'ImageManager');
        }, 500);
        return fullImage;
    }
    /**
     * Get image
     */
    getImage(imageId) {
        return this.images.get(imageId);
    }
    /**
     * List images
     */
    listImages(filter) {
        let images = Array.from(this.images.values());
        if (filter?.format) {
            images = images.filter(i => i.format === filter.format);
        }
        if (filter?.status) {
            images = images.filter(i => i.status === filter.status);
        }
        return images.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    /**
     * Update metadata
     */
    updateMetadata(imageId, metadata) {
        const image = this.images.get(imageId);
        if (image) {
            Object.assign(image.metadata, metadata);
            EventBus_1.eventBus.emitSync('vision.metadata_updated', { imageId, metadata }, 'ImageManager');
        }
    }
    /**
     * Delete image
     */
    deleteImage(imageId) {
        this.images.delete(imageId);
        EventBus_1.eventBus.emitSync('vision.image_deleted', { imageId }, 'ImageManager');
    }
    generateImageId() {
        return `img_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.ImageManager = ImageManager;
/**
 * Object Detector
 */
class ObjectDetector {
    detections = new Map();
    imageManager;
    constructor(imageManager) {
        this.imageManager = imageManager;
    }
    /**
     * Detect objects
     */
    async detect(imageId) {
        const image = this.imageManager.getImage(imageId);
        if (!image) {
            throw new Error(`Image not found: ${imageId}`);
        }
        // Mock object detection
        await new Promise(resolve => setTimeout(resolve, 100));
        const objects = this.mockDetectObjects();
        const detection = {
            imageId,
            objects,
            detectedAt: new Date(),
        };
        this.detections.set(imageId, detection);
        EventBus_1.eventBus.emitSync('vision.objects_detected', detection, 'ObjectDetector');
        return detection;
    }
    /**
     * Get detection
     */
    getDetection(imageId) {
        return this.detections.get(imageId);
    }
    /**
     * Find objects by label
     */
    findByLabel(imageId, label) {
        const detection = this.detections.get(imageId);
        return detection ? detection.objects.filter(o => o.label === label) : [];
    }
    mockDetectObjects() {
        const labels = ['person', 'car', 'tree', 'building', 'dog', 'cat'];
        return labels.slice(0, Math.floor(Math.random() * 4) + 1).map(label => ({
            label,
            confidence: 0.7 + Math.random() * 0.3,
            boundingBox: {
                x: Math.random() * 500,
                y: Math.random() * 500,
                width: 50 + Math.random() * 200,
                height: 50 + Math.random() * 200,
            },
        }));
    }
}
exports.ObjectDetector = ObjectDetector;
/**
 * Face Detector
 */
class FaceDetector {
    detections = new Map();
    imageManager;
    constructor(imageManager) {
        this.imageManager = imageManager;
    }
    /**
     * Detect faces
     */
    async detect(imageId) {
        const image = this.imageManager.getImage(imageId);
        if (!image) {
            throw new Error(`Image not found: ${imageId}`);
        }
        // Mock face detection
        await new Promise(resolve => setTimeout(resolve, 100));
        const faces = this.mockDetectFaces();
        const detection = {
            imageId,
            faces,
            detectedAt: new Date(),
        };
        this.detections.set(imageId, detection);
        EventBus_1.eventBus.emitSync('vision.faces_detected', detection, 'FaceDetector');
        return detection;
    }
    /**
     * Get detection
     */
    getDetection(imageId) {
        return this.detections.get(imageId);
    }
    mockDetectFaces() {
        const count = Math.floor(Math.random() * 3) + 1;
        const faces = [];
        for (let i = 0; i < count; i++) {
            faces.push({
                id: this.generateFaceId(),
                confidence: 0.85 + Math.random() * 0.15,
                boundingBox: {
                    x: Math.random() * 400,
                    y: Math.random() * 400,
                    width: 80 + Math.random() * 40,
                    height: 100 + Math.random() * 50,
                },
                landmarks: this.mockLandmarks(),
                attributes: {
                    age: 20 + Math.floor(Math.random() * 50),
                    gender: Math.random() > 0.5 ? 'male' : 'female',
                    emotion: this.randomEmotion(),
                    glasses: Math.random() > 0.7,
                    beard: Math.random() > 0.8,
                    mustache: Math.random() > 0.9,
                    smile: Math.random(),
                },
                embedding: Array.from({ length: 128 }, () => Math.random()),
            });
        }
        return faces;
    }
    mockLandmarks() {
        return [
            { type: LandmarkType.LeftEye, x: 100, y: 100 },
            { type: LandmarkType.RightEye, x: 150, y: 100 },
            { type: LandmarkType.Nose, x: 125, y: 130 },
            { type: LandmarkType.LeftMouth, x: 110, y: 160 },
            { type: LandmarkType.RightMouth, x: 140, y: 160 },
        ];
    }
    randomEmotion() {
        const emotions = Object.values(Emotion);
        return emotions[Math.floor(Math.random() * emotions.length)];
    }
    generateFaceId() {
        return `face_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.FaceDetector = FaceDetector;
/**
 * Face Recognition Manager
 */
class FaceRecognitionManager {
    persons = new Map();
    recognitions = new Map();
    faceDetector;
    constructor(faceDetector) {
        this.faceDetector = faceDetector;
    }
    /**
     * Create person
     */
    createPerson(person) {
        const fullPerson = {
            ...person,
            id: this.generatePersonId(),
            faceIds: [],
            createdAt: new Date(),
        };
        this.persons.set(fullPerson.id, fullPerson);
        EventBus_1.eventBus.emitSync('vision.person_created', fullPerson, 'FaceRecognitionManager');
        return fullPerson;
    }
    /**
     * Add face to person
     */
    addFaceToPerson(personId, faceId) {
        const person = this.persons.get(personId);
        if (person) {
            person.faceIds.push(faceId);
            EventBus_1.eventBus.emitSync('vision.face_added_to_person', { personId, faceId }, 'FaceRecognitionManager');
        }
    }
    /**
     * Recognize face
     */
    async recognize(faceId) {
        // Mock face recognition
        await new Promise(resolve => setTimeout(resolve, 50));
        // Find matching person (mock)
        const persons = Array.from(this.persons.values());
        const matchingPerson = persons.find(p => p.faceIds.includes(faceId));
        const recognition = {
            faceId,
            personId: matchingPerson?.id,
            confidence: matchingPerson ? 0.9 + Math.random() * 0.1 : 0,
            recognizedAt: new Date(),
        };
        this.recognitions.set(faceId, recognition);
        EventBus_1.eventBus.emitSync('vision.face_recognized', recognition, 'FaceRecognitionManager');
        return recognition;
    }
    /**
     * Get person
     */
    getPerson(personId) {
        return this.persons.get(personId);
    }
    /**
     * List persons
     */
    listPersons() {
        return Array.from(this.persons.values());
    }
    /**
     * Delete person
     */
    deletePerson(personId) {
        this.persons.delete(personId);
        EventBus_1.eventBus.emitSync('vision.person_deleted', { personId }, 'FaceRecognitionManager');
    }
    generatePersonId() {
        return `person_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.FaceRecognitionManager = FaceRecognitionManager;
/**
 * OCR Engine
 */
class OCREngine {
    results = new Map();
    imageManager;
    constructor(imageManager) {
        this.imageManager = imageManager;
    }
    /**
     * Extract text from image
     */
    async extractText(imageId) {
        const image = this.imageManager.getImage(imageId);
        if (!image) {
            throw new Error(`Image not found: ${imageId}`);
        }
        // Mock OCR
        await new Promise(resolve => setTimeout(resolve, 150));
        const text = 'This is sample extracted text from the image.';
        const words = this.mockExtractWords(text);
        const lines = this.mockExtractLines(words);
        const result = {
            imageId,
            text,
            words,
            lines,
            confidence: 0.92,
            extractedAt: new Date(),
        };
        this.results.set(imageId, result);
        EventBus_1.eventBus.emitSync('vision.text_extracted', result, 'OCREngine');
        return result;
    }
    /**
     * Get result
     */
    getResult(imageId) {
        return this.results.get(imageId);
    }
    mockExtractWords(text) {
        const words = text.split(/\s+/);
        let x = 10;
        return words.map(word => {
            const wordObj = {
                text: word,
                confidence: 0.9 + Math.random() * 0.1,
                boundingBox: {
                    x,
                    y: 10,
                    width: word.length * 10,
                    height: 20,
                },
            };
            x += word.length * 10 + 5;
            return wordObj;
        });
    }
    mockExtractLines(words) {
        return [
            {
                text: words.map(w => w.text).join(' '),
                words,
                boundingBox: {
                    x: 10,
                    y: 10,
                    width: words.reduce((sum, w) => sum + w.boundingBox.width, 0),
                    height: 20,
                },
            },
        ];
    }
}
exports.OCREngine = OCREngine;
/**
 * Image Classifier
 */
class ImageClassifier {
    classifications = new Map();
    imageManager;
    constructor(imageManager) {
        this.imageManager = imageManager;
    }
    /**
     * Classify image
     */
    async classify(imageId) {
        const image = this.imageManager.getImage(imageId);
        if (!image) {
            throw new Error(`Image not found: ${imageId}`);
        }
        // Mock classification
        await new Promise(resolve => setTimeout(resolve, 80));
        const labels = this.mockClassify();
        const classification = {
            imageId,
            labels,
            classifiedAt: new Date(),
        };
        this.classifications.set(imageId, classification);
        EventBus_1.eventBus.emitSync('vision.image_classified', classification, 'ImageClassifier');
        return classification;
    }
    /**
     * Get classification
     */
    getClassification(imageId) {
        return this.classifications.get(imageId);
    }
    mockClassify() {
        const categories = [
            { name: 'landscape', category: 'nature' },
            { name: 'portrait', category: 'people' },
            { name: 'urban', category: 'city' },
            { name: 'food', category: 'culinary' },
            { name: 'animal', category: 'wildlife' },
        ];
        return categories
            .map(c => ({
            ...c,
            confidence: Math.random(),
        }))
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 3);
    }
}
exports.ImageClassifier = ImageClassifier;
/**
 * Image Processor
 */
class ImageProcessor {
    transformations = new Map();
    imageManager;
    constructor(imageManager) {
        this.imageManager = imageManager;
    }
    /**
     * Transform image
     */
    async transform(imageId, operation, parameters) {
        const image = this.imageManager.getImage(imageId);
        if (!image) {
            throw new Error(`Image not found: ${imageId}`);
        }
        const transformation = {
            id: this.generateTransformationId(),
            imageId,
            operation,
            parameters,
            status: ProcessingStatus.Processing,
            createdAt: new Date(),
        };
        this.transformations.set(transformation.id, transformation);
        // Mock processing
        await new Promise(resolve => setTimeout(resolve, 100));
        transformation.status = ProcessingStatus.Ready;
        transformation.outputPath = `/processed/${imageId}_${operation}.${image.format}`;
        EventBus_1.eventBus.emitSync('vision.image_transformed', transformation, 'ImageProcessor');
        return transformation;
    }
    /**
     * Get transformation
     */
    getTransformation(transformationId) {
        return this.transformations.get(transformationId);
    }
    /**
     * List transformations
     */
    listTransformations(imageId) {
        let transformations = Array.from(this.transformations.values());
        if (imageId) {
            transformations = transformations.filter(t => t.imageId === imageId);
        }
        return transformations.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    generateTransformationId() {
        return `transform_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.ImageProcessor = ImageProcessor;
/**
 * Color Analyzer
 */
class ColorAnalyzer {
    analyses = new Map();
    imageManager;
    constructor(imageManager) {
        this.imageManager = imageManager;
    }
    /**
     * Analyze colors
     */
    async analyze(imageId) {
        const image = this.imageManager.getImage(imageId);
        if (!image) {
            throw new Error(`Image not found: ${imageId}`);
        }
        // Mock color analysis
        await new Promise(resolve => setTimeout(resolve, 60));
        const dominantColors = this.mockDominantColors();
        const palette = this.mockPalette();
        const averageColor = this.calculateAverageColor(dominantColors);
        const analysis = {
            imageId,
            dominantColors,
            palette,
            averageColor,
            analyzedAt: new Date(),
        };
        this.analyses.set(imageId, analysis);
        EventBus_1.eventBus.emitSync('vision.colors_analyzed', analysis, 'ColorAnalyzer');
        return analysis;
    }
    /**
     * Get analysis
     */
    getAnalysis(imageId) {
        return this.analyses.get(imageId);
    }
    mockDominantColors() {
        return [
            { r: 100, g: 150, b: 200, hex: '#6496c8', percentage: 45 },
            { r: 200, g: 100, b: 50, hex: '#c86432', percentage: 30 },
            { r: 50, g: 200, b: 100, hex: '#32c864', percentage: 25 },
        ];
    }
    mockPalette() {
        return Array.from({ length: 5 }, () => {
            const r = Math.floor(Math.random() * 256);
            const g = Math.floor(Math.random() * 256);
            const b = Math.floor(Math.random() * 256);
            return {
                r,
                g,
                b,
                hex: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`,
            };
        });
    }
    calculateAverageColor(colors) {
        const totalPercentage = colors.reduce((sum, c) => sum + (c.percentage || 0), 0);
        const r = Math.floor(colors.reduce((sum, c) => sum + c.r * (c.percentage || 0), 0) / totalPercentage);
        const g = Math.floor(colors.reduce((sum, c) => sum + c.g * (c.percentage || 0), 0) / totalPercentage);
        const b = Math.floor(colors.reduce((sum, c) => sum + c.b * (c.percentage || 0), 0) / totalPercentage);
        return {
            r,
            g,
            b,
            hex: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`,
        };
    }
}
exports.ColorAnalyzer = ColorAnalyzer;
/**
 * Image Quality Assessor
 */
class ImageQualityAssessor {
    scores = new Map();
    imageManager;
    constructor(imageManager) {
        this.imageManager = imageManager;
    }
    /**
     * Assess quality
     */
    async assess(imageId) {
        const image = this.imageManager.getImage(imageId);
        if (!image) {
            throw new Error(`Image not found: ${imageId}`);
        }
        // Mock quality assessment
        await new Promise(resolve => setTimeout(resolve, 70));
        const sharpness = 70 + Math.random() * 30;
        const brightness = 60 + Math.random() * 40;
        const contrast = 65 + Math.random() * 35;
        const noise = 10 + Math.random() * 20;
        const score = {
            imageId,
            overallScore: (sharpness + brightness + contrast + (100 - noise)) / 4,
            sharpness,
            brightness,
            contrast,
            noise,
            calculatedAt: new Date(),
        };
        this.scores.set(imageId, score);
        EventBus_1.eventBus.emitSync('vision.quality_assessed', score, 'ImageQualityAssessor');
        return score;
    }
    /**
     * Get score
     */
    getScore(imageId) {
        return this.scores.get(imageId);
    }
}
exports.ImageQualityAssessor = ImageQualityAssessor;
/**
 * Singleton instances
 */
exports.imageManager = new ImageManager();
exports.objectDetector = new ObjectDetector(exports.imageManager);
exports.faceDetector = new FaceDetector(exports.imageManager);
exports.faceRecognitionManager = new FaceRecognitionManager(exports.faceDetector);
exports.ocrEngine = new OCREngine(exports.imageManager);
exports.imageClassifier = new ImageClassifier(exports.imageManager);
exports.imageProcessor = new ImageProcessor(exports.imageManager);
exports.colorAnalyzer = new ColorAnalyzer(exports.imageManager);
exports.imageQualityAssessor = new ImageQualityAssessor(exports.imageManager);
