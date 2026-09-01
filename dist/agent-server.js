"use strict";
/**
 * Agent API Server - Full integration with Agent system
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const url_1 = require("url");
const cors_1 = __importDefault(require("cors"));
const Agent_js_1 = require("./agent/Agent.js");
const ToolRegistry_js_1 = require("./tools/ToolRegistry.js");
const AnthropicProvider_js_1 = require("./providers/AnthropicProvider.js");
// Import tools
const FileTools_js_1 = require("./tools/FileTools.js");
const ShellTool_js_1 = require("./tools/ShellTool.js");
const SearchTool_js_1 = require("./tools/SearchTool.js");
const __filename = (0, url_1.fileURLToPath)(import.meta.url);
const __dirname = path_1.default.dirname(__filename);
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
// Simple permission manager for demo
class SimplePermissionManager {
    check(action) {
        return { allowed: true };
    }
    async requestApproval(action) {
        return true;
    }
}
// Initialize agent components
let agent = null;
let toolRegistry = null;
function initializeAgent() {
    const apiKey = process.env.ANTHROPIC_API_KEY || 'demo-key';
    toolRegistry = new ToolRegistry_js_1.ToolRegistry();
    // Register tools
    try {
        const readFile = new FileTools_js_1.ReadFileTool();
        const writeFile = new FileTools_js_1.WriteFileTool();
        const listFiles = new FileTools_js_1.ListFilesTool();
        const editFile = new FileTools_js_1.EditFileTool();
        const shell = new ShellTool_js_1.ShellTool();
        const searchCode = new SearchTool_js_1.SearchCodeTool();
        toolRegistry.register(readFile);
        toolRegistry.register(writeFile);
        toolRegistry.register(listFiles);
        toolRegistry.register(editFile);
        toolRegistry.register(shell);
        toolRegistry.register(searchCode);
    }
    catch (err) {
        console.error('Error registering tools:', err);
    }
    const config = {
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
    const provider = new AnthropicProvider_js_1.AnthropicProvider(apiKey);
    const permissions = new SimplePermissionManager();
    agent = new Agent_js_1.Agent(provider, toolRegistry, permissions, config);
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
            agent.config = {
                ...agent.config,
                enableToolRetry: clientConfig.retry ?? true,
                enableToolCache: clientConfig.cache ?? true,
                validateToolInputs: clientConfig.validation ?? true,
                autoRecovery: clientConfig.recovery ?? true,
                debug: clientConfig.debug ?? false,
            };
        }
        const startTime = Date.now();
        const response = await agent.run(message);
        const duration = Date.now() - startTime;
        // Get stats
        const state = agent.getState();
        const monitor = agent.getPerformanceMonitor();
        const report = monitor.generateReport();
        // Get tool usage
        const toolUsage = {};
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
    }
    catch (error) {
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
    const tools = toolRegistry.list().map(t => ({
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
    }
    else {
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
    res.sendFile(path_1.default.join(__dirname, '../public/agent-ui.html'));
});
// Serve default UI for root
app.get('/', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../public/agent-ui.html'));
});
// Error handler
app.use((err, req, res, next) => {
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
    }
    catch (err) {
        console.error('Failed to initialize agent:', err);
        console.log('Agent will be initialized on first request');
    }
});
exports.default = app;
