"use strict";
/**
 * Advanced Planning Engine
 * Hierarchical Task Networks, STRIPS-like planning, Monte Carlo Tree Search
 * Constraint satisfaction, multi-objective optimization
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanningEngine = void 0;
const events_1 = require("events");
// ============================================================================
// Planning Algorithms
// ============================================================================
class PlanningEngine extends events_1.EventEmitter {
    tasks = new Map();
    methods = new Map();
    worldState;
    searchStats;
    config;
    constructor(config = {}) {
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
    async plan(goal, initialState) {
        if (initialState) {
            this.worldState = initialState;
        }
        this.emit('planning:start', { goal, state: this.worldState });
        const startTime = Date.now();
        this.searchStats = this.createInitialStats();
        try {
            let plan;
            let alternatives = [];
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
            }
            else {
                this.emit('planning:failure', { goal, stats: this.searchStats });
                return {
                    success: false,
                    alternatives,
                    failureReason: 'No valid plan found',
                    searchStats: this.searchStats,
                };
            }
        }
        catch (error) {
            this.emit('planning:error', { error, goal });
            return {
                success: false,
                alternatives: [],
                failureReason: error.message,
                searchStats: this.searchStats,
            };
        }
    }
    // ========================================================================
    // HTN Planning (Hierarchical Task Network)
    // ========================================================================
    async htnPlanning(goal) {
        const plan = [];
        const agenda = [goal];
        let currentTime = 0;
        // Clone world state to avoid race conditions
        const localState = this.cloneState(this.worldState);
        while (agenda.length > 0) {
            const task = agenda.shift();
            if (!task)
                break;
            this.searchStats.nodesExpanded++;
            if (task.type === 'atomic') {
                // Execute atomic task directly
                if (this.canExecuteInState(task, currentTime, localState)) {
                    const step = this.createPlanStep(task, currentTime);
                    plan.push(step);
                    // Apply effects to local state instead of shared state
                    this.applyEffectsToLocalState(task.effects, localState);
                    currentTime = step.endTime;
                }
                else {
                    return undefined; // Cannot execute, planning failed
                }
            }
            else {
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
    canExecuteInState(task, time, state) {
        return this.checkPreconditionsInState(task.preconditions, state) &&
            this.checkResourceAvailabilityInState(task.resources, state);
    }
    checkPreconditionsInState(conditions, state) {
        return conditions.every(c => this.evaluateConditionInState(c, state));
    }
    evaluateConditionInState(condition, state) {
        // Simplified condition evaluation on specific state
        return condition.satisfied;
    }
    checkResourceAvailabilityInState(requirements, state) {
        return requirements.every(req => {
            const available = state.resources.get(req.resourceType) || 0;
            return available >= req.amount;
        });
    }
    applyEffectsToLocalState(effects, state) {
        for (const effect of effects) {
            this.applyEffectToState(state, effect);
        }
    }
    // ========================================================================
    // STRIPS Planning (Stanford Research Institute Problem Solver)
    // ========================================================================
    async stripsPlanning(goal) {
        const openList = [];
        const closedList = new Set();
        const initialNode = {
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
            if (!current)
                break;
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
                const newNode = {
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
    async mctsPlanning(goal) {
        const root = {
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
    selectNode(node) {
        while (node.children.length > 0 && node.untriedActions.length === 0) {
            node = this.selectBestChild(node);
        }
        return node;
    }
    selectBestChild(node) {
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
    expandNode(node) {
        const action = node.untriedActions.pop();
        if (!action) {
            throw new Error('No untried actions available for node expansion');
        }
        const newState = this.applyAction(node.state, action);
        const child = {
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
    simulateRandomPlayout(state, goal) {
        let currentState = this.cloneState(state);
        let steps = 0;
        const maxSteps = 50;
        while (steps < maxSteps && !this.isGoalReached(currentState, goal)) {
            const actions = this.getApplicableActions(currentState);
            if (actions.length === 0)
                break;
            const randomAction = actions[Math.floor(Math.random() * actions.length)];
            currentState = this.applyAction(currentState, randomAction);
            steps++;
        }
        if (this.isGoalReached(currentState, goal)) {
            return 1.0 / steps; // Shorter paths are better
        }
        return 0;
    }
    backpropagate(node, reward) {
        let current = node;
        while (current) {
            current.visits++;
            current.value += reward;
            current = current.parent;
        }
    }
    extractBestPlan(root, goal) {
        const steps = [];
        let current = root;
        let time = 0;
        while (!this.isGoalReached(current.state, goal) && current.children.length > 0) {
            // Choose child with most visits
            current = current.children.reduce((best, child) => child.visits > best.visits ? child : best);
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
    async constraintBasedPlanning(goal) {
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
    backtrackingSearch(variables, domains, constraints) {
        const assignment = new Map();
        return this.backtrack(assignment, variables, domains, constraints);
    }
    backtrack(assignment, variables, domains, constraints) {
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
                if (result)
                    return result;
            }
            assignment.delete(unassigned);
        }
        return undefined; // No solution found
    }
    isConsistent(assignment, constraints) {
        return constraints.every(constraint => constraint(assignment));
    }
    // ========================================================================
    // Hybrid Planning (Combines multiple approaches)
    // ========================================================================
    async hybridPlanning(goal) {
        const approaches = [
            this.htnPlanning(goal),
            this.stripsPlanning(goal),
            this.mctsPlanning(goal),
        ];
        const results = await Promise.allSettled(approaches);
        const plans = results
            .filter((r) => r.status === 'fulfilled' && r.value !== undefined)
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
    rankPlans(plans) {
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
    evaluateObjective(plan, objective) {
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
    async repairPlan(originalPlan, failure) {
        this.emit('plan:repair:start', { originalPlan, failure });
        // Identify failed step
        const failedStep = originalPlan.tasks.find(s => s.taskId === failure.stepId);
        if (!failedStep)
            return undefined;
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
    async localRepair(plan, failedStep, failure) {
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
    async replanFromFailure(originalPlan, failedStep, failure) {
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
    createInitialState() {
        return {
            predicates: new Map(),
            resources: new Map(),
            time: 0,
            variables: new Map(),
        };
    }
    createInitialStats() {
        return {
            nodesExpanded: 0,
            nodesEvaluated: 0,
            timeElapsed: 0,
            memoryUsed: 0,
            depthReached: 0,
            branchingFactor: 0,
        };
    }
    createPlanStep(task, startTime) {
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
    createPlan(steps) {
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
    canExecute(task, time) {
        return this.checkPreconditions(task.preconditions) &&
            this.checkResourceAvailability(task.resources);
    }
    checkPreconditions(conditions) {
        return conditions.every(c => this.evaluateCondition(c));
    }
    evaluateCondition(condition) {
        // Simplified condition evaluation
        return condition.satisfied;
    }
    checkResourceAvailability(requirements) {
        return requirements.every(req => {
            const available = this.worldState.resources.get(req.resourceType) || 0;
            return available >= req.amount;
        });
    }
    // DEPRECATED: Use applyEffectsToState instead to avoid race conditions
    // This method modifies shared state and should not be used in concurrent planning
    applyEffects(effects) {
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
    addPredicate(predicate, params) {
        if (!this.worldState.predicates.has(predicate)) {
            this.worldState.predicates.set(predicate, new Set());
        }
        const predicateSet = this.worldState.predicates.get(predicate);
        if (predicateSet) {
            predicateSet.add(JSON.stringify(params));
        }
    }
    deletePredicate(predicate, params) {
        this.worldState.predicates.get(predicate)?.delete(JSON.stringify(params));
    }
    modifyPredicate(predicate, params) {
        this.deletePredicate(predicate, params.slice(0, -1));
        this.addPredicate(predicate, params);
    }
    getApplicableActions(state) {
        return Array.from(this.tasks.values()).filter(task => task.type === 'atomic' && this.canExecute(task, state.time));
    }
    applyAction(state, action) {
        const newState = this.cloneState(state);
        for (const effect of action.effects) {
            this.applyEffectToState(newState, effect);
        }
        newState.time += action.estimatedDuration;
        return newState;
    }
    applyEffectToState(state, effect) {
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
    cloneState(state) {
        return {
            predicates: new Map(Array.from(state.predicates.entries()).map(([k, v]) => [k, new Set(v)])),
            resources: new Map(state.resources),
            time: state.time,
            variables: new Map(state.variables),
        };
    }
    hashState(state) {
        const predicateHash = Array.from(state.predicates.entries())
            .sort()
            .map(([k, v]) => `${k}:${Array.from(v).sort().join(',')}`)
            .join('|');
        return predicateHash;
    }
    isGoalReached(state, goal) {
        return this.checkPreconditions(goal.preconditions);
    }
    estimateGoalDistance(state, goal) {
        // Simple heuristic: count unsatisfied preconditions
        return goal.preconditions.filter(c => !this.evaluateCondition(c)).length;
    }
    calculatePlanCost(steps) {
        return steps.reduce((sum, step) => {
            const task = this.tasks.get(step.taskId);
            return sum + (task?.priority || 0);
        }, 0);
    }
    calculateReliability(steps) {
        if (steps.length === 0)
            return 1.0;
        const reliability = steps.reduce((product, step) => {
            const taskReliability = step.effects.reduce((p, e) => p * e.probability, 1.0);
            return product * taskReliability;
        }, 1.0);
        return reliability;
    }
    calculateParallelism(steps) {
        if (steps.length === 0)
            return 0;
        const timeSlots = new Map();
        for (const step of steps) {
            for (let t = step.startTime; t < step.endTime; t++) {
                timeSlots.set(t, (timeSlots.get(t) || 0) + 1);
            }
        }
        return Math.max(...Array.from(timeSlots.values()));
    }
    validatePlan(plan) {
        // Check all constraints are satisfied
        return plan.tasks.every(step => {
            const task = this.tasks.get(step.taskId);
            return task?.constraints.every(c => c.validate(this.worldState, plan)) || false;
        });
    }
    extractPlanningVariables(goal) {
        // Extract variables from goal and related tasks
        return ['task', 'time', 'resource']; // Simplified
    }
    buildConstraintGraph(goal) {
        return []; // Simplified
    }
    initializeDomains(variables) {
        const domains = new Map();
        for (const variable of variables) {
            domains.set(variable, []); // Populate with actual domain values
        }
        return domains;
    }
    assignmentToPlan(assignment, goal) {
        // Convert CSP assignment to plan
        return this.createPlan([]);
    }
    findAlternativeActions(step) {
        // Find alternative tasks that achieve same effects
        return [];
    }
    replacePlanStep(plan, oldStep, newTask) {
        const newSteps = plan.tasks.map(s => s === oldStep ? this.createPlanStep(newTask, s.startTime) : s);
        return this.createPlan(newSteps);
    }
    extractRemainingGoal(plan, failedStep) {
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
    reconstructStateAt(plan, step) {
        // Reconstruct world state at the point of failure
        return this.cloneState(this.worldState);
    }
    mergePlans(original, failedStep, newPlan) {
        const completedSteps = original.tasks.filter(s => s.endTime < failedStep.startTime);
        const mergedSteps = [...completedSteps, ...newPlan.tasks];
        return this.createPlan(mergedSteps);
    }
    generateId() {
        return `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    // ========================================================================
    // Task and Method Registration
    // ========================================================================
    registerTask(task) {
        this.tasks.set(task.id, task);
        this.emit('task:registered', { task });
    }
    registerMethod(method) {
        if (!this.methods.has(method.taskName)) {
            this.methods.set(method.taskName, []);
        }
        const methods = this.methods.get(method.taskName);
        if (methods) {
            methods.push(method);
        }
        this.emit('method:registered', { method });
    }
    getTask(id) {
        return this.tasks.get(id);
    }
    getMethods(taskName) {
        return this.methods.get(taskName) || [];
    }
}
exports.PlanningEngine = PlanningEngine;
// ============================================================================
// Export
// ============================================================================
exports.default = PlanningEngine;
