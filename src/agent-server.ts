import express from 'express';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { Agent } from './agent/Agent.js';
import { AnthropicProvider } from './providers/AnthropicProvider.js';
import { createDefaultToolRegistry } from './tools/index.js';
import { Action, PermissionManager, PermissionResult, Config } from './types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.AGENT_SERVER_HOST || '127.0.0.1';
const ALLOWED_ORIGINS = process.env.AGENT_SERVER_ORIGIN
  ?.split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors(ALLOWED_ORIGINS ? { origin: ALLOWED_ORIGINS } : { origin: false }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '../../public')));

class ServerPermissionManager implements PermissionManager {
  constructor(private readonly allowMutations: boolean) {}

  check(action: Action): PermissionResult {
    if (!this.allowMutations) {
      if (action.risk === 'safe' || (action.type === 'read_file' && action.risk === 'medium')) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Server is read-only; set AGENT_SERVER_ALLOW_MUTATIONS=true to enable writes' };
    }

    if (action.risk === 'critical') {
      return { allowed: false, reason: 'Critical risk actions are never allowed by the server' };
    }
    return { allowed: true };
  }

  async requestApproval(_action: Action): Promise<boolean> {
    return false;
  }
}

let agent: Agent | null = null;
let config: Config;
let requestInProgress = false;

function initializeAgent(): Agent {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required to start the agent server');
  }

  const allowMutations = process.env.AGENT_SERVER_ALLOW_MUTATIONS === 'true';

  config = {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    apiKey,
    permissionMode: allowMutations ? 'auto' : 'safe',
    maxIterations: 20,
    temperature: 0.7,
    workspaceRoot: process.cwd(),
    debug: false,
    enableToolRetry: true,
    maxToolRetries: 3,
    enableToolCache: true,
    toolTimeout: 30000,
    validateToolInputs: true,
    autoRecovery: true,
    strictToolCalling: true,
  };

  const provider = new AnthropicProvider(apiKey, { model: config.model });
  const permissions = new ServerPermissionManager(allowMutations);
  const toolRegistry = createDefaultToolRegistry();

  agent = new Agent(provider, toolRegistry, permissions, config);
  return agent;
}

function getAgent(): Agent {
  if (!agent) {
    return initializeAgent();
  }
  return agent;
}

app.post('/api/agent/run', async (req, res) => {
  try {
    const { message, config: clientConfig } = req.body;

    if (typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({ error: 'Message must be a non-empty string' });
      return;
    }
    if (message.length > 100_000) {
      res.status(413).json({ error: 'Message is too large (maximum 100000 characters)' });
      return;
    }
    if (clientConfig !== undefined && (typeof clientConfig !== 'object' || clientConfig === null)) {
      res.status(400).json({ error: 'config must be an object' });
      return;
    }
    if (requestInProgress) {
      res.status(409).json({ error: 'Another agent request is already in progress' });
      return;
    }

    requestInProgress = true;
    const currentAgent = getAgent();

    if (clientConfig) {
      currentAgent.updateConfig({
        enableToolRetry: clientConfig.retry ?? true,
        enableToolCache: clientConfig.cache ?? true,
        validateToolInputs: clientConfig.validation ?? true,
        autoRecovery: clientConfig.recovery ?? true,
        debug: clientConfig.debug ?? false,
      });
    }

    const startTime = Date.now();
    const response = await currentAgent.run(message);
    const duration = Date.now() - startTime;

    const state = currentAgent.getState();
    const report = currentAgent.getPerformanceMonitor().generateReport();

    const toolUsage: Record<string, number> = {};
    state.history.forEach(exec => {
      toolUsage[exec.tool] = (toolUsage[exec.tool] || 0) + 1;
    });

    res.json({
      response,
      duration,
      toolExecutions: state.history.slice(-10),
      stats: {
        totalCalls: report.overview.totalExecutions,
        successCalls: report.overview.totalSuccess,
        avgDuration: report.overview.avgExecutionTime,
        iterations: state.iterationCount,
      },
      toolUsage,
    });
  } catch (error: any) {
    console.error('Agent error:', error);
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  } finally {
    requestInProgress = false;
  }
});

app.get('/api/agent/status', (_req, res) => {
  if (!agent) {
    res.json({ status: 'not_initialized', tools: [] });
    return;
  }

  const state = agent.getState();
  const tools = agent.getToolRegistry().list().map(t => ({
    name: t.name,
    description: t.description,
  }));

  res.json({
    status: state.status,
    tools,
    iterations: state.iterationCount,
    historyLength: state.history.length,
  });
});

app.get('/api/agent/report', (_req, res) => {
  if (!agent) {
    res.json({ error: 'Agent not initialized' });
    return;
  }

  const report = agent.getPerformanceMonitor().generateReport();

  res.json({
    overview: report.overview,
    slowestTools: report.slowestTools,
    mostUnreliable: report.mostUnreliable,
    recommendations: report.recommendations,
  });
});

app.get('/api/agent/metrics/:toolName', (req, res) => {
  if (!agent) {
    res.json({ error: 'Agent not initialized' });
    return;
  }

  const metrics = agent.getPerformanceMonitor().getToolMetrics(req.params.toolName);

  if (!metrics) {
    res.status(404).json({ error: 'Tool not found' });
    return;
  }

  res.json({
    ...metrics,
    errorTypes: Array.from(metrics.errorTypes.entries()),
  });
});

app.get('/api/agent/export', (_req, res) => {
  if (!agent) {
    res.json({ error: 'Agent not initialized' });
    return;
  }

  const data = agent.exportPerformanceData();

  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=agent-metrics-${Date.now()}.json`
  );
  res.send(data);
});

app.post('/api/agent/clear', (_req, res) => {
  if (agent) {
    agent.reset();
    res.json({ success: true });
  } else {
    res.json({ error: 'Agent not initialized' });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, HOST, () => {
    console.log(`
================================================================================

  Agent CLI Web Server

  Server running at:
  http://localhost:${PORT}

  Endpoints:
  - POST /api/agent/run        Run agent with message
  - GET  /api/agent/status     Get agent status
  - GET  /api/agent/report     Performance report
  - GET  /api/agent/export     Export metrics
  - POST /api/agent/clear      Clear agent state
  - GET  /api/health           Health check

================================================================================
  `);

    try {
      initializeAgent();
    } catch (err) {
      console.error('Failed to initialize agent:', err);
      console.log('Agent will be initialized on first request');
    }
  });
}

export default app;
