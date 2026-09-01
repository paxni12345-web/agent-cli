/**
 * ZeroTrustArchitecture - Zero Trust security implementation
 * Continuous authentication, micro-segmentation, and policy enforcement
 */
import { EventEmitter } from 'events';
export interface Identity {
    id: string;
    type: 'user' | 'service' | 'device';
    attributes: Map<string, any>;
    trustScore: number;
    lastVerified: Date;
    context: IdentityContext;
}
export interface IdentityContext {
    location: string;
    device: string;
    network: string;
    behavior: BehaviorProfile;
    riskFactors: string[];
}
export interface BehaviorProfile {
    normalPatterns: Pattern[];
    anomalies: Anomaly[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
}
export interface Pattern {
    type: string;
    frequency: number;
    lastSeen: Date;
    confidence: number;
}
export interface Anomaly {
    type: string;
    severity: number;
    detected: Date;
    description: string;
}
export interface AccessRequest {
    id: string;
    identity: string;
    resource: string;
    action: string;
    context: RequestContext;
    timestamp: Date;
}
export interface RequestContext {
    ip: string;
    userAgent: string;
    location: string;
    deviceFingerprint: string;
    previousRequests: string[];
}
export interface Policy {
    id: string;
    name: string;
    rules: PolicyRule[];
    priority: number;
    enabled: boolean;
}
export interface PolicyRule {
    condition: string;
    action: 'allow' | 'deny' | 'mfa_required' | 'review';
    reason: string;
}
export interface AuthDecision {
    allowed: boolean;
    requiresMFA: boolean;
    requiresReview: boolean;
    trustScore: number;
    reasons: string[];
    policies: string[];
}
export interface MicroSegment {
    id: string;
    name: string;
    resources: string[];
    allowedIdentities: string[];
    allowedActions: string[];
    networkPolicy: NetworkPolicy;
}
export interface NetworkPolicy {
    ingressRules: NetworkRule[];
    egressRules: NetworkRule[];
    defaultAction: 'allow' | 'deny';
}
export interface NetworkRule {
    source: string;
    destination: string;
    ports: number[];
    protocol: string;
    action: 'allow' | 'deny';
}
export declare class ZeroTrustSystem extends EventEmitter {
    private identities;
    private policies;
    private segments;
    private accessLog;
    private behaviorProfiles;
    constructor();
    /**
     * Initialize default security policies
     */
    private initializeDefaultPolicies;
    /**
     * Register identity
     */
    registerIdentity(identity: Identity): void;
    /**
     * Verify identity continuously
     */
    verifyIdentity(identityId: string, context: IdentityContext): Promise<number>;
    /**
     * Analyze behavior patterns
     */
    private analyzeBehavior;
    /**
     * Evaluate access request
     */
    evaluateAccess(request: AccessRequest): Promise<AuthDecision>;
    /**
     * Get applicable policies
     */
    private getApplicablePolicies;
    /**
     * Apply policies to access request
     */
    private applyPolicies;
    /**
     * Evaluate policy condition
     */
    private evaluateCondition;
    /**
     * Check micro-segmentation
     */
    private checkMicroSegmentation;
    /**
     * Check network policy
     */
    private checkNetworkPolicy;
    /**
     * Match network rule
     */
    private matchNetworkRule;
    /**
     * Add policy
     */
    addPolicy(policy: Policy): void;
    /**
     * Create micro-segment
     */
    createMicroSegment(segment: MicroSegment): void;
    /**
     * Get security posture
     */
    getSecurityPosture(): any;
}
export default ZeroTrustSystem;
//# sourceMappingURL=ZeroTrustArchitecture.d.ts.map