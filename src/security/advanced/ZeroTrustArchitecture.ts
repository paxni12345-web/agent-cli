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

export class ZeroTrustSystem extends EventEmitter {
  private identities: Map<string, Identity> = new Map();
  private policies: Map<string, Policy> = new Map();
  private segments: Map<string, MicroSegment> = new Map();
  private accessLog: AccessRequest[] = [];
  private behaviorProfiles: Map<string, BehaviorProfile> = new Map();

  constructor() {
    super();
    this.initializeDefaultPolicies();
  }

  /**
   * Initialize default security policies
   */
  private initializeDefaultPolicies(): void {
    this.addPolicy({
      id: 'default_deny',
      name: 'Default Deny All',
      rules: [
        {
          condition: 'true',
          action: 'deny',
          reason: 'Explicit allow required'
        }
      ],
      priority: 0,
      enabled: true
    });

    this.addPolicy({
      id: 'low_trust_mfa',
      name: 'MFA for Low Trust',
      rules: [
        {
          condition: 'identity.trustScore < 0.5',
          action: 'mfa_required',
          reason: 'Trust score below threshold'
        }
      ],
      priority: 100,
      enabled: true
    });

    this.addPolicy({
      id: 'high_risk_deny',
      name: 'Deny High Risk',
      rules: [
        {
          condition: 'context.riskLevel == "critical"',
          action: 'deny',
          reason: 'Critical risk detected'
        }
      ],
      priority: 200,
      enabled: true
    });
  }

  /**
   * Register identity
   */
  public registerIdentity(identity: Identity): void {
    this.identities.set(identity.id, identity);
    this.behaviorProfiles.set(identity.id, {
      normalPatterns: [],
      anomalies: [],
      riskLevel: 'low'
    });
    this.emit('identity:registered', identity);
  }

  /**
   * Verify identity continuously
   */
  public async verifyIdentity(identityId: string, context: IdentityContext): Promise<number> {
    const identity = this.identities.get(identityId);
    if (!identity) {
      throw new Error(`Identity ${identityId} not found`);
    }

    // Multi-factor verification
    let trustScore = 0.5; // Base score

    // Verify location
    if (context.location === identity.context.location) {
      trustScore += 0.1;
    } else {
      trustScore -= 0.2;
    }

    // Verify device
    if (context.device === identity.context.device) {
      trustScore += 0.15;
    } else {
      trustScore -= 0.15;
    }

    // Verify network
    if (context.network === identity.context.network) {
      trustScore += 0.1;
    }

    // Check behavior
    const behaviorScore = await this.analyzeBehavior(identityId, context);
    trustScore += behaviorScore * 0.25;

    // Normalize score
    trustScore = Math.max(0, Math.min(1, trustScore));

    identity.trustScore = trustScore;
    identity.lastVerified = new Date();
    identity.context = context;

    this.emit('identity:verified', { identityId, trustScore, context });
    return trustScore;
  }

  /**
   * Analyze behavior patterns
   */
  private async analyzeBehavior(identityId: string, context: IdentityContext): Promise<number> {
    const profile = this.behaviorProfiles.get(identityId);
    if (!profile) return 0;

    // Get recent access patterns
    const recentAccess = this.accessLog
      .filter(req => req.identity === identityId)
      .slice(-100);

    // Check for anomalies
    const anomalies: Anomaly[] = [];

    // Unusual time pattern
    const currentHour = new Date().getHours();
    const usualHours = recentAccess.map(req => req.timestamp.getHours());
    const isUnusualTime = usualHours.length > 0 &&
      !usualHours.some(h => Math.abs(h - currentHour) < 2);

    if (isUnusualTime) {
      anomalies.push({
        type: 'unusual_time',
        severity: 0.3,
        detected: new Date(),
        description: 'Access at unusual time'
      });
    }

    // Rapid requests
    const recentMinute = recentAccess.filter(req =>
      Date.now() - req.timestamp.getTime() < 60000
    );

    if (recentMinute.length > 50) {
      anomalies.push({
        type: 'rapid_requests',
        severity: 0.5,
        detected: new Date(),
        description: 'Unusually high request rate'
      });
    }

    // Location change
    const lastLocation = recentAccess[recentAccess.length - 1]?.context.location;
    if (lastLocation && lastLocation !== context.location) {
      anomalies.push({
        type: 'location_change',
        severity: 0.4,
        detected: new Date(),
        description: 'Location changed'
      });
    }

    profile.anomalies = anomalies;

    // Calculate behavior score
    const anomalyScore = anomalies.reduce((sum, a) => sum + a.severity, 0);
    return Math.max(0, 1 - anomalyScore);
  }

  /**
   * Evaluate access request
   */
  public async evaluateAccess(request: AccessRequest): Promise<AuthDecision> {
    const identity = this.identities.get(request.identity);
    if (!identity) {
      return {
        allowed: false,
        requiresMFA: false,
        requiresReview: false,
        trustScore: 0,
        reasons: ['Unknown identity'],
        policies: []
      };
    }

    // Verify identity continuously
    const trustScore = await this.verifyIdentity(request.identity, {
      location: request.context.ip,
      device: request.context.deviceFingerprint,
      network: request.context.ip.split('.')[0],
      behavior: this.behaviorProfiles.get(request.identity)!,
      riskFactors: []
    });

    // Evaluate policies
    const applicablePolicies = this.getApplicablePolicies(request, identity);
    const decision = this.applyPolicies(applicablePolicies, request, identity);

    // Check micro-segmentation
    const segmentAllowed = this.checkMicroSegmentation(request, identity);
    if (!segmentAllowed) {
      decision.allowed = false;
      decision.reasons.push('Micro-segmentation policy violation');
    }

    // Log access request
    this.accessLog.push(request);
    if (this.accessLog.length > 10000) {
      this.accessLog.shift();
    }

    decision.trustScore = trustScore;
    this.emit('access:evaluated', { request, decision });

    return decision;
  }

  /**
   * Get applicable policies
   */
  private getApplicablePolicies(request: AccessRequest, identity: Identity): Policy[] {
    return Array.from(this.policies.values())
      .filter(p => p.enabled)
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Apply policies to access request
   */
  private applyPolicies(
    policies: Policy[],
    request: AccessRequest,
    identity: Identity
  ): AuthDecision {
    const decision: AuthDecision = {
      allowed: false,
      requiresMFA: false,
      requiresReview: false,
      trustScore: identity.trustScore,
      reasons: [],
      policies: []
    };

    for (const policy of policies) {
      for (const rule of policy.rules) {
        if (this.evaluateCondition(rule.condition, request, identity)) {
          decision.policies.push(policy.id);
          decision.reasons.push(rule.reason);

          switch (rule.action) {
            case 'allow':
              decision.allowed = true;
              break;
            case 'deny':
              decision.allowed = false;
              return decision; // Deny takes precedence
            case 'mfa_required':
              decision.requiresMFA = true;
              break;
            case 'review':
              decision.requiresReview = true;
              break;
          }
        }
      }
    }

    return decision;
  }

  /**
   * Evaluate policy condition
   */
  private evaluateCondition(
    condition: string,
    request: AccessRequest,
    identity: Identity
  ): boolean {
    try {
      // Simple condition evaluation
      if (condition === 'true') return true;
      if (condition === 'false') return false;

      // Trust score conditions
      if (condition.includes('identity.trustScore')) {
        const match = condition.match(/identity\.trustScore\s*([<>=]+)\s*([\d.]+)/);
        if (match) {
          const operator = match[1];
          const threshold = parseFloat(match[2]);
          const score = identity.trustScore;

          switch (operator) {
            case '<': return score < threshold;
            case '>': return score > threshold;
            case '<=': return score <= threshold;
            case '>=': return score >= threshold;
            case '==': return score === threshold;
          }
        }
      }

      // Risk level conditions
      if (condition.includes('context.riskLevel')) {
        const match = condition.match(/context\.riskLevel\s*==\s*"([^"]+)"/);
        if (match) {
          const expectedLevel = match[1];
          return identity.context.behavior.riskLevel === expectedLevel;
        }
      }

      return false;
    } catch (error) {
      this.emit('policy:error', { condition, error });
      return false;
    }
  }

  /**
   * Check micro-segmentation
   */
  private checkMicroSegmentation(request: AccessRequest, identity: Identity): boolean {
    // Find segments containing the resource
    const segments = Array.from(this.segments.values())
      .filter(s => s.resources.includes(request.resource));

    if (segments.length === 0) {
      // No segments defined, apply default policy
      return false;
    }

    // Check if identity is allowed in any segment
    for (const segment of segments) {
      if (segment.allowedIdentities.includes(identity.id) &&
          segment.allowedActions.includes(request.action)) {

        // Check network policy
        if (this.checkNetworkPolicy(segment.networkPolicy, request)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check network policy
   */
  private checkNetworkPolicy(policy: NetworkPolicy, request: AccessRequest): boolean {
    // Check ingress rules
    for (const rule of policy.ingressRules) {
      if (this.matchNetworkRule(rule, request.context.ip)) {
        return rule.action === 'allow';
      }
    }

    return policy.defaultAction === 'allow';
  }

  /**
   * Match network rule
   */
  private matchNetworkRule(rule: NetworkRule, ip: string): boolean {
    // Simple IP matching (could be enhanced with CIDR)
    return rule.source === ip || rule.source === '*';
  }

  /**
   * Add policy
   */
  public addPolicy(policy: Policy): void {
    this.policies.set(policy.id, policy);
    this.emit('policy:added', policy);
  }

  /**
   * Create micro-segment
   */
  public createMicroSegment(segment: MicroSegment): void {
    this.segments.set(segment.id, segment);
    this.emit('segment:created', segment);
  }

  /**
   * Get security posture
   */
  public getSecurityPosture(): any {
    const identities = Array.from(this.identities.values());

    return {
      totalIdentities: identities.length,
      avgTrustScore: identities.reduce((sum, i) => sum + i.trustScore, 0) / identities.length,
      highRiskIdentities: identities.filter(i => i.trustScore < 0.3).length,
      activePolicies: Array.from(this.policies.values()).filter(p => p.enabled).length,
      segments: this.segments.size,
      recentAccess: this.accessLog.slice(-100).length,
      anomaliesDetected: Array.from(this.behaviorProfiles.values())
        .reduce((sum, p) => sum + p.anomalies.length, 0)
    };
  }
}

export default ZeroTrustSystem;
