export interface PlanStep {
    id: string;
    description: string;
    tool: string;
    input: unknown;
    dependencies: string[];
    estimatedCost: number;
    estimatedTime: number;
    risk: 'low' | 'medium' | 'high';
    priority: number;
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
    result?: unknown;
    error?: string;
}
export interface ExecutionPlan {
    id: string;
    goal: string;
    steps: PlanStep[];
    totalEstimatedCost: number;
    totalEstimatedTime: number;
    overallRisk: 'low' | 'medium' | 'high';
    createdAt: Date;
    validationCriteria: string[];
}
export interface AlternativePlan {
    plan: ExecutionPlan;
    score: number;
    reasoning: string;
}
export declare class AdvancedPlanner {
    private stepCounter;
    createPlan(goal: string, context: {
        workspace: string;
        availableTools: string[];
        constraints?: {
            maxCost?: number;
            maxTime?: number;
            allowedRisk?: 'low' | 'medium' | 'high';
        };
    }): Promise<ExecutionPlan>;
    generateAlternativePlans(goal: string, context: any, count?: number): Promise<AlternativePlan[]>;
    private createPlanWithStrategy;
    private decomposeGoal;
    private createStep;
    private estimateStepCost;
    private estimateStepTime;
    private assessStepRisk;
    private orderByDependencies;
    private optimizePlan;
    private removeRedundantSteps;
    private mergeCompatibleSteps;
    private applyCostConstraint;
    private applyRiskConstraint;
    private optimizeForCost;
    private optimizeForTime;
    private optimizeForRisk;
    private identifyParallelSteps;
    private calculateCriticalPath;
    private assessOverallRisk;
    private generateValidationCriteria;
    private scorePlan;
    private generatePlanId;
    visualizePlan(plan: ExecutionPlan): string;
}
//# sourceMappingURL=AdvancedPlanner.d.ts.map