/**
 * Advanced Planning Engine
 * Hierarchical Task Networks, STRIPS-like planning, Monte Carlo Tree Search
 * Constraint satisfaction, multi-objective optimization
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface Task {
  id: string;
  name: string;
  description: string;
  type: 'atomic' | 'compound' | 'abstract';
  priority: number;
  estimatedDuration: number; // milliseconds
  dependencies: string[]; // task IDs
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
  probability: number; // 0-1
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
  predicates: Map<string, Set<string>>; // predicate -> instances
  resources: Map<string, number>; // resource type -> available amount
  time: number;
  variables: Map<string, any>;
}

export interface Plan {
  id: string;
  tasks: PlanStep[];
  totalDuration: number;
  totalCost: number;
  reliability: number; // 0-1
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

// ============================================================================
// Planning Algorithms
// ============================================================================

export class PlanningEngine extends EventEmitter {
  private tasks: Map<string, Task> = new Map();
  private methods: Map<string, HTNMethod[]> = new Map();
  private worldState: WorldState;
  private searchStats: SearchStatistics;
  private config: PlanningConfig;

  constructor(config: Partial<PlanningConfig> = {}) {
    super();
    this.config = {
      algorithm: 'htn',
      maxDepth: 100,
      maxNodes: 10000,
      timeout: 30000,
      useHeuristics: true,
      parallelPlanning: true,
      optimizationObjectives: ['duration', 'cost'],
      explorationConstant: Math.sqrt(2),
      ...config,
    };
    this.worldState = this.createInitialState();
    this.searchStats = this.createInitialStats();
  }

  // ========================================================================
  // Public API
  // ========================================================================

  public async plan(
    goal: Task,
    initialState?: WorldState
  ): Promise<PlanningResult> {
    if (initialState) {
      this.worldState = initialState;
    }

    this.emit('planning:start', { goal, state: this.worldState });
    const startTime = Date.now();
    this.searchStats = this.createInitialStats();

    try {
      let plan: Plan | undefined;
      let alternatives: Plan[] = [];

      switch (this.config.algorithm) {
        case 'htn':
          plan = await this.htnPlanning(goal);
          break;
        case 'strips':
          plan = await this.stripsPlanning(goal);
          break;
        case 'mcts':
          plan = await this.mctsPlanning(goal);
          break;
        case 'constraint':
          plan = await this.constraintBasedPlanning(goal);
          break;
        case 'hybrid':
          ({ plan, alternatives } = await this.hybridPlanning(goal));
          break;
      }

      this.searchStats.timeElapsed = Date.now() - startTime;

      if (plan) {
        this.emit('planning:success', { plan, stats: this.searchStats });
        return {
          success: true,
          plan,
          alternatives,
          searchStats: this.searchStats,
        };
      } else {
        this.emit('planning:failure', { goal, stats: this.searchStats });
        return {
          success: false,
          alternatives,
          failureReason: 'No valid plan found',
          searchStats: this.searchStats,
        };
      }
    } catch (error) {
      this.emit('planning:error', { error, goal });
      return {
        success: false,
        alternatives: [],
        failureReason: (error as Error).message,
        searchStats: this.searchStats,
      };
    }
  }

  // ========================================================================
  // HTN Planning (Hierarchical Task Network)
  // ========================================================================

  private async htnPlanning(goal: Task): Promise<Plan | undefined> {
    const plan: PlanStep[] = [];
    const agenda: Task[] = [goal];
    let currentTime = 0;

    // Clone world state to avoid race conditions
    const localState = this.cloneState(this.worldState);

    while (agenda.length > 0) {
      const task = agenda.shift();
      if (!task) break;
      this.searchStats.nodesExpanded++;

      if (task.type === 'atomic') {
        // Execute atomic task directly
        if (this.canExecuteInState(task, currentTime, localState)) {
          const step = this.createPlanStep(task, currentTime);
          plan.push(step);
          // Apply effects to local state instead of shared state
          this.applyEffectsToLocalState(task.effects, localState);
          currentTime = step.endTime;
        } else {
          return undefined; // Cannot execute, planning failed
        }
      } else {
        // Decompose compound/abstract task
        const methods = this.methods.get(task.name) || [];
        let decomposed = false;

        for (const method of methods) {
          if (this.checkPreconditionsInState(method.preconditions, localState)) {
            // Add decomposed tasks to agenda
            agenda.unshift(...method.decomposition);
            decomposed = true;
            break;
          }
        }

        if (!decomposed) {
          return undefined; // No valid decomposition found
        }
      }

      if (this.searchStats.nodesExpanded > this.config.maxNodes) {
        throw new Error('Search space exceeded');
      }
    }

    return this.createPlan(plan);
  }

  // Helper methods for state-safe operations
  private canExecuteInState(task: Task, time: number, state: WorldState): boolean {
    return this.checkPreconditionsInState(task.preconditions, state) &&
           this.checkResourceAvailabilityInState(task.resources, state);
  }

  private checkPreconditionsInState(conditions: Condition[], state: WorldState): boolean {
    return conditions.every(c => this.evaluateConditionInState(c, state));
  }

  private evaluateConditionInState(condition: Condition, state: WorldState): boolean {
    // Simplified condition evaluation on specific state
    return condition.satisfied;
  }

  private checkResourceAvailabilityInState(requirements: ResourceRequirement[], state: WorldState): boolean {
    return requirements.every(req => {
      const available = state.resources.get(req.resourceType) || 0;
      return available >= req.amount;
    });
  }

  private applyEffectsToLocalState(effects: Effect[], state: WorldState): void {
    for (const effect of effects) {
      this.applyEffectToState(state, effect);
    }
  }

  // ========================================================================
  // STRIPS Planning (Stanford Research Institute Problem Solver)
  // ========================================================================

  private async stripsPlanning(goal: Task): Promise<Plan | undefined> {
    const openList: SearchNode[] = [];
    const closedList = new Set<string>();
    const initialNode: SearchNode = {
      state: this.worldState,
      plan: [],
      cost: 0,
      heuristic: this.estimateGoalDistance(this.worldState, goal),
      parent: undefined,
    };

    openList.push(initialNode);

    while (openList.length > 0) {
      // Get node with lowest f = cost + heuristic
      openList.sort((a, b) => (a.cost + a.heuristic) - (b.cost + b.heuristic));
      const current = openList.shift();
      if (!current) break;
      this.searchStats.nodesExpanded++;

      // Check if goal reached
      if (this.isGoalReached(current.state, goal)) {
        return this.createPlan(current.plan);
      }

      const stateHash = this.hashState(current.state);
      if (closedList.has(stateHash)) {
        continue;
      }
      closedList.add(stateHash);

      // Expand node - try all applicable actions
      const applicableActions = this.getApplicableActions(current.state);
      for (const action of applicableActions) {
        const newState = this.applyAction(current.state, action);
        const newStep = this.createPlanStep(action, current.plan.length);
        const newPlan = [...current.plan, newStep];
        const newCost = current.cost + action.priority;
        const newHeuristic = this.estimateGoalDistance(newState, goal);

        const newNode: SearchNode = {
          state: newState,
          plan: newPlan,
          cost: newCost,
          heuristic: newHeuristic,
          parent: current,
        };

        openList.push(newNode);
      }

      if (this.searchStats.nodesExpanded > this.config.maxNodes) {
        return undefined; // Search space exceeded
      }
    }

    return undefined; // No plan found
  }

  // ========================================================================
  // MCTS Planning (Monte Carlo Tree Search)
  // ========================================================================

  private async mctsPlanning(goal: Task): Promise<Plan | undefined> {
    const root: MCTSNode = {
      state: this.worldState,
      children: [],
      visits: 0,
      value: 0,
      untriedActions: this.getApplicableActions(this.worldState),
    };

    const iterations = 1000;
    for (let i = 0; i < iterations; i++) {
      // Selection
      let node = this.selectNode(root);

      // Expansion
      if (node.untriedActions.length > 0 && node.visits > 0) {
        node = this.expandNode(node);
      }

      // Simulation
      const reward = this.simulateRandomPlayout(node.state, goal);

      // Backpropagation
      this.backpropagate(node, reward);

      this.searchStats.nodesExpanded++;
    }

    // Extract best plan
    return this.extractBestPlan(root, goal);
  }

  private selectNode(node: MCTSNode): MCTSNode {
    while (node.children.length > 0 && node.untriedActions.length === 0) {
      node = this.selectBestChild(node);
    }
    return node;
  }

  private selectBestChild(node: MCTSNode): MCTSNode {
    const c = this.config.explorationConstant;
    let best = node.children[0];
    let bestValue = -Infinity;

    for (const child of node.children) {
      const exploitation = child.value / child.visits;
      const exploration = Math.sqrt((2 * Math.log(node.visits)) / child.visits);
      const ucb1 = exploitation + c * exploration;

      if (ucb1 > bestValue) {
        bestValue = ucb1;
        best = child;
      }
    }

    return best;
  }

  private expandNode(node: MCTSNode): MCTSNode {
    const action = node.untriedActions.pop();
    if (!action) {
      throw new Error('No untried actions available for node expansion');
    }
    const newState = this.applyAction(node.state, action);
    const child: MCTSNode = {
      state: newState,
      action,
      parent: node,
      children: [],
      visits: 0,
      value: 0,
      untriedActions: this.getApplicableActions(newState),
    };
    node.children.push(child);
    return child;
  }

  private simulateRandomPlayout(state: WorldState, goal: Task): number {
    let currentState = this.cloneState(state);
    let steps = 0;
    const maxSteps = 50;

    while (steps < maxSteps && !this.isGoalReached(currentState, goal)) {
      const actions = this.getApplicableActions(currentState);
      if (actions.length === 0) break;

      const randomAction = actions[Math.floor(Math.random() * actions.length)];
      currentState = this.applyAction(currentState, randomAction);
      steps++;
    }

    if (this.isGoalReached(currentState, goal)) {
      return 1.0 / steps; // Shorter paths are better
    }
    return 0;
  }

  private backpropagate(node: MCTSNode, reward: number): void {
    let current: MCTSNode | undefined = node;
    while (current) {
      current.visits++;
      current.value += reward;
      current = current.parent;
    }
  }

  private extractBestPlan(root: MCTSNode, goal: Task): Plan | undefined {
    const steps: PlanStep[] = [];
    let current = root;
    let time = 0;

    while (!this.isGoalReached(current.state, goal) && current.children.length > 0) {
      // Choose child with most visits
      current = current.children.reduce((best, child) =>
        child.visits > best.visits ? child : best
      );

      if (current.action) {
        const step = this.createPlanStep(current.action, time);
        steps.push(step);
        time = step.endTime;
      }
    }

    return steps.length > 0 ? this.createPlan(steps) : undefined;
  }

  // ========================================================================
  // Constraint-Based Planning
  // ========================================================================

  private async constraintBasedPlanning(goal: Task): Promise<Plan | undefined> {
    const variables = this.extractPlanningVariables(goal);
    const constraints = this.buildConstraintGraph(goal);
    const domains = this.initializeDomains(variables);

    // CSP Solving with backtracking
    const assignment = this.backtrackingSearch(variables, domains, constraints);

    if (assignment) {
      return this.assignmentToPlan(assignment, goal);
    }

    return undefined;
  }

  private backtrackingSearch(
    variables: string[],
    domains: Map<string, any[]>,
    constraints: ConstraintFunction[]
  ): Map<string, any> | undefined {
    const assignment = new Map<string, any>();
    return this.backtrack(assignment, variables, domains, constraints);
  }

  private backtrack(
    assignment: Map<string, any>,
    variables: string[],
    domains: Map<string, any[]>,
    constraints: ConstraintFunction[]
  ): Map<string, any> | undefined {
    if (assignment.size === variables.length) {
      return assignment; // Complete assignment found
    }

    const unassigned = variables.find(v => !assignment.has(v));
    if (!unassigned) {
      return undefined; // No unassigned variables found
    }

    const domain = domains.get(unassigned) || [];

    for (const value of domain) {
      assignment.set(unassigned, value);

      if (this.isConsistent(assignment, constraints)) {
        const result = this.backtrack(assignment, variables, domains, constraints);
        if (result) return result;
      }

      assignment.delete(unassigned);
    }

    return undefined; // No solution found
  }

  private isConsistent(
    assignment: Map<string, any>,
    constraints: ConstraintFunction[]
  ): boolean {
    return constraints.every(constraint => constraint(assignment));
  }

  // ========================================================================
  // Hybrid Planning (Combines multiple approaches)
  // ========================================================================

  private async hybridPlanning(
    goal: Task
  ): Promise<{ plan?: Plan; alternatives: Plan[] }> {
    const approaches: Promise<Plan | undefined>[] = [
      this.htnPlanning(goal),
      this.stripsPlanning(goal),
      this.mctsPlanning(goal),
    ];

    const results = await Promise.allSettled(approaches);
    const plans = results
      .filter((r): r is PromiseFulfilledResult<Plan> =>
        r.status === 'fulfilled' && r.value !== undefined
      )
      .map(r => r.value);

    if (plans.length === 0) {
      return { alternatives: [] };
    }

    // Rank plans by multiple objectives
    const rankedPlans = this.rankPlans(plans);
    return {
      plan: rankedPlans[0],
      alternatives: rankedPlans.slice(1),
    };
  }

  // ========================================================================
  // Multi-Objective Optimization
  // ========================================================================

  private rankPlans(plans: Plan[]): Plan[] {
    const objectives = this.config.optimizationObjectives;

    return plans.sort((a, b) => {
      for (const objective of objectives) {
        const diff = this.evaluateObjective(a, objective) -
                     this.evaluateObjective(b, objective);
        if (Math.abs(diff) > 0.001) {
          return diff;
        }
      }
      return 0;
    });
  }

  private evaluateObjective(plan: Plan, objective: string): number {
    switch (objective) {
      case 'duration':
        return plan.totalDuration;
      case 'cost':
        return plan.totalCost;
      case 'reliability':
        return -plan.reliability; // Negative because we want to maximize
      case 'parallelism':
        return -plan.parallelism; // Negative because we want to maximize
      default:
        return 0;
    }
  }

  // ========================================================================
  // Plan Repair and Adaptation
  // ========================================================================

  public async repairPlan(
    originalPlan: Plan,
    failure: PlanFailure
  ): Promise<Plan | undefined> {
    this.emit('plan:repair:start', { originalPlan, failure });

    // Identify failed step
    const failedStep = originalPlan.tasks.find(s => s.taskId === failure.stepId);
    if (!failedStep) return undefined;

    // Try local repair first
    const localRepair = await this.localRepair(originalPlan, failedStep, failure);
    if (localRepair) {
      this.emit('plan:repair:success', { plan: localRepair, type: 'local' });
      return localRepair;
    }

    // Try replanning from failure point
    const replan = await this.replanFromFailure(originalPlan, failedStep, failure);
    if (replan) {
      this.emit('plan:repair:success', { plan: replan, type: 'replan' });
      return replan;
    }

    this.emit('plan:repair:failure', { originalPlan, failure });
    return undefined;
  }

  private async localRepair(
    plan: Plan,
    failedStep: PlanStep,
    failure: PlanFailure
  ): Promise<Plan | undefined> {
    // Try alternative actions for the failed step
    const alternatives = this.findAlternativeActions(failedStep);

    for (const alt of alternatives) {
      const modifiedPlan = this.replacePlanStep(plan, failedStep, alt);
      if (this.validatePlan(modifiedPlan)) {
        return modifiedPlan;
      }
    }

    return undefined;
  }

  private async replanFromFailure(
    originalPlan: Plan,
    failedStep: PlanStep,
    failure: PlanFailure
  ): Promise<Plan | undefined> {
    // Extract remaining goal from original plan
    const remainingGoal = this.extractRemainingGoal(originalPlan, failedStep);

    // Update world state to failure point
    const failureState = this.reconstructStateAt(originalPlan, failedStep);

    // Replan from this point
    const newPlan = await this.plan(remainingGoal, failureState);

    if (newPlan.success && newPlan.plan) {
      // Combine executed steps with new plan
      return this.mergePlans(originalPlan, failedStep, newPlan.plan);
    }

    return undefined;
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private createInitialState(): WorldState {
    return {
      predicates: new Map(),
      resources: new Map(),
      time: 0,
      variables: new Map(),
    };
  }

  private createInitialStats(): SearchStatistics {
    return {
      nodesExpanded: 0,
      nodesEvaluated: 0,
      timeElapsed: 0,
      memoryUsed: 0,
      depthReached: 0,
      branchingFactor: 0,
    };
  }

  private createPlanStep(task: Task, startTime: number): PlanStep {
    return {
      taskId: task.id,
      startTime,
      endTime: startTime + task.estimatedDuration,
      dependencies: task.dependencies,
      resources: new Map(),
      preconditions: task.preconditions,
      effects: task.effects,
    };
  }

  private createPlan(steps: PlanStep[]): Plan {
    const totalDuration = steps.length > 0
      ? Math.max(...steps.map(s => s.endTime))
      : 0;

    return {
      id: this.generateId(),
      tasks: steps,
      totalDuration,
      totalCost: this.calculatePlanCost(steps),
      reliability: this.calculateReliability(steps),
      parallelism: this.calculateParallelism(steps),
      metadata: {},
    };
  }

  private canExecute(task: Task, time: number): boolean {
    return this.checkPreconditions(task.preconditions) &&
           this.checkResourceAvailability(task.resources);
  }

  private checkPreconditions(conditions: Condition[]): boolean {
    return conditions.every(c => this.evaluateCondition(c));
  }

  private evaluateCondition(condition: Condition): boolean {
    // Simplified condition evaluation
    return condition.satisfied;
  }

  private checkResourceAvailability(requirements: ResourceRequirement[]): boolean {
    return requirements.every(req => {
      const available = this.worldState.resources.get(req.resourceType) || 0;
      return available >= req.amount;
    });
  }

  // DEPRECATED: Use applyEffectsToState instead to avoid race conditions
  // This method modifies shared state and should not be used in concurrent planning
  private applyEffects(effects: Effect[]): void {
    console.warn('applyEffects modifies shared state. Consider using applyEffectsToState with cloned state.');
    for (const effect of effects) {
      switch (effect.type) {
        case 'add':
          this.addPredicate(effect.predicate, effect.parameters);
          break;
        case 'delete':
          this.deletePredicate(effect.predicate, effect.parameters);
          break;
        case 'modify':
          this.modifyPredicate(effect.predicate, effect.parameters);
          break;
      }
    }
  }

  private addPredicate(predicate: string, params: any[]): void {
    if (!this.worldState.predicates.has(predicate)) {
      this.worldState.predicates.set(predicate, new Set());
    }
    const predicateSet = this.worldState.predicates.get(predicate);
    if (predicateSet) {
      predicateSet.add(JSON.stringify(params));
    }
  }

  private deletePredicate(predicate: string, params: any[]): void {
    this.worldState.predicates.get(predicate)?.delete(JSON.stringify(params));
  }

  private modifyPredicate(predicate: string, params: any[]): void {
    this.deletePredicate(predicate, params.slice(0, -1));
    this.addPredicate(predicate, params);
  }

  private getApplicableActions(state: WorldState): Task[] {
    return Array.from(this.tasks.values()).filter(task =>
      task.type === 'atomic' && this.canExecute(task, state.time)
    );
  }

  private applyAction(state: WorldState, action: Task): WorldState {
    const newState = this.cloneState(state);
    for (const effect of action.effects) {
      this.applyEffectToState(newState, effect);
    }
    newState.time += action.estimatedDuration;
    return newState;
  }

  private applyEffectToState(state: WorldState, effect: Effect): void {
    // Apply effect to state (similar to applyEffects but on a specific state)
    const predicates = state.predicates;
    switch (effect.type) {
      case 'add':
        if (!predicates.has(effect.predicate)) {
          predicates.set(effect.predicate, new Set());
        }
        const predicateSet = predicates.get(effect.predicate);
        if (predicateSet) {
          predicateSet.add(JSON.stringify(effect.parameters));
        }
        break;
      case 'delete':
        predicates.get(effect.predicate)?.delete(JSON.stringify(effect.parameters));
        break;
    }
  }

  private cloneState(state: WorldState): WorldState {
    return {
      predicates: new Map(Array.from(state.predicates.entries()).map(
        ([k, v]) => [k, new Set(v)]
      )),
      resources: new Map(state.resources),
      time: state.time,
      variables: new Map(state.variables),
    };
  }

  private hashState(state: WorldState): string {
    const predicateHash = Array.from(state.predicates.entries())
      .sort()
      .map(([k, v]) => `${k}:${Array.from(v).sort().join(',')}`)
      .join('|');
    return predicateHash;
  }

  private isGoalReached(state: WorldState, goal: Task): boolean {
    return this.checkPreconditions(goal.preconditions);
  }

  private estimateGoalDistance(state: WorldState, goal: Task): number {
    // Simple heuristic: count unsatisfied preconditions
    return goal.preconditions.filter(c => !this.evaluateCondition(c)).length;
  }

  private calculatePlanCost(steps: PlanStep[]): number {
    return steps.reduce((sum, step) => {
      const task = this.tasks.get(step.taskId);
      return sum + (task?.priority || 0);
    }, 0);
  }

  private calculateReliability(steps: PlanStep[]): number {
    if (steps.length === 0) return 1.0;

    const reliability = steps.reduce((product, step) => {
      const taskReliability = step.effects.reduce((p, e) => p * e.probability, 1.0);
      return product * taskReliability;
    }, 1.0);

    return reliability;
  }

  private calculateParallelism(steps: PlanStep[]): number {
    if (steps.length === 0) return 0;

    const timeSlots = new Map<number, number>();
    for (const step of steps) {
      for (let t = step.startTime; t < step.endTime; t++) {
        timeSlots.set(t, (timeSlots.get(t) || 0) + 1);
      }
    }

    return Math.max(...Array.from(timeSlots.values()));
  }

  private validatePlan(plan: Plan): boolean {
    // Check all constraints are satisfied
    return plan.tasks.every(step => {
      const task = this.tasks.get(step.taskId);
      return task?.constraints.every(c =>
        c.validate(this.worldState, plan)
      ) || false;
    });
  }

  private extractPlanningVariables(goal: Task): string[] {
    // Extract variables from goal and related tasks
    return ['task', 'time', 'resource']; // Simplified
  }

  private buildConstraintGraph(goal: Task): ConstraintFunction[] {
    return []; // Simplified
  }

  private initializeDomains(variables: string[]): Map<string, any[]> {
    const domains = new Map<string, any[]>();
    for (const variable of variables) {
      domains.set(variable, []); // Populate with actual domain values
    }
    return domains;
  }

  private assignmentToPlan(assignment: Map<string, any>, goal: Task): Plan {
    // Convert CSP assignment to plan
    return this.createPlan([]);
  }

  private findAlternativeActions(step: PlanStep): Task[] {
    // Find alternative tasks that achieve same effects
    return [];
  }

  private replacePlanStep(plan: Plan, oldStep: PlanStep, newTask: Task): Plan {
    const newSteps = plan.tasks.map(s =>
      s === oldStep ? this.createPlanStep(newTask, s.startTime) : s
    );
    return this.createPlan(newSteps);
  }

  private extractRemainingGoal(plan: Plan, failedStep: PlanStep): Task {
    // Extract what still needs to be accomplished
    return {
      id: 'remaining-goal',
      name: 'remaining',
      description: 'Remaining goal after failure',
      type: 'abstract',
      priority: 1,
      estimatedDuration: 0,
      dependencies: [],
      preconditions: [],
      effects: [],
      resources: [],
      constraints: [],
      metadata: {},
    };
  }

  private reconstructStateAt(plan: Plan, step: PlanStep): WorldState {
    // Reconstruct world state at the point of failure
    return this.cloneState(this.worldState);
  }

  private mergePlans(original: Plan, failedStep: PlanStep, newPlan: Plan): Plan {
    const completedSteps = original.tasks.filter(s => s.endTime < failedStep.startTime);
    const mergedSteps = [...completedSteps, ...newPlan.tasks];
    return this.createPlan(mergedSteps);
  }

  private generateId(): string {
    return `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ========================================================================
  // Task and Method Registration
  // ========================================================================

  public registerTask(task: Task): void {
    this.tasks.set(task.id, task);
    this.emit('task:registered', { task });
  }

  public registerMethod(method: HTNMethod): void {
    if (!this.methods.has(method.taskName)) {
      this.methods.set(method.taskName, []);
    }
    const methods = this.methods.get(method.taskName);
    if (methods) {
      methods.push(method);
    }
    this.emit('method:registered', { method });
  }

  public getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  public getMethods(taskName: string): HTNMethod[] {
    return this.methods.get(taskName) || [];
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

interface SearchNode {
  state: WorldState;
  plan: PlanStep[];
  cost: number;
  heuristic: number;
  parent?: SearchNode;
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

type ConstraintFunction = (assignment: Map<string, any>) => boolean;

// ============================================================================
// Export
// ============================================================================

export default PlanningEngine;
