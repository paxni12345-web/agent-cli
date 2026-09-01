/**
 * ThreatDetection - ML-based threat detection and anomaly detection
 * Real-time threat analysis with behavioral analytics
 */
import { EventEmitter } from 'events';
export interface ThreatEvent {
    id: string;
    type: ThreatType;
    severity: 'low' | 'medium' | 'high' | 'critical';
    source: string;
    target: string;
    timestamp: Date;
    indicators: Indicator[];
    confidence: number;
    mitigated: boolean;
}
export type ThreatType = 'brute_force' | 'sql_injection' | 'xss' | 'ddos' | 'malware' | 'data_exfiltration' | 'privilege_escalation' | 'unauthorized_access' | 'anomalous_behavior';
export interface Indicator {
    type: string;
    value: string;
    confidence: number;
    timestamp: Date;
}
export interface BehaviorBaseline {
    entityId: string;
    metrics: Map<string, MetricBaseline>;
    updated: Date;
}
export interface MetricBaseline {
    mean: number;
    stdDev: number;
    min: number;
    max: number;
    samples: number;
}
export interface AnomalyDetection {
    id: string;
    entityId: string;
    metric: string;
    observed: number;
    expected: number;
    deviation: number;
    zScore: number;
    isAnomaly: boolean;
    timestamp: Date;
}
export interface ThreatSignature {
    id: string;
    name: string;
    pattern: RegExp | string;
    type: ThreatType;
    severity: 'low' | 'medium' | 'high' | 'critical';
    enabled: boolean;
}
export interface MLModel {
    id: string;
    type: 'classification' | 'clustering' | 'timeseries';
    trained: boolean;
    accuracy: number;
    lastTrained: Date;
}
export declare class ThreatDetectionSystem extends EventEmitter {
    private threats;
    private signatures;
    private baselines;
    private anomalies;
    private mlModels;
    private detectionRules;
    constructor();
    /**
     * Initialize threat signatures
     */
    private initializeSignatures;
    /**
     * Initialize ML models
     */
    private initializeModels;
    /**
     * Analyze request for threats
     */
    analyzeRequest(request: any): Promise<ThreatEvent | null>;
    /**
     * Match signature against request
     */
    private matchSignature;
    /**
     * Detect behavior anomalies
     */
    private detectBehaviorAnomalies;
    /**
     * Extract metrics from request
     */
    private extractMetrics;
    /**
     * Update baseline with new observation
     */
    private updateBaseline;
    /**
     * ML-based detection
     */
    private mlDetection;
    /**
     * Classify request using ML
     */
    private classifyRequest;
    /**
     * Extract features for ML
     */
    private extractFeatures;
    /**
     * Calculate threat score
     */
    private calculateThreatScore;
    /**
     * Check rate limiting
     */
    private checkRateLimit;
    /**
     * Create threat event
     */
    private createThreatEvent;
    /**
     * Calculate severity from indicators
     */
    private calculateSeverity;
    /**
     * Add signature
     */
    addSignature(signature: ThreatSignature): void;
    /**
     * Mitigate threat
     */
    mitigateThreat(threatId: string, action: string): Promise<void>;
    private blockIP;
    private applyRateLimit;
    private sendAlert;
    /**
     * Get threat statistics
     */
    getStatistics(): any;
    private countByType;
    /**
     * Train ML models
     */
    trainModels(trainingData: any[]): Promise<void>;
    /**
     * Get recent threats
     */
    getRecentThreats(limit?: number): ThreatEvent[];
}
export default ThreatDetectionSystem;
//# sourceMappingURL=ThreatDetection.d.ts.map