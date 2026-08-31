/**
 * Self-Reflection and Meta-Cognitive System
 * Performance monitoring, confidence calibration, self-critique
 * Uncertainty quantification, meta-reasoning
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface PerformanceMetrics {
  taskId: string;
  taskType: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  accuracy?: number;
  efficiency?: number;
  resourceUsage: ResourceUsage;
  errors: ErrorRecord[];
  warnings: string[];
}

export interface ResourceUsage {
  cpuTime: number;
  memoryPeak: number;
  memoryAverage: number;
  apiCalls: number;
  tokensUsed: number;
  cost: number;
}

export interface ErrorRecord {
  type: string;
  message: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context: Record<string, any>;
  recovered: boolean;
}

export interface ConfidenceAssessment {
  taskId: string;
  initialConfidence: number;
  finalConfidence: number;
  calibrationScore: number; // How well confidence matched actual performance
  overconfidence: number;
  underconfidence: number;
  factors: ConfidenceFactor[];
}

export interface ConfidenceFactor {
  factor: string;
  weight: number;
  value: number;
  description: string;
}

export interface UncertaintyEstimate {
  type: 'epistemic' | 'aleatoric' | 'model' | 'data';
  value: number; // 0-1
  source: string;
  reducible: boolean;
  mitigation: string[];
}

export interface SelfCritique {
  taskId: string;
  timestamp: number;
  strengths: string[];
  weaknesses: string[];
  improvements: Improvement[];
  alternatives: Alternative[];
  lessonsLearned: Lesson[];
}

export interface Improvement {
  area: string;
  current: string;
  suggested: string;
  priority: 'low' | 'medium' | 'high';
  effort: 'small' | 'medium' | 'large';
  impact: number; // 0-1
}

export interface Alternative {
  description: string;
  advantages: string[];
  disadvantages: string[];
  feasibility: number; // 0-1
  estimatedPerformance: number; // 0-1
}

export interface Lesson {
  id: string;
  category: string;
  content: string;
  context: string;
  importance: number; // 0-1
  applicability: string[];
  verified: boolean;
}

export interface MetaReasoningState {
  currentStrategy: string;
  strategyEffectiveness: number;
  alternativeStrategies: string[];
  shouldSwitch: boolean;
  reasoning: string;
}

export interface ContinuousImprovement {
  dimension: string;
  baseline: number;
  current: number;
  target: number;
  trend: 'improving' | 'stable' | 'declining';
  actions: ImprovementAction[];
}

export interface ImprovementAction {
  id: string;
  description: string;
  implemented: boolean;
  impact: number;
  cost: number;
  timestamp: number;
}

export interface ReflectionReport {
  id: string;
  timestamp: number;
  period: { start: number; end: number };
  performance: PerformanceSummary;
  calibration: CalibrationSummary;
  critiques: SelfCritique[];
  improvements: ContinuousImprovement[];
  recommendations: Recommendation[];
}

export interface PerformanceSummary {
  tasksCompleted: number;
  successRate: number;
  averageAccuracy: number;
  averageDuration: number;
  resourceEfficiency: number;
  errorRate: number;
}

export interface CalibrationSummary {
  overallCalibration: number;
  overconfidenceRate: number;
  underconfidenceRate: number;
  calibrationTrend: 'improving' | 'stable' | 'declining';
}

export interface Recommendation {
  id: string;
  type: 'strategy' | 'parameter' | 'process' | 'training';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  rationale: string;
  expectedImprovement: number;
  effort: 'small' | 'medium' | 'large';
}

// ============================================================================
// Self-Reflection System
// ============================================================================

export class SelfReflectionSystem extends EventEmitter {
  private performanceHistory: PerformanceMetrics[] = [];
  private confidenceHistory: ConfidenceAssessment[] = [];
  private critiques: SelfCritique[] = [];
  private lessons: Map<string, Lesson> = new Map();
  private improvements: Map<string, ContinuousImprovement> = new Map();
  private metaState: MetaReasoningState;
  private config: ReflectionConfig;

  constructor(config: Partial<ReflectionConfig> = {}) {
    super();
    this.config = {
      enablePerformanceMonitoring: true,
      enableConfidenceCalibration: true,
      enableSelfCritique: true,
      enableMetaReasoning: true,
      reflectionInterval: 60000, // 1 minute
      critiqueThreshold: 0.7,
      improvementThreshold: 0.05,
      ...config,
    };

    this.metaState = {
      currentStrategy: 'default',
      strategyEffectiveness: 0.5,
      alternativeStrategies: ['aggressive', 'conservative', 'exploratory'],
      shouldSwitch: false,
      reasoning: 'Initial state',
    };

    this.startReflectionLoop();
  }

  // ========================================================================
  // Performance Monitoring
  // ========================================================================

  public recordPerformance(metrics: PerformanceMetrics): void {
    this.performanceHistory.push(metrics);
    this.emit('performance:recorded', { metrics });

    // Analyze performance
    const analysis = this.analyzePerformance(metrics);
    this.emit('performance:analyzed', { analysis });

    // Check if reflection needed
    if (this.shouldTriggerReflection()) {
      this.performReflection().catch(err =>
        this.emit('reflection:error', { error: err })
      );
    }
  }

  private analyzePerformance(metrics: PerformanceMetrics): PerformanceAnalysis {
    const recentMetrics = this.getRecentMetrics(10);
    const avgDuration = this.calculateAverage(recentMetrics.map(m => m.duration));
    const avgAccuracy = this.calculateAverage(
      recentMetrics.map(m => m.accuracy || 0).filter(a => a > 0)
    );

    const analysis: PerformanceAnalysis = {
      current: metrics,
      relativeSpeed: avgDuration > 0 ? metrics.duration / avgDuration : 1,
      relativeAccuracy: avgAccuracy > 0 ? (metrics.accuracy || 0) / avgAccuracy : 1,
      trend: this.detectTrend(recentMetrics),
      anomalies: this.detectAnomalies(metrics, recentMetrics),
    };

    return analysis;
  }

  private detectTrend(metrics: PerformanceMetrics[]): 'improving' | 'stable' | 'declining' {
    if (metrics.length < 3) return 'stable';

    const recentSuccess = metrics.slice(-3).filter(m => m.success).length / 3;
    const olderSuccess = metrics.slice(-6, -3).filter(m => m.success).length / 3;

    if (recentSuccess > olderSuccess + 0.1) return 'improving';
    if (recentSuccess < olderSuccess - 0.1) return 'declining';
    return 'stable';
  }

  private detectAnomalies(
    current: PerformanceMetrics,
    history: PerformanceMetrics[]
  ): string[] {
    const anomalies: string[] = [];

    const avgDuration = this.calculateAverage(history.map(m => m.duration));
    const stdDuration = this.calculateStdDev(history.map(m => m.duration));

    if (current.duration > avgDuration + 2 * stdDuration) {
      anomalies.push('Unusually slow execution');
    }

    if (current.resourceUsage.memoryPeak > avgDuration * 2) {
      anomalies.push('High memory usage');
    }

    if (current.errors.length > 3) {
      anomalies.push('Multiple errors occurred');
    }

    return anomalies;
  }

  // ========================================================================
  // Confidence Calibration
  // ========================================================================

  public calibrateConfidence(
    taskId: string,
    initialConfidence: number,
    actualSuccess: boolean,
    actualAccuracy?: number
  ): ConfidenceAssessment {
    const finalConfidence = actualSuccess ? (actualAccuracy || 1.0) : 0.0;
    const calibrationScore = 1 - Math.abs(initialConfidence - finalConfidence);

    const assessment: ConfidenceAssessment = {
      taskId,
      initialConfidence,
      finalConfidence,
      calibrationScore,
      overconfidence: Math.max(0, initialConfidence - finalConfidence),
      underconfidence: Math.max(0, finalConfidence - initialConfidence),
      factors: this.identifyConfidenceFactors(taskId, initialConfidence, finalConfidence),
    };

    this.confidenceHistory.push(assessment);
    this.emit('confidence:calibrated', { assessment });

    return assessment;
  }

  private identifyConfidenceFactors(
    taskId: string,
    initial: number,
    final: number
  ): ConfidenceFactor[] {
    const factors: ConfidenceFactor[] = [];

    // Task complexity
    factors.push({
      factor: 'task_complexity',
      weight: 0.3,
      value: this.estimateTaskComplexity(taskId),
      description: 'Estimated task complexity',
    });

    // Prior experience
    factors.push({
      factor: 'prior_experience',
      weight: 0.25,
      value: this.assessPriorExperience(taskId),
      description: 'Experience with similar tasks',
    });

    // Resource availability
    factors.push({
      factor: 'resource_availability',
      weight: 0.2,
      value: this.assessResourceAvailability(),
      description: 'Available computational resources',
    });

    // Context quality
    factors.push({
      factor: 'context_quality',
      weight: 0.15,
      value: this.assessContextQuality(taskId),
      description: 'Quality of available context',
    });

    // Time pressure
    factors.push({
      factor: 'time_pressure',
      weight: 0.1,
      value: this.assessTimePressure(taskId),
      description: 'Time constraints on task',
    });

    return factors;
  }

  private estimateTaskComplexity(taskId: string): number {
    // Simplified complexity estimation
    return 0.5;
  }

  private assessPriorExperience(taskId: string): number {
    const similarTasks = this.performanceHistory.filter(m =>
      m.taskType === taskId.split('-')[0]
    );
    return Math.min(1.0, similarTasks.length / 10);
  }

  private assessResourceAvailability(): number {
    // Check current resource usage
    if (this.performanceHistory.length === 0) return 1.0;

    const recent = this.performanceHistory[this.performanceHistory.length - 1];
    const memoryUtilization = recent.resourceUsage.memoryAverage / 1024 / 1024 / 1024; // GB
    return Math.max(0, 1 - memoryUtilization / 8); // Assume 8GB available
  }

  private assessContextQuality(taskId: string): number {
    // Simplified: return moderate quality
    return 0.7;
  }

  private assessTimePressure(taskId: string): number {
    // Simplified: no time pressure
    return 0.9;
  }

  // ========================================================================
  // Uncertainty Quantification
  // ========================================================================

  public quantifyUncertainty(
    taskId: string,
    context: Record<string, any>
  ): UncertaintyEstimate[] {
    const estimates: UncertaintyEstimate[] = [];

    // Epistemic uncertainty (lack of knowledge)
    estimates.push({
      type: 'epistemic',
      value: this.estimateEpistemicUncertainty(taskId, context),
      source: 'Knowledge gaps',
      reducible: true,
      mitigation: ['Gather more information', 'Consult experts', 'Research'],
    });

    // Aleatoric uncertainty (inherent randomness)
    estimates.push({
      type: 'aleatoric',
      value: this.estimateAleatoricUncertainty(taskId, context),
      source: 'Inherent variability',
      reducible: false,
      mitigation: ['Multiple attempts', 'Statistical methods', 'Probabilistic reasoning'],
    });

    // Model uncertainty
    estimates.push({
      type: 'model',
      value: this.estimateModelUncertainty(taskId),
      source: 'Model limitations',
      reducible: true,
      mitigation: ['Use ensemble', 'Improve model', 'Validate predictions'],
    });

    // Data uncertainty
    estimates.push({
      type: 'data',
      value: this.estimateDataUncertainty(context),
      source: 'Data quality issues',
      reducible: true,
      mitigation: ['Validate data', 'Clean data', 'Collect more samples'],
    });

    this.emit('uncertainty:quantified', { taskId, estimates });

    return estimates;
  }

  private estimateEpistemicUncertainty(taskId: string, context: Record<string, any>): number {
    // Check how much we know about this task
    const knowledgeGaps = this.identifyKnowledgeGaps(taskId, context);
    return knowledgeGaps / 10; // Assume max 10 knowledge gaps
  }

  private estimateAleatoricUncertainty(taskId: string, context: Record<string, any>): number {
    // Estimate inherent randomness
    return 0.1; // Low inherent randomness for most tasks
  }

  private estimateModelUncertainty(taskId: string): number {
    // Based on model confidence and calibration
    const recentCalibration = this.confidenceHistory.slice(-10);
    if (recentCalibration.length === 0) return 0.5;

    const avgCalibration = this.calculateAverage(
      recentCalibration.map(c => c.calibrationScore)
    );
    return 1 - avgCalibration;
  }

  private estimateDataUncertainty(context: Record<string, any>): number {
    // Check data quality indicators
    const dataSize = Object.keys(context).length;
    const completeness = dataSize > 5 ? 0.9 : dataSize / 5;
    return 1 - completeness;
  }

  private identifyKnowledgeGaps(taskId: string, context: Record<string, any>): number {
    // Count missing or uncertain information
    let gaps = 0;
    const requiredKeys = ['goal', 'constraints', 'resources', 'context'];
    for (const key of requiredKeys) {
      if (!(key in context)) gaps++;
    }
    return gaps;
  }

  // ========================================================================
  // Self-Critique
  // ========================================================================

  public async critique(
    taskId: string,
    outcome: any,
    expectedOutcome: any
  ): Promise<SelfCritique> {
    this.emit('critique:start', { taskId });

    const critique: SelfCritique = {
      taskId,
      timestamp: Date.now(),
      strengths: await this.identifyStrengths(taskId, outcome),
      weaknesses: await this.identifyWeaknesses(taskId, outcome, expectedOutcome),
      improvements: await this.suggestImprovements(taskId, outcome, expectedOutcome),
      alternatives: await this.generateAlternatives(taskId, outcome),
      lessonsLearned: await this.extractLessons(taskId, outcome, expectedOutcome),
    };

    this.critiques.push(critique);

    // Store lessons
    for (const lesson of critique.lessonsLearned) {
      this.lessons.set(lesson.id, lesson);
    }

    this.emit('critique:complete', { critique });

    return critique;
  }

  private async identifyStrengths(taskId: string, outcome: any): Promise<string[]> {
    const strengths: string[] = [];

    const metrics = this.performanceHistory.find(m => m.taskId === taskId);
    if (!metrics) return strengths;

    if (metrics.success) {
      strengths.push('Task completed successfully');
    }

    if (metrics.duration < 1000) {
      strengths.push('Fast execution');
    }

    if (metrics.errors.length === 0) {
      strengths.push('Error-free execution');
    }

    if (metrics.accuracy && metrics.accuracy > 0.9) {
      strengths.push('High accuracy achieved');
    }

    if (metrics.resourceUsage.cost < 0.01) {
      strengths.push('Cost-efficient solution');
    }

    return strengths;
  }

  private async identifyWeaknesses(
    taskId: string,
    outcome: any,
    expected: any
  ): Promise<string[]> {
    const weaknesses: string[] = [];

    const metrics = this.performanceHistory.find(m => m.taskId === taskId);
    if (!metrics) return weaknesses;

    if (!metrics.success) {
      weaknesses.push('Task failed to complete');
    }

    if (metrics.duration > 10000) {
      weaknesses.push('Slow execution time');
    }

    if (metrics.errors.length > 0) {
      weaknesses.push(`Encountered ${metrics.errors.length} errors`);
    }

    if (metrics.accuracy && metrics.accuracy < 0.7) {
      weaknesses.push('Low accuracy');
    }

    if (metrics.resourceUsage.memoryPeak > 1024 * 1024 * 1024) {
      weaknesses.push('High memory usage');
    }

    return weaknesses;
  }

  private async suggestImprovements(
    taskId: string,
    outcome: any,
    expected: any
  ): Promise<Improvement[]> {
    const improvements: Improvement[] = [];

    const metrics = this.performanceHistory.find(m => m.taskId === taskId);
    if (!metrics) return improvements;

    if (metrics.duration > 5000) {
      improvements.push({
        area: 'performance',
        current: 'Execution takes over 5 seconds',
        suggested: 'Optimize algorithm or use caching',
        priority: 'high',
        effort: 'medium',
        impact: 0.8,
      });
    }

    if (metrics.errors.length > 0) {
      improvements.push({
        area: 'reliability',
        current: 'Errors during execution',
        suggested: 'Add better error handling and validation',
        priority: 'high',
        effort: 'medium',
        impact: 0.9,
      });
    }

    if (metrics.resourceUsage.memoryPeak > 500 * 1024 * 1024) {
      improvements.push({
        area: 'resource_usage',
        current: 'High memory consumption',
        suggested: 'Implement streaming or batching',
        priority: 'medium',
        effort: 'large',
        impact: 0.6,
      });
    }

    return improvements;
  }

  private async generateAlternatives(taskId: string, outcome: any): Promise<Alternative[]> {
    const alternatives: Alternative[] = [];

    alternatives.push({
      description: 'Use different algorithm with better time complexity',
      advantages: ['Faster execution', 'Scales better'],
      disadvantages: ['More complex implementation', 'Higher memory usage'],
      feasibility: 0.7,
      estimatedPerformance: 0.85,
    });

    alternatives.push({
      description: 'Parallelize computation across multiple threads',
      advantages: ['Faster for large inputs', 'Better CPU utilization'],
      disadvantages: ['Requires thread-safe code', 'Overhead for small inputs'],
      feasibility: 0.8,
      estimatedPerformance: 0.8,
    });

    alternatives.push({
      description: 'Use caching for frequently accessed data',
      advantages: ['Much faster for repeated operations', 'Lower API costs'],
      disadvantages: ['Memory overhead', 'Cache invalidation complexity'],
      feasibility: 0.9,
      estimatedPerformance: 0.9,
    });

    return alternatives;
  }

  private async extractLessons(
    taskId: string,
    outcome: any,
    expected: any
  ): Promise<Lesson[]> {
    const lessons: Lesson[] = [];

    const metrics = this.performanceHistory.find(m => m.taskId === taskId);
    if (!metrics) return lessons;

    if (!metrics.success) {
      lessons.push({
        id: this.generateId(),
        category: 'failure_analysis',
        content: 'Always validate inputs before processing',
        context: `Task ${taskId} failed due to invalid inputs`,
        importance: 0.9,
        applicability: ['data_processing', 'api_calls', 'file_operations'],
        verified: false,
      });
    }

    if (metrics.errors.some(e => e.type === 'timeout')) {
      lessons.push({
        id: this.generateId(),
        category: 'performance',
        content: 'Set appropriate timeouts for long-running operations',
        context: `Task ${taskId} experienced timeouts`,
        importance: 0.8,
        applicability: ['network_requests', 'database_queries', 'computations'],
        verified: false,
      });
    }

    return lessons;
  }

  // ========================================================================
  // Meta-Reasoning
  // ========================================================================

  public updateMetaReasoning(
    currentPerformance: number,
    context: Record<string, any>
  ): MetaReasoningState {
    this.emit('meta:reasoning:start');

    // Evaluate current strategy
    const effectiveness = this.evaluateStrategyEffectiveness();

    // Determine if strategy switch needed
    const shouldSwitch = effectiveness < 0.5 && this.performanceHistory.length > 10;

    if (shouldSwitch) {
      const bestAlternative = this.selectBestStrategy(this.metaState.alternativeStrategies);
      this.metaState = {
        currentStrategy: bestAlternative,
        strategyEffectiveness: 0.5,
        alternativeStrategies: this.metaState.alternativeStrategies.filter(
          s => s !== bestAlternative
        ),
        shouldSwitch: false,
        reasoning: `Switched to ${bestAlternative} due to poor performance`,
      };
    } else {
      this.metaState.strategyEffectiveness = effectiveness;
      this.metaState.shouldSwitch = shouldSwitch;
      this.metaState.reasoning = shouldSwitch
        ? 'Current strategy underperforming, considering switch'
        : 'Current strategy performing adequately';
    }

    this.emit('meta:reasoning:complete', { state: this.metaState });

    return this.metaState;
  }

  private evaluateStrategyEffectiveness(): number {
    if (this.performanceHistory.length === 0) return 0.5;

    const recent = this.performanceHistory.slice(-20);
    const successRate = recent.filter(m => m.success).length / recent.length;
    const avgAccuracy = this.calculateAverage(
      recent.map(m => m.accuracy || 0).filter(a => a > 0)
    );

    return (successRate + avgAccuracy) / 2;
  }

  private selectBestStrategy(alternatives: string[]): string {
    // In production, this would evaluate each strategy
    // For now, select randomly
    return alternatives[Math.floor(Math.random() * alternatives.length)];
  }

  // ========================================================================
  // Continuous Improvement
  // ========================================================================

  public trackImprovement(dimension: string, value: number): void {
    let improvement = this.improvements.get(dimension);

    if (!improvement) {
      improvement = {
        dimension,
        baseline: value,
        current: value,
        target: value * 1.2, // 20% improvement target
        trend: 'stable',
        actions: [],
      };
      this.improvements.set(dimension, improvement);
    } else {
      const previousValue = improvement.current;
      improvement.current = value;
      improvement.trend = this.determineTrend(previousValue, value);
    }

    this.emit('improvement:tracked', { improvement });
  }

  private determineTrend(previous: number, current: number): 'improving' | 'stable' | 'declining' {
    const change = (current - previous) / previous;
    if (change > 0.05) return 'improving';
    if (change < -0.05) return 'declining';
    return 'stable';
  }

  public proposeImprovementAction(
    dimension: string,
    action: Omit<ImprovementAction, 'id' | 'timestamp'>
  ): void {
    const improvement = this.improvements.get(dimension);
    if (!improvement) return;

    const fullAction: ImprovementAction = {
      ...action,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    improvement.actions.push(fullAction);
    this.emit('improvement:action:proposed', { dimension, action: fullAction });
  }

  // ========================================================================
  // Reflection Reports
  // ========================================================================

  public async generateReport(period?: { start: number; end: number }): Promise<ReflectionReport> {
    const now = Date.now();
    const actualPeriod = period || {
      start: now - 3600000, // Last hour
      end: now,
    };

    const relevantMetrics = this.performanceHistory.filter(
      m => m.startTime >= actualPeriod.start && m.endTime <= actualPeriod.end
    );

    const report: ReflectionReport = {
      id: this.generateId(),
      timestamp: now,
      period: actualPeriod,
      performance: this.summarizePerformance(relevantMetrics),
      calibration: this.summarizeCalibration(actualPeriod),
      critiques: this.critiques.filter(c => c.timestamp >= actualPeriod.start),
      improvements: Array.from(this.improvements.values()),
      recommendations: this.generateRecommendations(),
    };

    this.emit('report:generated', { report });

    return report;
  }

  private summarizePerformance(metrics: PerformanceMetrics[]): PerformanceSummary {
    if (metrics.length === 0) {
      return {
        tasksCompleted: 0,
        successRate: 0,
        averageAccuracy: 0,
        averageDuration: 0,
        resourceEfficiency: 0,
        errorRate: 0,
      };
    }

    return {
      tasksCompleted: metrics.length,
      successRate: metrics.filter(m => m.success).length / metrics.length,
      averageAccuracy: this.calculateAverage(
        metrics.map(m => m.accuracy || 0).filter(a => a > 0)
      ),
      averageDuration: this.calculateAverage(metrics.map(m => m.duration)),
      resourceEfficiency: this.calculateResourceEfficiency(metrics),
      errorRate: metrics.reduce((sum, m) => sum + m.errors.length, 0) / metrics.length,
    };
  }

  private summarizeCalibration(period: { start: number; end: number }): CalibrationSummary {
    const relevantAssessments = this.confidenceHistory.filter(
      c => this.findMetrics(c.taskId)?.startTime! >= period.start
    );

    if (relevantAssessments.length === 0) {
      return {
        overallCalibration: 0.5,
        overconfidenceRate: 0,
        underconfidenceRate: 0,
        calibrationTrend: 'stable',
      };
    }

    return {
      overallCalibration: this.calculateAverage(
        relevantAssessments.map(a => a.calibrationScore)
      ),
      overconfidenceRate: relevantAssessments.filter(a => a.overconfidence > 0.2).length /
        relevantAssessments.length,
      underconfidenceRate: relevantAssessments.filter(a => a.underconfidence > 0.2).length /
        relevantAssessments.length,
      calibrationTrend: this.detectCalibrationTrend(relevantAssessments),
    };
  }

  private detectCalibrationTrend(
    assessments: ConfidenceAssessment[]
  ): 'improving' | 'stable' | 'declining' {
    if (assessments.length < 4) return 'stable';

    const recentCalib = this.calculateAverage(
      assessments.slice(-assessments.length / 2).map(a => a.calibrationScore)
    );
    const olderCalib = this.calculateAverage(
      assessments.slice(0, assessments.length / 2).map(a => a.calibrationScore)
    );

    if (recentCalib > olderCalib + 0.1) return 'improving';
    if (recentCalib < olderCalib - 0.1) return 'declining';
    return 'stable';
  }

  private generateRecommendations(): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Analyze performance trends
    const perfTrend = this.detectTrend(this.performanceHistory.slice(-20));
    if (perfTrend === 'declining') {
      recommendations.push({
        id: this.generateId(),
        type: 'strategy',
        priority: 'high',
        description: 'Performance is declining, consider switching strategy',
        rationale: 'Recent tasks show decreasing success rate',
        expectedImprovement: 0.3,
        effort: 'medium',
      });
    }

    // Analyze calibration
    const calibSummary = this.summarizeCalibration({
      start: Date.now() - 3600000,
      end: Date.now(),
    });
    if (calibSummary.overconfidenceRate > 0.5) {
      recommendations.push({
        id: this.generateId(),
        type: 'parameter',
        priority: 'medium',
        description: 'Reduce initial confidence estimates',
        rationale: 'High rate of overconfidence detected',
        expectedImprovement: 0.2,
        effort: 'small',
      });
    }

    // Analyze resource usage
    const avgMemory = this.calculateAverage(
      this.performanceHistory.slice(-10).map(m => m.resourceUsage.memoryPeak)
    );
    if (avgMemory > 512 * 1024 * 1024) {
      recommendations.push({
        id: this.generateId(),
        type: 'process',
        priority: 'medium',
        description: 'Optimize memory usage',
        rationale: 'Average memory usage is high',
        expectedImprovement: 0.25,
        effort: 'large',
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private startReflectionLoop(): void {
    setInterval(() => {
      if (this.shouldTriggerReflection()) {
        this.performReflection().catch(err =>
          this.emit('reflection:error', { error: err })
        );
      }
    }, this.config.reflectionInterval);
  }

  private shouldTriggerReflection(): boolean {
    return (
      this.performanceHistory.length > 0 &&
      this.performanceHistory.length % 10 === 0
    );
  }

  private async performReflection(): Promise<void> {
    this.emit('reflection:start');

    const report = await this.generateReport();

    // Update meta-reasoning
    this.updateMetaReasoning(report.performance.successRate, {});

    this.emit('reflection:complete', { report });
  }

  private getRecentMetrics(count: number): PerformanceMetrics[] {
    return this.performanceHistory.slice(-count);
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = this.calculateAverage(values);
    const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculateResourceEfficiency(metrics: PerformanceMetrics[]): number {
    if (metrics.length === 0) return 0;

    const successMetrics = metrics.filter(m => m.success);
    if (successMetrics.length === 0) return 0;

    const avgCost = this.calculateAverage(successMetrics.map(m => m.resourceUsage.cost));
    const avgDuration = this.calculateAverage(successMetrics.map(m => m.duration));

    // Lower cost and duration = higher efficiency
    return 1 / (1 + avgCost + avgDuration / 10000);
  }

  private findMetrics(taskId: string): PerformanceMetrics | undefined {
    return this.performanceHistory.find(m => m.taskId === taskId);
  }

  private generateId(): string {
    return `reflection-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ========================================================================
  // Public Query Methods
  // ========================================================================

  public getPerformanceHistory(): PerformanceMetrics[] {
    return [...this.performanceHistory];
  }

  public getConfidenceHistory(): ConfidenceAssessment[] {
    return [...this.confidenceHistory];
  }

  public getCritiques(): SelfCritique[] {
    return [...this.critiques];
  }

  public getLessons(): Lesson[] {
    return Array.from(this.lessons.values());
  }

  public getImprovements(): ContinuousImprovement[] {
    return Array.from(this.improvements.values());
  }

  public getMetaState(): MetaReasoningState {
    return { ...this.metaState };
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

interface ReflectionConfig {
  enablePerformanceMonitoring: boolean;
  enableConfidenceCalibration: boolean;
  enableSelfCritique: boolean;
  enableMetaReasoning: boolean;
  reflectionInterval: number;
  critiqueThreshold: number;
  improvementThreshold: number;
}

interface PerformanceAnalysis {
  current: PerformanceMetrics;
  relativeSpeed: number;
  relativeAccuracy: number;
  trend: 'improving' | 'stable' | 'declining';
  anomalies: string[];
}

// ============================================================================
// Export
// ============================================================================

export default SelfReflectionSystem;
