// Advanced Planning System with Dependency Graphs and Cost Estimation

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

export class AdvancedPlanner {
  private stepCounter = 0;

  async createPlan(
    goal: string,
    context: {
      workspace: string;
      availableTools: string[];
      constraints?: {
        maxCost?: number;
        maxTime?: number;
        allowedRisk?: 'low' | 'medium' | 'high';
      };
    }
  ): Promise<ExecutionPlan> {
    const steps = await this.decomposeGoal(goal, context);
    const orderedSteps = this.orderByDependencies(steps);
    const optimizedSteps = this.optimizePlan(orderedSteps, context.constraints);

    const totalCost = optimizedSteps.reduce((sum, step) => sum + step.estimatedCost, 0);
    const criticalPath = this.calculateCriticalPath(optimizedSteps);
    const totalTime = criticalPath.reduce((sum, step) => sum + step.estimatedTime, 0);

    return {
      id: this.generatePlanId(),
      goal,
      steps: optimizedSteps,
      totalEstimatedCost: totalCost,
      totalEstimatedTime: totalTime,
      overallRisk: this.assessOverallRisk(optimizedSteps),
      createdAt: new Date(),
      validationCriteria: this.generateValidationCriteria(goal),
    };
  }

  async generateAlternativePlans(
    goal: string,
    context: any,
    count: number = 3
  ): Promise<AlternativePlan[]> {
    const alternatives: AlternativePlan[] = [];

    // Generate base plan
    const basePlan = await this.createPlan(goal, context);

    // Strategy 1: Minimize cost
    const costOptimized = await this.createPlanWithStrategy(goal, context, 'minimize_cost');
    alternatives.push({
      plan: costOptimized,
      score: this.scorePlan(costOptimized, 'cost'),
      reasoning: 'Optimized for minimal cost',
    });

    // Strategy 2: Minimize time
    const timeOptimized = await this.createPlanWithStrategy(goal, context, 'minimize_time');
    alternatives.push({
      plan: timeOptimized,
      score: this.scorePlan(timeOptimized, 'time'),
      reasoning: 'Optimized for fastest execution',
    });

    // Strategy 3: Minimize risk
    const riskOptimized = await this.createPlanWithStrategy(goal, context, 'minimize_risk');
    alternatives.push({
      plan: riskOptimized,
      score: this.scorePlan(riskOptimized, 'risk'),
      reasoning: 'Optimized for lowest risk',
    });

    return alternatives.sort((a, b) => b.score - a.score).slice(0, count);
  }

  private async createPlanWithStrategy(
    goal: string,
    context: any,
    strategy: 'minimize_cost' | 'minimize_time' | 'minimize_risk'
  ): Promise<ExecutionPlan> {
    const steps = await this.decomposeGoal(goal, context);
    let optimizedSteps: PlanStep[];

    switch (strategy) {
      case 'minimize_cost':
        optimizedSteps = this.optimizeForCost(steps);
        break;
      case 'minimize_time':
        optimizedSteps = this.optimizeForTime(steps);
        break;
      case 'minimize_risk':
        optimizedSteps = this.optimizeForRisk(steps);
        break;
    }

    const totalCost = optimizedSteps.reduce((sum, step) => sum + step.estimatedCost, 0);
    const totalTime = optimizedSteps.reduce((sum, step) => sum + step.estimatedTime, 0);

    return {
      id: this.generatePlanId(),
      goal,
      steps: optimizedSteps,
      totalEstimatedCost: totalCost,
      totalEstimatedTime: totalTime,
      overallRisk: this.assessOverallRisk(optimizedSteps),
      createdAt: new Date(),
      validationCriteria: this.generateValidationCriteria(goal),
    };
  }

  private async decomposeGoal(goal: string, context: any): Promise<PlanStep[]> {
    // This would use AI to decompose the goal
    // For now, return example decomposition
    const steps: PlanStep[] = [];

    // Example: "Create a todo app"
    if (goal.toLowerCase().includes('todo')) {
      steps.push(
        this.createStep('Inspect project structure', 'list_files', { path: '.' }, []),
        this.createStep('Check dependencies', 'read_file', { path: 'package.json' }, ['step-1']),
        this.createStep('Create component file', 'write_file', { path: 'src/TodoList.tsx' }, ['step-2']),
        this.createStep('Create test file', 'write_file', { path: 'src/TodoList.test.tsx' }, ['step-3']),
        this.createStep('Run tests', 'shell', { command: 'npm test' }, ['step-4']),
        this.createStep('Verify implementation', 'read_file', { path: 'src/TodoList.tsx' }, ['step-5'])
      );
    }

    return steps;
  }

  private createStep(
    description: string,
    tool: string,
    input: unknown,
    dependencies: string[]
  ): PlanStep {
    this.stepCounter++;
    return {
      id: `step-${this.stepCounter}`,
      description,
      tool,
      input,
      dependencies,
      estimatedCost: this.estimateStepCost(tool),
      estimatedTime: this.estimateStepTime(tool),
      risk: this.assessStepRisk(tool),
      priority: 1,
      status: 'pending',
    };
  }

  private estimateStepCost(tool: string): number {
    const costs: Record<string, number> = {
      list_files: 0.001,
      read_file: 0.002,
      write_file: 0.005,
      edit_file: 0.003,
      shell: 0.01,
      search_code: 0.005,
      git_status: 0.001,
      git_diff: 0.002,
      git_log: 0.002,
    };

    return costs[tool] || 0.005;
  }

  private estimateStepTime(tool: string): number {
    // Time in seconds
    const times: Record<string, number> = {
      list_files: 2,
      read_file: 1,
      write_file: 2,
      edit_file: 3,
      shell: 10,
      search_code: 5,
      git_status: 1,
      git_diff: 2,
      git_log: 1,
    };

    return times[tool] || 5;
  }

  private assessStepRisk(tool: string): 'low' | 'medium' | 'high' {
    const highRisk = ['write_file', 'edit_file', 'shell'];
    const mediumRisk = ['delete_file', 'git_commit'];

    if (highRisk.includes(tool)) return 'high';
    if (mediumRisk.includes(tool)) return 'medium';
    return 'low';
  }

  private orderByDependencies(steps: PlanStep[]): PlanStep[] {
    const ordered: PlanStep[] = [];
    const completed = new Set<string>();

    while (ordered.length < steps.length) {
      let addedThisRound = false;

      for (const step of steps) {
        if (completed.has(step.id)) continue;

        const allDependenciesMet = step.dependencies.every(dep =>
          completed.has(dep)
        );

        if (allDependenciesMet) {
          ordered.push(step);
          completed.add(step.id);
          addedThisRound = true;
        }
      }

      if (!addedThisRound && ordered.length < steps.length) {
        // Circular dependency detected - break it
        const remaining = steps.filter(s => !completed.has(s.id));
        if (remaining.length > 0) {
          ordered.push(remaining[0]);
          completed.add(remaining[0].id);
        }
      }
    }

    return ordered;
  }

  private optimizePlan(
    steps: PlanStep[],
    constraints?: {
      maxCost?: number;
      maxTime?: number;
      allowedRisk?: 'low' | 'medium' | 'high';
    }
  ): PlanStep[] {
    let optimized = [...steps];

    // Remove redundant steps
    optimized = this.removeRedundantSteps(optimized);

    // Merge compatible steps
    optimized = this.mergeCompatibleSteps(optimized);

    // Apply constraints
    if (constraints?.maxCost) {
      optimized = this.applyCostConstraint(optimized, constraints.maxCost);
    }

    if (constraints?.allowedRisk) {
      optimized = this.applyRiskConstraint(optimized, constraints.allowedRisk);
    }

    return optimized;
  }

  private removeRedundantSteps(steps: PlanStep[]): PlanStep[] {
    // Remove duplicate reads of the same file
    const seen = new Set<string>();
    return steps.filter(step => {
      if (step.tool === 'read_file') {
        const key = JSON.stringify(step.input);
        if (seen.has(key)) return false;
        seen.add(key);
      }
      return true;
    });
  }

  private mergeCompatibleSteps(steps: PlanStep[]): PlanStep[] {
    // Merge multiple list_files calls into one
    // This is a simplified example
    return steps;
  }

  private applyCostConstraint(steps: PlanStep[], maxCost: number): PlanStep[] {
    // Prioritize essential steps within budget
    const totalCost = steps.reduce((sum, s) => sum + s.estimatedCost, 0);
    if (totalCost <= maxCost) return steps;

    // Sort by priority and keep steps within budget
    const sorted = steps.sort((a, b) => b.priority - a.priority);
    const kept: PlanStep[] = [];
    let currentCost = 0;

    for (const step of sorted) {
      if (currentCost + step.estimatedCost <= maxCost) {
        kept.push(step);
        currentCost += step.estimatedCost;
      }
    }

    return kept;
  }

  private applyRiskConstraint(
    steps: PlanStep[],
    allowedRisk: 'low' | 'medium' | 'high'
  ): PlanStep[] {
    const riskLevels = { low: 1, medium: 2, high: 3 };
    const maxRisk = riskLevels[allowedRisk];

    return steps.map(step => {
      if (riskLevels[step.risk] > maxRisk) {
        return { ...step, status: 'skipped' as const };
      }
      return step;
    });
  }

  private optimizeForCost(steps: PlanStep[]): PlanStep[] {
    return steps.sort((a, b) => a.estimatedCost - b.estimatedCost);
  }

  private optimizeForTime(steps: PlanStep[]): PlanStep[] {
    // Identify steps that can run in parallel
    return this.identifyParallelSteps(steps);
  }

  private optimizeForRisk(steps: PlanStep[]): PlanStep[] {
    const riskOrder = { low: 1, medium: 2, high: 3 };
    return steps.sort((a, b) => riskOrder[a.risk] - riskOrder[b.risk]);
  }

  private identifyParallelSteps(steps: PlanStep[]): PlanStep[] {
    // Mark independent steps for parallel execution
    const canRunInParallel = new Map<string, string[]>();

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const independentSteps: string[] = [];

      for (let j = i + 1; j < steps.length; j++) {
        const other = steps[j];

        // Check if they don't depend on each other
        const stepDependsOnOther = step.dependencies.includes(other.id);
        const otherDependsOnStep = other.dependencies.includes(step.id);

        if (!stepDependsOnOther && !otherDependsOnStep) {
          independentSteps.push(other.id);
        }
      }

      if (independentSteps.length > 0) {
        canRunInParallel.set(step.id, independentSteps);
      }
    }

    return steps;
  }

  private calculateCriticalPath(steps: PlanStep[]): PlanStep[] {
    // Find the longest path through dependencies
    const criticalPath: PlanStep[] = [];
    let currentStep = steps[steps.length - 1];

    while (currentStep) {
      criticalPath.unshift(currentStep);

      // Find the dependency with the longest time
      const deps = steps.filter(s => currentStep.dependencies.includes(s.id));
      currentStep = deps.sort((a, b) => b.estimatedTime - a.estimatedTime)[0];
    }

    return criticalPath;
  }

  private assessOverallRisk(steps: PlanStep[]): 'low' | 'medium' | 'high' {
    const highRiskCount = steps.filter(s => s.risk === 'high').length;
    const mediumRiskCount = steps.filter(s => s.risk === 'medium').length;

    if (highRiskCount > 2) return 'high';
    if (highRiskCount > 0 || mediumRiskCount > 3) return 'medium';
    return 'low';
  }

  private generateValidationCriteria(goal: string): string[] {
    // Generate criteria based on goal
    return [
      'All planned steps completed successfully',
      'No errors in final verification',
      'Tests pass (if applicable)',
      'Code quality meets standards',
    ];
  }

  private scorePlan(plan: ExecutionPlan, optimizeFor: 'cost' | 'time' | 'risk'): number {
    const weights = {
      cost: { cost: 0.7, time: 0.2, risk: 0.1 },
      time: { cost: 0.2, time: 0.7, risk: 0.1 },
      risk: { cost: 0.2, time: 0.1, risk: 0.7 },
    };

    const w = weights[optimizeFor];

    // Normalize scores (lower is better, so invert)
    const costScore = 1 / (1 + plan.totalEstimatedCost);
    const timeScore = 1 / (1 + plan.totalEstimatedTime);
    const riskScore = plan.overallRisk === 'low' ? 1 : plan.overallRisk === 'medium' ? 0.5 : 0.2;

    return w.cost * costScore + w.time * timeScore + w.risk * riskScore;
  }

  private generatePlanId(): string {
    return `plan-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  visualizePlan(plan: ExecutionPlan): string {
    let viz = '📋 Execution Plan\n\n';
    viz += `Goal: ${plan.goal}\n`;
    viz += `Steps: ${plan.steps.length}\n`;
    viz += `Estimated Cost: $${plan.totalEstimatedCost.toFixed(4)}\n`;
    viz += `Estimated Time: ${plan.totalEstimatedTime}s\n`;
    viz += `Risk Level: ${plan.overallRisk}\n\n`;

    viz += 'Steps:\n';
    for (const step of plan.steps) {
      const deps = step.dependencies.length > 0
        ? ` (depends on: ${step.dependencies.join(', ')})`
        : '';
      viz += `  ${step.id}. ${step.description}${deps}\n`;
      viz += `     Tool: ${step.tool} | Cost: $${step.estimatedCost.toFixed(4)} | Time: ${step.estimatedTime}s | Risk: ${step.risk}\n`;
    }

    return viz;
  }
}
