/**
 * Web Server for Agent CLI
 * Express server with API endpoints
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.post('/api/chat', async (req, res) => {
  try {
    const { message, model = 'claude-opus-4' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // TODO: Integrate with actual AI provider (Anthropic/OpenAI)
    // For now, return a demo response
    const response = {
      role: 'assistant',
      content: `You said: "${message}"\n\nThis is a demo response. In production, this will connect to Claude API.`,
      metadata: {
        tokens: Math.floor(Math.random() * 500) + 100,
        duration: Math.floor(Math.random() * 2000) + 500,
        model: model,
      },
    };

    // Simulate thinking delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    res.json(response);
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    version: '0.1.0',
    model: 'claude-opus-4',
    uptime: process.uptime(),
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve index.html for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║          🤖 Agent CLI Web Server                      ║
║                                                        ║
╠════════════════════════════════════════════════════════╣
║                                                        ║
║  Server running at:                                    ║
║  → http://localhost:${PORT}                              ║
║                                                        ║
║  API Endpoints:                                        ║
║  → POST /api/chat      - Send messages                ║
║  → GET  /api/status    - Server status                ║
║  → GET  /api/health    - Health check                 ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
  `);
});

export default app;
