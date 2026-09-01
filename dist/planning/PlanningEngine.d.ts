/**
 * Advanced Planning Engine
 * Hierarchical Task Networks, STRIPS-like planning, Monte Carlo Tree Search
 * Constraint satisfaction, multi-objective optimization
 */
import { EventEmitter } from 'events';
export interface Task {
    id: string;
    name: string;
    description: string;
    type: 'atomic' | 'compound' | 'abstract';
    priority: number;
    estimatedDuration: number;
    dependencies: string[];
    preconditions: Condition[];
    effects: Effect[];
    resources: ResourceRequirement[];
    constraints: Constraint[];
    metadata: Record<string, any>;
}
export interface Condition {
    type: 'state' | 'resource' | 'temporal' | 'custom';
    predicate: string;
    parameters: any[];
    satisfied: boolean;
}
export interface Effect {
    type: 'add' | 'delete' | 'modify';
    predicate: string;
    parameters: any[];
    probability: number;
}
export interface ResourceRequirement {
    resourceType: string;
    amount: number;
    duration: number;
    exclusive: boolean;
}
export interface Constraint {
    type: 'temporal' | 'resource' | 'ordering' | 'mutex' | 'custom';
    description: string;
    validate: (state: WorldState, plan: Plan) => boolean;
}
export interface WorldState {
    predicates: Map<string, Set<string>>;
    resources: Map<string, number>;
    time: number;
    variables: Map<string, any>;
}
export interface Plan {
    id: string;
    tasks: PlanStep[];
    totalDuration: number;
    totalCost: number;
    reliability: number;
    parallelism: number;
    metadata: Record<string, any>;
}
export interface PlanStep {
    taskId: string;
    startTime: number;
    endTime: number;
    dependencies: string[];
    resources: Map<string, number>;
    preconditions: Condition[];
    effects: Effect[];
}
export interface PlanningResult {
    success: boolean;
    plan?: Plan;
    alternatives: Plan[];
    failureReason?: string;
    searchStats: SearchStatistics;
}
export interface SearchStatistics {
    nodesExpanded: number;
    nodesEvaluated: number;
    timeElapsed: number;
    memoryUsed: number;
    depthReached: number;
    branchingFactor: number;
}
export interface HTNMethod {
    name: string;
    taskName: string;
    preconditions: Condition[];
    decomposition: Task[];
    cost: number;
}
export interface MCTSNode {
    state: WorldState;
    action?: Task;
    parent?: MCTSNode;
    children: MCTSNode[];
    visits: number;
    value: number;
    untriedActions: Task[];
}
export declare class PlanningEngine extends EventEmitter {
    private tasks;
    private methods;
    private worldState;
    private searchStats;
    private config;
    constructor(config?: Partial<PlanningConfig>);
    plan(goal: Task, initialState?: WorldState): Promise<PlanningResult>;
    private htnPlanning;
    private canExecuteInState;
    private checkPreconditionsInState;
    private evaluateConditionInState;
    private checkResourceAvailabilityInState;
    private applyEffectsToLocalState;
    private stripsPlanning;
    private mctsPlanning;
    private selectNode;
    private selectBestChild;
    private expandNode;
    private simulateRandomPlayout;
    private backpropagate;
    private extractBestPlan;
    private constraintBasedPlanning;
    private backtrackingSearch;
    private backtrack;
    private isConsistent;
    private hybridPlanning;
    private rankPlans;
    private evaluateObjective;
    repairPlan(originalPlan: Plan, failure: PlanFailure): Promise<Plan | undefined>;
    private localRepair;
    private replanFromFailure;
    private createInitialState;
    private createInitialStats;
    private createPlanStep;
    private createPlan;
    private canExecute;
    private checkPreconditions;
    private evaluateCondition;
    private checkResourceAvailability;
    private applyEffects;
    private addPredicate;
    private deletePredicate;
    private modifyPredicate;
    private getApplicableActions;
    private applyAction;
    private applyEffectToState;
    private cloneState;
    private hashState;
    private isGoalReached;
    private estimateGoalDistance;
    private calculatePlanCost;
    private calculateReliability;
    private calculateParallelism;
    private validatePlan;
    private extractPlanningVariables;
    private buildConstraintGraph;
    private initializeDomains;
    private assignmentToPlan;
    private findAlternativeActions;
    private replacePlanStep;
    private extractRemainingGoal;
    private reconstructStateAt;
    private mergePlans;
    private generateId;
    registerTask(task: Task): void;
    registerMethod(method: HTNMethod): void;
    getTask(id: string): Task | undefined;
    getMethods(taskName: string): HTNMethod[];
}
interface PlanningConfig {
    algorithm: 'htn' | 'strips' | 'mcts' | 'constraint' | 'hybrid';
    maxDepth: number;
    maxNodes: number;
    timeout: number;
    useHeuristics: boolean;
    parallelPlanning: boolean;
    optimizationObjectives: string[];
    explorationConstant: number;
}
interface PlanFailure {
    stepId: string;
    reason: string;
    timestamp: number;
    recoverable: boolean;
}
export default PlanningEngine;
//# sourceMappingURL=PlanningEngine.d.ts.map