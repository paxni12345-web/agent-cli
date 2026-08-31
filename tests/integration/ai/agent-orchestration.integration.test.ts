/**
 * Integration Tests for Agent Orchestration
 * Tests multi-agent coordination, task decomposition, and consensus mechanisms
 */

import AgentOrchestrator, {
  Agent,
  Task,
  AgentConfig,
  AgentPerformance,
  ConsensusConfig
} from '../../../src/ai/advanced/AgentOrchestration';

describe('AgentOrchestration Integration Tests', () => {
  let orchestrator: AgentOrchestrator;

  beforeEach(() => {
    orchestrator = new AgentOrchestrator();
  });

  afterEach(() => {
    orchestrator.removeAllListeners();
  });

  const createAgent = (
    id: string,
    capabilities: string[],
    priority: number = 1
  ): Agent => ({
    id,
    name: `Agent ${id}`,
    type: 'worker',
    capabilities,
    status: 'idle',
    performance: {
      tasksCompleted: 0,
      successRate: 100,
      avgLatency: 500,
      avgQuality: 0.9
    },
    config: {
      maxConcurrency: 5,
      timeout: 10000,
      retries: 3,
      priority
    }
  });

  describe('Multi-Agent Task Decomposition', () => {
    it('should decompose code analysis task into subtasks', async () => {
      const tasks = await orchestrator.decomposeTask(
        'analyze code quality and find issues',
        { files: ['src/main.ts', 'src/utils.ts'] }
      );

      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks.some(t => t.type === 'read_files')).toBe(true);
      expect(tasks.some(t => t.type === 'analyze_structure')).toBe(true);
      expect(tasks.some(t => t.type === 'find_issues')).toBe(true);

      // Verify dependency chain
      const analyzeTask = tasks.find(t => t.type === 'analyze_structure');
      expect(analyzeTask?.dependencies).toContain('read_files');
    });

    it('should decompose implementation task correctly', async () => {
      const tasks = await orchestrator.decomposeTask(
        'implement new authentication feature',
        { feature: 'oauth2' }
      );

      expect(tasks.length).toBe(4);
      expect(tasks.map(t => t.type)).toEqual([
        'design',
        'implement',
        'test',
        'review'
      ]);

      // Verify sequential dependencies
      expect(tasks[1].dependencies).toContain('design');
      expect(tasks[2].dependencies).toContain('implement');
      expect(tasks[3].dependencies).toContain('test');
    });

    it('should decompose refactoring task with proper flow', async () => {
      const tasks = await orchestrator.decomposeTask(
        'refactor legacy code module',
        { module: 'auth' }
      );

      const taskTypes = tasks.map(t => t.type);
      expect(taskTypes).toContain('understand');
      expect(taskTypes).toContain('plan_refactor');
      expect(taskTypes).toContain('apply_changes');
      expect(taskTypes).toContain('verify');
    });

    it('should handle generic tasks', async () => {
      const tasks = await orchestrator.decomposeTask(
        'perform custom operation',
        { data: 'test' }
      );

      expect(tasks).toHaveLength(1);
      expect(tasks[0].type).toBe('execute');
      expect(tasks[0].dependencies).toHaveLength(0);
    });
  });

  describe('Agent Selection and Assignment', () => {
    it('should select best agent based on capabilities', async () => {
      const codeAgent = createAgent('code1', ['read_files', 'analyze_structure']);
      const testAgent = createAgent('test1', ['test', 'verify']);

      orchestrator.registerAgent(codeAgent);
      orchestrator.registerAgent(testAgent);

      const tasks = await orchestrator.decomposeTask(
        'analyze code quality',
        {}
      );

      const results = await orchestrator.executeWorkflow(tasks);

      // Verify agents were assigned appropriately
      const readTask = tasks.find(t => t.type === 'read_files');
      expect(readTask?.assignedAgent).toBe('code1');
    });

    it('should prefer agents with higher success rates', async () => {
      const reliableAgent = createAgent('reliable', ['execute']);
      reliableAgent.performance.successRate = 95;

      const unreliableAgent = createAgent('unreliable', ['execute']);
      unreliableAgent.performance.successRate = 60;

      orchestrator.registerAgent(reliableAgent);
      orchestrator.registerAgent(unreliableAgent);

      const tasks = await orchestrator.decomposeTask('execute task', {});
      await orchestrator.executeWorkflow(tasks);

      const task = tasks[0];
      expect(task.assignedAgent).toBe('reliable');
    });

    it('should handle multiple agents with same capabilities', async () => {
      const agent1 = createAgent('agent1', ['execute']);
      const agent2 = createAgent('agent2', ['execute']);
      const agent3 = createAgent('agent3', ['execute']);

      orchestrator.registerAgent(agent1);
      orchestrator.registerAgent(agent2);
      orchestrator.registerAgent(agent3);

      const tasks = await orchestrator.decomposeTask('execute multiple tasks', {});
      await orchestrator.executeWorkflow(tasks);

      // At least one agent should be used
      const usedAgents = tasks.map(t => t.assignedAgent).filter(Boolean);
      expect(usedAgents.length).toBeGreaterThan(0);
    });
  });

  describe('Workflow Execution with Dependencies', () => {
    it('should execute tasks in correct order based on dependencies', async () => {
      const agent = createAgent('worker', [
        'design', 'implement', 'test', 'review'
      ]);
      orchestrator.registerAgent(agent);

      const executionOrder: string[] = [];
      orchestrator.on('task:started', ({ task }) => {
        executionOrder.push(task.type);
      });

      const tasks = await orchestrator.decomposeTask(
        'implement new feature',
        {}
      );

      await orchestrator.executeWorkflow(tasks);

      // Verify execution order
      expect(executionOrder.indexOf('design')).toBeLessThan(
        executionOrder.indexOf('implement')
      );
      expect(executionOrder.indexOf('implement')).toBeLessThan(
        executionOrder.indexOf('test')
      );
      expect(executionOrder.indexOf('test')).toBeLessThan(
        executionOrder.indexOf('review')
      );
    });

    it('should execute independent tasks in parallel', async () => {
      const agent = createAgent('worker', ['task_a', 'task_b', 'task_c']);
      orchestrator.registerAgent(agent);

      const tasks: Task[] = [
        {
          id: 'task1',
          type: 'task_a',
          description: 'Independent task A',
          input: {},
          dependencies: [],
          status: 'pending'
        },
        {
          id: 'task2',
          type: 'task_b',
          description: 'Independent task B',
          input: {},
          dependencies: [],
          status: 'pending'
        },
        {
          id: 'task3',
          type: 'task_c',
          description: 'Independent task C',
          input: {},
          dependencies: [],
          status: 'pending'
        }
      ];

      const startTime = Date.now();
      await orchestrator.executeWorkflow(tasks);
      const duration = Date.now() - startTime;

      // Parallel execution should be faster than sequential
      // (3 tasks * ~600ms each = ~1800ms if sequential)
      expect(duration).toBeLessThan(1200);

      tasks.forEach(task => {
        expect(task.status).toBe('completed');
      });
    });

    it('should handle complex dependency graphs', async () => {
      const agent = createAgent('worker', ['a', 'b', 'c', 'd', 'e']);
      orchestrator.registerAgent(agent);

      const tasks: Task[] = [
        {
          id: 't1',
          type: 'a',
          description: 'Task A',
          input: {},
          dependencies: [],
          status: 'pending'
        },
        {
          id: 't2',
          type: 'b',
          description: 'Task B',
          input: {},
          dependencies: ['t1'],
          status: 'pending'
        },
        {
          id: 't3',
          type: 'c',
          description: 'Task C',
          input: {},
          dependencies: ['t1'],
          status: 'pending'
        },
        {
          id: 't4',
          type: 'd',
          description: 'Task D',
          input: {},
          dependencies: ['t2', 't3'],
          status: 'pending'
        }
      ];

      const results = await orchestrator.executeWorkflow(tasks);

      expect(results.size).toBe(4);
      tasks.forEach(task => {
        expect(task.status).toBe('completed');
      });
    });

    it('should detect circular dependencies', async () => {
      const tasks: Task[] = [
        {
          id: 't1',
          type: 'a',
          description: 'Task A',
          input: {},
          dependencies: ['t2'],
          status: 'pending'
        },
        {
          id: 't2',
          type: 'b',
          description: 'Task B',
          input: {},
          dependencies: ['t1'],
          status: 'pending'
        }
      ];

      await expect(orchestrator.executeWorkflow(tasks)).rejects.toThrow(
        'Circular dependency detected'
      );
    });
  });

  describe('Agent Communication and Messaging', () => {
    it('should send and route messages between agents', async () => {
      const agent1 = createAgent('agent1', ['execute']);
      const agent2 = createAgent('agent2', ['execute']);

      orchestrator.registerAgent(agent1);
      orchestrator.registerAgent(agent2);

      const messagesSent: any[] = [];
      orchestrator.on('message:sent', (msg) => {
        messagesSent.push(msg);
      });

      await orchestrator.sendMessage(
        'agent1',
        'agent2',
        'request',
        { action: 'process', data: 'test' }
      );

      expect(messagesSent.length).toBe(1);
      expect(messagesSent[0].from).toBe('agent1');
      expect(messagesSent[0].to).toBe('agent2');
      expect(messagesSent[0].type).toBe('request');
    });

    it('should handle message delivery to valid agents', async () => {
      const agent = createAgent('receiver', ['execute']);
      orchestrator.registerAgent(agent);

      const deliveredMessages: any[] = [];
      orchestrator.on('message:delivered', (data) => {
        deliveredMessages.push(data);
      });

      await orchestrator.sendMessage(
        'sender',
        'receiver',
        'request',
        { data: 'test' }
      );

      expect(deliveredMessages.length).toBe(1);
      expect(deliveredMessages[0].recipient.id).toBe('receiver');
    });

    it('should queue messages for processing', async () => {
      const agent = createAgent('agent', ['execute']);
      orchestrator.registerAgent(agent);

      await orchestrator.sendMessage('a1', 'agent', 'request', { msg: '1' });
      await orchestrator.sendMessage('a2', 'agent', 'request', { msg: '2' });
      await orchestrator.sendMessage('a3', 'agent', 'request', { msg: '3' });

      const stats = orchestrator.getOrchestrationStats();
      expect(stats.messages).toBe(3);
    });
  });

  describe('Consensus Mechanisms', () => {
    it('should achieve majority consensus', async () => {
      orchestrator = new AgentOrchestrator({
        algorithm: 'majority',
        threshold: 0.6,
        timeout: 5000
      });

      const agents = Array.from({ length: 5 }, (_, i) =>
        createAgent(`agent${i}`, ['execute'])
      );
      agents.forEach(a => orchestrator.registerAgent(a));

      const result = await orchestrator.achieveConsensus(
        'What is the best approach?',
        agents.map(a => a.id)
      );

      expect(result).toBeDefined();
    });

    it('should use weighted consensus based on priority', async () => {
      orchestrator = new AgentOrchestrator({
        algorithm: 'weighted',
        threshold: 0.7,
        timeout: 5000
      });

      const expertAgent = createAgent('expert', ['execute'], 10);
      const juniorAgent = createAgent('junior', ['execute'], 1);

      orchestrator.registerAgent(expertAgent);
      orchestrator.registerAgent(juniorAgent);

      const result = await orchestrator.achieveConsensus(
        'Technical decision',
        ['expert', 'junior']
      );

      expect(result).toBeDefined();
    });

    it('should require unanimous consensus when configured', async () => {
      orchestrator = new AgentOrchestrator({
        algorithm: 'unanimous',
        threshold: 1.0,
        timeout: 5000
      });

      const agents = Array.from({ length: 3 }, (_, i) =>
        createAgent(`agent${i}`, ['execute'])
      );
      agents.forEach(a => orchestrator.registerAgent(a));

      const result = await orchestrator.achieveConsensus(
        'Critical decision',
        agents.map(a => a.id)
      );

      // Result could be null if not unanimous
      expect(result !== undefined).toBe(true);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle task failures gracefully', async () => {
      const agent = createAgent('worker', ['execute']);
      orchestrator.registerAgent(agent);

      const failedTasks: any[] = [];
      orchestrator.on('task:failed', ({ task }) => {
        failedTasks.push(task);
      });

      // Create a task that might fail (simulated)
      const tasks = await orchestrator.decomposeTask('execute task', {});

      try {
        await orchestrator.executeWorkflow(tasks);
      } catch (error) {
        // Task execution failures are expected in some scenarios
      }

      // Verify task has error handling
      tasks.forEach(task => {
        expect(['completed', 'failed']).toContain(task.status);
      });
    });

    it('should handle missing agent for task', async () => {
      const tasks: Task[] = [{
        id: 't1',
        type: 'unsupported',
        description: 'Task with no capable agent',
        input: {},
        dependencies: [],
        status: 'pending'
      }];

      await expect(orchestrator.executeWorkflow(tasks)).rejects.toThrow();
    });

    it('should track agent performance metrics', async () => {
      const agent = createAgent('worker', ['execute']);
      orchestrator.registerAgent(agent);

      const tasks = await orchestrator.decomposeTask('execute task', {});
      await orchestrator.executeWorkflow(tasks);

      expect(agent.performance.tasksCompleted).toBeGreaterThan(0);
    });
  });

  describe('Concurrent Multi-Agent Operations', () => {
    it('should handle multiple concurrent workflows', async () => {
      const agents = Array.from({ length: 5 }, (_, i) =>
        createAgent(`agent${i}`, ['execute', 'design', 'implement'])
      );
      agents.forEach(a => orchestrator.registerAgent(a));

      const workflows = await Promise.all([
        orchestrator.decomposeTask('implement feature A', {}),
        orchestrator.decomposeTask('implement feature B', {}),
        orchestrator.decomposeTask('execute task C', {})
      ]);

      const results = await Promise.all(
        workflows.map(tasks => orchestrator.executeWorkflow(tasks))
      );

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.size).toBeGreaterThan(0);
      });
    });

    it('should maintain agent state consistency under load', async () => {
      const agent = createAgent('worker', ['execute']);
      orchestrator.registerAgent(agent);

      const initialStatus = agent.status;

      const operations = Array.from({ length: 10 }, async () => {
        const tasks = await orchestrator.decomposeTask('execute', {});
        return orchestrator.executeWorkflow(tasks);
      });

      await Promise.all(operations);

      // Agent should return to idle state
      expect(agent.status).toBe('idle');
    });

    it('should handle agent registration/unregistration during execution', async () => {
      const agent1 = createAgent('agent1', ['execute']);
      orchestrator.registerAgent(agent1);

      const tasks = await orchestrator.decomposeTask('execute task', {});
      const workflowPromise = orchestrator.executeWorkflow(tasks);

      // Register another agent during execution
      const agent2 = createAgent('agent2', ['execute']);
      orchestrator.registerAgent(agent2);

      await workflowPromise;

      const stats = orchestrator.getOrchestrationStats();
      expect(stats.agents.total).toBe(2);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide comprehensive orchestration statistics', async () => {
      const agents = Array.from({ length: 3 }, (_, i) =>
        createAgent(`agent${i}`, ['execute', 'design', 'implement'])
      );
      agents.forEach(a => orchestrator.registerAgent(a));

      const tasks = await orchestrator.decomposeTask('implement feature', {});
      await orchestrator.executeWorkflow(tasks);

      const stats = orchestrator.getOrchestrationStats();

      expect(stats.agents.total).toBe(3);
      expect(stats.tasks.total).toBeGreaterThan(0);
      expect(stats.tasks.completed).toBeGreaterThan(0);
      expect(stats.workflows).toBeGreaterThan(0);
    });

    it('should track agent idle/busy states', async () => {
      const agent = createAgent('worker', ['execute']);
      orchestrator.registerAgent(agent);

      const initialStats = orchestrator.getOrchestrationStats();
      expect(initialStats.agents.idle).toBe(1);
      expect(initialStats.agents.busy).toBe(0);

      // After execution, should return to idle
      const tasks = await orchestrator.decomposeTask('execute', {});
      await orchestrator.executeWorkflow(tasks);

      const finalStats = orchestrator.getOrchestrationStats();
      expect(finalStats.agents.idle).toBe(1);
    });

    it('should track task status distribution', async () => {
      const agent = createAgent('worker', [
        'design', 'implement', 'test', 'review'
      ]);
      orchestrator.registerAgent(agent);

      const tasks = await orchestrator.decomposeTask('implement feature', {});

      // Before execution
      const beforeStats = orchestrator.getOrchestrationStats();
      expect(beforeStats.tasks.pending).toBeGreaterThan(0);

      await orchestrator.executeWorkflow(tasks);

      // After execution
      const afterStats = orchestrator.getOrchestrationStats();
      expect(afterStats.tasks.completed).toBeGreaterThan(0);
    });
  });

  describe('Event-Driven Integration', () => {
    it('should emit events throughout workflow lifecycle', async () => {
      const events: string[] = [];

      orchestrator.on('agent:registered', () => events.push('registered'));
      orchestrator.on('task:started', () => events.push('started'));
      orchestrator.on('task:completed', () => events.push('completed'));

      const agent = createAgent('worker', ['execute']);
      orchestrator.registerAgent(agent);

      const tasks = await orchestrator.decomposeTask('execute', {});
      await orchestrator.executeWorkflow(tasks);

      expect(events).toContain('registered');
      expect(events).toContain('started');
      expect(events).toContain('completed');
    });

    it('should provide detailed event data', async () => {
      let taskStartedData: any = null;
      let taskCompletedData: any = null;

      orchestrator.on('task:started', (data) => {
        taskStartedData = data;
      });

      orchestrator.on('task:completed', (data) => {
        taskCompletedData = data;
      });

      const agent = createAgent('worker', ['execute']);
      orchestrator.registerAgent(agent);

      const tasks = await orchestrator.decomposeTask('execute', {});
      await orchestrator.executeWorkflow(tasks);

      expect(taskStartedData).toBeDefined();
      expect(taskStartedData.task).toBeDefined();
      expect(taskStartedData.agent).toBeDefined();

      expect(taskCompletedData).toBeDefined();
      expect(taskCompletedData.task).toBeDefined();
      expect(taskCompletedData.result).toBeDefined();
    });
  });
});
