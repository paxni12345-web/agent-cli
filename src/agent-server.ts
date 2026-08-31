/**
 * Agent API Server - Full integration with Agent system
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { Agent } from './agent/Agent.js';
import { ToolRegistry } from './tools/ToolRegistry.js';
import { AnthropicProvider } from './providers/AnthropicProvider.js';
import { PermissionManager, Config } from './types/index.js';

// Import tools
import { ReadFileTool, WriteFileTool, ListFilesTool, EditFileTool } from './tools/FileTools.js';
import { ShellTool } from './tools/ShellTool.js';
import { SearchCodeTool } from './tools/SearchTool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// Simple permission manager for demo
class SimplePermissionManager implements PermissionManager {
  check(action: any) {
    return { allowed: true };
  }

  async requestApproval(action: any): Promise<boolean> {
    return true;
  }
}

// Initialize agent components
let agent: Agent | null = null;
let toolRegistry: ToolRegistry | null = null;

function initializeAgent() {
  const apiKey = process.env.ANTHROPIC_API_KEY || 'demo-key';

  toolRegistry = new ToolRegistry();

  // Register tools
  try {
    const readFile = new ReadFileTool();
    const writeFile = new WriteFileTool();
    const listFiles = new ListFilesTool();
    const editFile = new EditFileTool();
    const shell = new ShellTool();
    const searchCode = new SearchCodeTool();

    toolRegistry.register(readFile);
    toolRegistry.register(writeFile);
    toolRegistry.register(listFiles);
    toolRegistry.register(editFile);
    toolRegistry.register(shell);
    toolRegistry.register(searchCode);
  } catch (err) {
    console.error('Error registering tools:', err);
  }

  const config: Config = {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    apiKey,
    permissionMode: 'auto',
    maxIterations: 20,
    temperature: 0.7,
    workspaceRoot: process.cwd(),
    debug: true,
    enableToolRetry: true,
    maxToolRetries: 3,
    enableToolCache: true,
    toolTimeout: 30000,
    validateToolInputs: true,
    autoRecovery: true,
    strictToolCalling: true,
  };

  const provider = new AnthropicProvider(apiKey);
  const permissions = new SimplePermissionManager();

  agent = new Agent(provider, toolRegistry, permissions, config);

  console.log('Agent initialized successfully');
}

// API Routes

// Run agent
app.post('/api/agent/run', async (req, res) => {
  try {
    const { message, config: clientConfig } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!agent) {
      initializeAgent();
    }

    // Update config if provided
    if (clientConfig && agent) {
      (agent as any).config = {
        ...(agent as any).config,
        enableToolRetry: clientConfig.retry ?? true,
        enableToolCache: clientConfig.cache ?? true,
        validateToolInputs: clientConfig.validation ?? true,
        autoRecovery: clientConfig.recovery ?? true,
        debug: clientConfig.debug ?? false,
      };
    }

    const startTime = Date.now();
    const response = await agent!.run(message);
    const duration = Date.now() - startTime;

    // Get stats
    const state = agent!.getState();
    const monitor = agent!.getPerformanceMonitor();
    const report = monitor.generateReport();

    // Get tool usage
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
        cacheHits: 0,
        retries: 0,
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
  }
});

// Get agent status
app.get('/api/agent/status', (req, res) => {
  if (!agent) {
    return res.json({
      status: 'not_initialized',
      tools: [],
    });
  }

  const state = agent.getState();
  const tools = toolRegistry!.list().map(t => ({
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

// Get performance report
app.get('/api/agent/report', (req, res) => {
  if (!agent) {
    return res.json({ error: 'Agent not initialized' });
  }

  const monitor = agent.getPerformanceMonitor();
  const report = monitor.generateReport();

  res.json({
    overview: report.overview,
    slowestTools: report.slowestTools,
    mostUnreliable: report.mostUnreliable,
    recommendations: report.recommendations,
  });
});

// Get tool metrics
app.get('/api/agent/metrics/:toolName', (req, res) => {
  if (!agent) {
    return res.json({ error: 'Agent not initialized' });
  }

  const { toolName } = req.params;
  const monitor = agent.getPerformanceMonitor();
  const metrics = monitor.getToolMetrics(toolName);

  if (!metrics) {
    return res.status(404).json({ error: 'Tool not found' });
  }

  res.json(metrics);
});

// Export metrics
app.get('/api/agent/export', (req, res) => {
  if (!agent) {
    return res.json({ error: 'Agent not initialized' });
  }

  const data = agent.exportPerformanceData();

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=agent-metrics-${Date.now()}.json`);
  res.send(data);
});

// Clear agent state
app.post('/api/agent/clear', (req, res) => {
  if (agent) {
    agent.reset();
    res.json({ success: true });
  } else {
    res.json({ error: 'Agent not initialized' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Serve agent UI
app.get('/agent', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/agent-ui.html'));
});

// Serve default UI for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/agent-ui.html'));
});

// Error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// Start server
app.listen(PORT, () => {
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

  UI:
  - http://localhost:${PORT}       Main UI
  - http://localhost:${PORT}/agent Agent UI

================================================================================
  `);

  // Initialize agent on startup
  try {
    initializeAgent();
  } catch (err) {
    console.error('Failed to initialize agent:', err);
    console.log('Agent will be initialized on first request');
  }
});

export default app;
