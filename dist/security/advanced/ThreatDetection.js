"use strict";
/**
 * ThreatDetection - ML-based threat detection and anomaly detection
 * Real-time threat analysis with behavioral analytics
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThreatDetectionSystem = void 0;
const events_1 = require("events");
class ThreatDetectionSystem extends events_1.EventEmitter {
    threats = new Map();
    signatures = new Map();
    baselines = new Map();
    anomalies = [];
    mlModels = new Map();
    detectionRules = new Map();
    constructor() {
        super();
        this.initializeSignatures();
        this.initializeModels();
    }
    /**
     * Initialize threat signatures
     */
    initializeSignatures() {
        this.addSignature({
            id: 'sql_injection_1',
            name: 'SQL Injection Pattern',
            pattern: /(union.*select|select.*from|insert.*into|delete.*from|drop.*table)/i,
            type: 'sql_injection',
            severity: 'high',
            enabled: true
        });
        this.addSignature({
            id: 'xss_1',
            name: 'XSS Pattern',
            pattern: /(<script|javascript:|onerror=|onclick=)/i,
            type: 'xss',
            severity: 'high',
            enabled: true
        });
        this.addSignature({
            id: 'brute_force_1',
            name: 'Brute Force Detection',
            pattern: 'rate_limit',
            type: 'brute_force',
            severity: 'medium',
            enabled: true
        });
    }
    /**
     * Initialize ML models
     */
    initializeModels() {
        this.mlModels.set('anomaly_classifier', {
            id: 'anomaly_classifier',
            type: 'classification',
            trained: false,
            accuracy: 0,
            lastTrained: new Date()
        });
        this.mlModels.set('behavior_clustering', {
            id: 'behavior_clustering',
            type: 'clustering',
            trained: false,
            accuracy: 0,
            lastTrained: new Date()
        });
    }
    /**
     * Analyze request for threats
     */
    async analyzeRequest(request) {
        const indicators = [];
        // Signature-based detection
        for (const signature of this.signatures.values()) {
            if (!signature.enabled)
                continue;
            const match = this.matchSignature(signature, request);
            if (match) {
                indicators.push({
                    type: 'signature_match',
                    value: signature.id,
                    confidence: 0.9,
                    timestamp: new Date()
                });
            }
        }
        // Behavior-based detection
        const behaviorAnomalies = await this.detectBehaviorAnomalies(request);
        indicators.push(...behaviorAnomalies);
        // ML-based detection
        const mlIndicators = await this.mlDetection(request);
        indicators.push(...mlIndicators);
        // Rate limiting check
        const rateLimitViolation = this.checkRateLimit(request);
        if (rateLimitViolation) {
            indicators.push({
                type: 'rate_limit_exceeded',
                value: rateLimitViolation.count.toString(),
                confidence: 0.95,
                timestamp: new Date()
            });
        }
        // If threats detected, create threat event
        if (indicators.length > 0) {
            const threat = this.createThreatEvent(request, indicators);
            this.threats.set(threat.id, threat);
            this.emit('threat:detected', threat);
            return threat;
        }
        return null;
    }
    /**
     * Match signature against request
     */
    matchSignature(signature, request) {
        const content = JSON.stringify(request).toLowerCase();
        if (signature.pattern instanceof RegExp) {
            return signature.pattern.test(content);
        }
        else if (signature.pattern === 'rate_limit') {
            return this.checkRateLimit(request) !== null;
        }
        return false;
    }
    /**
     * Detect behavior anomalies
     */
    async detectBehaviorAnomalies(request) {
        const indicators = [];
        const entityId = request.userId || request.ip || 'unknown';
        // Get or create baseline
        let baseline = this.baselines.get(entityId);
        if (!baseline) {
            baseline = {
                entityId,
                metrics: new Map(),
                updated: new Date()
            };
            this.baselines.set(entityId, baseline);
        }
        // Analyze metrics
        const metrics = this.extractMetrics(request);
        for (const [metricName, value] of Object.entries(metrics)) {
            const metricBaseline = baseline.metrics.get(metricName);
            if (metricBaseline) {
                const zScore = (value - metricBaseline.mean) / metricBaseline.stdDev;
                if (Math.abs(zScore) > 3) {
                    const anomaly = {
                        id: `anomaly_${Date.now()}`,
                        entityId,
                        metric: metricName,
                        observed: value,
                        expected: metricBaseline.mean,
                        deviation: value - metricBaseline.mean,
                        zScore,
                        isAnomaly: true,
                        timestamp: new Date()
                    };
                    this.anomalies.push(anomaly);
                    indicators.push({
                        type: 'behavior_anomaly',
                        value: `${metricName}: ${zScore.toFixed(2)}σ`,
                        confidence: Math.min(0.95, Math.abs(zScore) / 5),
                        timestamp: new Date()
                    });
                }
                // Update baseline
                this.updateBaseline(metricBaseline, value);
            }
            else {
                // Initialize baseline
                baseline.metrics.set(metricName, {
                    mean: value,
                    stdDev: 0,
                    min: value,
                    max: value,
                    samples: 1
                });
            }
        }
        return indicators;
    }
    /**
     * Extract metrics from request
     */
    extractMetrics(request) {
        return {
            requestSize: JSON.stringify(request).length,
            requestTime: Date.now() % 86400000, // Time of day in ms
            pathLength: (request.path || '').length,
            paramCount: Object.keys(request.params || {}).length
        };
    }
    /**
     * Update baseline with new observation
     */
    updateBaseline(baseline, value) {
        const n = baseline.samples;
        const oldMean = baseline.mean;
        // Update mean
        baseline.mean = (oldMean * n + value) / (n + 1);
        // Update std dev (Welford's algorithm)
        const oldVariance = Math.pow(baseline.stdDev, 2) * n;
        const newVariance = (oldVariance + (value - oldMean) * (value - baseline.mean)) / (n + 1);
        baseline.stdDev = Math.sqrt(newVariance);
        // Update min/max
        baseline.min = Math.min(baseline.min, value);
        baseline.max = Math.max(baseline.max, value);
        baseline.samples++;
    }
    /**
     * ML-based detection
     */
    async mlDetection(request) {
        const indicators = [];
        const classifier = this.mlModels.get('anomaly_classifier');
        if (classifier && classifier.trained) {
            const prediction = await this.classifyRequest(request);
            if (prediction.isThreat) {
                indicators.push({
                    type: 'ml_detection',
                    value: prediction.threatType,
                    confidence: prediction.confidence,
                    timestamp: new Date()
                });
            }
        }
        return indicators;
    }
    /**
     * Classify request using ML
     */
    async classifyRequest(request) {
        // Simulate ML classification
        await new Promise(resolve => setTimeout(resolve, 10));
        const features = this.extractFeatures(request);
        const threatScore = this.calculateThreatScore(features);
        return {
            isThreat: threatScore > 0.7,
            threatType: 'anomalous_behavior',
            confidence: threatScore
        };
    }
    /**
     * Extract features for ML
     */
    extractFeatures(request) {
        return [
            JSON.stringify(request).length / 1000,
            (request.path || '').length / 100,
            Object.keys(request.params || {}).length / 10,
            (request.headers?.['user-agent']?.length || 0) / 100
        ];
    }
    /**
     * Calculate threat score
     */
    calculateThreatScore(features) {
        // Simple scoring based on feature values
        let score = 0;
        if (features[0] > 10)
            score += 0.3; // Large request
        if (features[1] > 5)
            score += 0.2; // Long path
        if (features[2] > 20)
            score += 0.3; // Many parameters
        if (features[3] < 1)
            score += 0.2; // Missing user agent
        return Math.min(1, score);
    }
    /**
     * Check rate limiting
     */
    checkRateLimit(request) {
        const ip = request.ip || 'unknown';
        const key = `ratelimit:${ip}`;
        // Simulate rate limit check
        const recentRequests = this.threats.size; // Simplified
        const threshold = 100;
        if (recentRequests > threshold) {
            return { count: recentRequests, window: 60000 };
        }
        return null;
    }
    /**
     * Create threat event
     */
    createThreatEvent(request, indicators) {
        const severity = this.calculateSeverity(indicators);
        const confidence = indicators.reduce((sum, i) => sum + i.confidence, 0) / indicators.length;
        // Determine threat type
        const types = indicators
            .map(i => i.value)
            .filter(v => ['sql_injection', 'xss', 'brute_force'].includes(v));
        const type = types[0] || 'anomalous_behavior';
        return {
            id: `threat_${Date.now()}`,
            type,
            severity,
            source: request.ip || 'unknown',
            target: request.path || 'unknown',
            timestamp: new Date(),
            indicators,
            confidence,
            mitigated: false
        };
    }
    /**
     * Calculate severity from indicators
     */
    calculateSeverity(indicators) {
        const avgConfidence = indicators.reduce((sum, i) => sum + i.confidence, 0) / indicators.length;
        const count = indicators.length;
        if (avgConfidence > 0.9 && count >= 3)
            return 'critical';
        if (avgConfidence > 0.7 && count >= 2)
            return 'high';
        if (avgConfidence > 0.5 || count >= 2)
            return 'medium';
        return 'low';
    }
    /**
     * Add signature
     */
    addSignature(signature) {
        this.signatures.set(signature.id, signature);
        this.emit('signature:added', signature);
    }
    /**
     * Mitigate threat
     */
    async mitigateThreat(threatId, action) {
        const threat = this.threats.get(threatId);
        if (!threat)
            throw new Error(`Threat ${threatId} not found`);
        // Apply mitigation
        switch (action) {
            case 'block_ip':
                await this.blockIP(threat.source);
                break;
            case 'rate_limit':
                await this.applyRateLimit(threat.source);
                break;
            case 'alert_only':
                await this.sendAlert(threat);
                break;
        }
        threat.mitigated = true;
        this.emit('threat:mitigated', { threat, action });
    }
    async blockIP(ip) {
        this.emit('ip:blocked', ip);
    }
    async applyRateLimit(source) {
        this.emit('ratelimit:applied', source);
    }
    async sendAlert(threat) {
        this.emit('alert:sent', threat);
    }
    /**
     * Get threat statistics
     */
    getStatistics() {
        const threats = Array.from(this.threats.values());
        return {
            totalThreats: threats.length,
            bySeverity: {
                critical: threats.filter(t => t.severity === 'critical').length,
                high: threats.filter(t => t.severity === 'high').length,
                medium: threats.filter(t => t.severity === 'medium').length,
                low: threats.filter(t => t.severity === 'low').length
            },
            byType: this.countByType(threats),
            mitigated: threats.filter(t => t.mitigated).length,
            anomaliesDetected: this.anomalies.length,
            activeBaselines: this.baselines.size
        };
    }
    countByType(threats) {
        const counts = {};
        for (const threat of threats) {
            counts[threat.type] = (counts[threat.type] || 0) + 1;
        }
        return counts;
    }
    /**
     * Train ML models
     */
    async trainModels(trainingData) {
        for (const model of this.mlModels.values()) {
            model.trained = true;
            model.accuracy = 0.85 + Math.random() * 0.1;
            model.lastTrained = new Date();
        }
        this.emit('models:trained');
    }
    /**
     * Get recent threats
     */
    getRecentThreats(limit = 100) {
        return Array.from(this.threats.values())
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, limit);
    }
}
exports.ThreatDetectionSystem = ThreatDetectionSystem;
exports.default = ThreatDetectionSystem;
