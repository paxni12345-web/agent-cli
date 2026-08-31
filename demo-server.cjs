const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Mock API for demo
app.post('/api/agent/run', async (req, res) => {
  const { message } = req.body;

  setTimeout(() => {
    res.json({
      response: `Received: ${message}\n\nNote: This is demo mode. To enable full agent functionality:\n1. Set ANTHROPIC_API_KEY\n2. Build TypeScript: npm run build\n3. Run: npm run start:agent`,
      duration: 1500,
      toolExecutions: [
        {
          tool: 'demo_tool',
          input: { message },
          result: { success: true, output: 'Demo execution' }
        }
      ],
      stats: {
        totalCalls: 1,
        successCalls: 1,
        avgDuration: 1500,
        cacheHits: 0,
        retries: 0,
        iterations: 1
      },
      toolUsage: {
        demo_tool: 1
      }
    });
  }, 1500);
});

app.get('/api/agent/status', (req, res) => {
  res.json({
    status: 'demo_mode',
    tools: [
      { name: 'read_file', description: 'Read file content' },
      { name: 'write_file', description: 'Write to file' },
      { name: 'list_files', description: 'List directory contents' },
      { name: 'search_code', description: 'Search in codebase' },
      { name: 'shell', description: 'Execute shell command' }
    ],
    iterations: 0,
    historyLength: 0
  });
});

app.get('/api/agent/report', (req, res) => {
  res.json({
    overview: {
      totalExecutions: 0,
      totalSuccess: 0,
      overallSuccessRate: 100,
      avgExecutionTime: 0
    },
    slowestTools: [],
    mostUnreliable: [],
    recommendations: ['Install dependencies and build to enable full functionality']
  });
});

app.get('/api/agent/export', (req, res) => {
  res.json({
    mode: 'demo',
    message: 'Build full version to enable export'
  });
});

app.post('/api/agent/clear', (req, res) => {
  res.json({ success: true });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mode: 'demo' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/agent-ui.html'));
});

app.listen(PORT, () => {
  console.log(`
================================================================================

  Agent CLI Web Server (Demo Mode)

  Server running at: http://localhost:${PORT}

  Demo Mode Active:
  - UI is fully functional
  - Agent responses are mocked
  - To enable full functionality:
    1. Set ANTHROPIC_API_KEY environment variable
    2. Run: npm run build
    3. Run: npm run start:agent

================================================================================
  `);
});
