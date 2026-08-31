#!/usr/bin/env node

/**
 * Simple HTTP Server for Testing Web UI
 * No dependencies required - uses built-in http module
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const webTools = require('./src/web-tools.cjs');

const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Simple chat API handler
function handleChatAPI(req, res) {
  let body = '';

  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    try {
      const { message, provider, apiEndpoint, apiKey, modelName, systemPrompt } = JSON.parse(body);

      // If using real API (not demo)
      if (provider !== 'demo' && apiKey && apiEndpoint) {
        // Forward to real API
        const https = require('https');
        const url = require('url');

        const parsedUrl = url.parse(apiEndpoint);
        const postData = JSON.stringify({
          model: modelName || 'claude-opus-5',
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: message }
          ],
          max_tokens: 4096,
        });

        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 443,
          path: parsedUrl.path,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Length': Buffer.byteLength(postData),
          },
        };

        const apiReq = https.request(options, (apiRes) => {
          let data = '';

          apiRes.on('data', (chunk) => {
            data += chunk;
          });

          apiRes.on('end', () => {
            try {
              const response = JSON.parse(data);

              // Transform response
              const content = response.content?.[0]?.text || response.choices?.[0]?.message?.content || 'No response';

              res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              });

              res.end(JSON.stringify({
                role: 'assistant',
                content: content,
                metadata: {
                  tokens: response.usage?.input_tokens || 0,
                  duration: 0,
                  model: modelName,
                },
              }));
            } catch (e) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Failed to parse API response: ' + e.message }));
            }
          });
        });

        apiReq.on('error', (error) => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'API request failed: ' + error.message }));
        });

        apiReq.write(postData);
        apiReq.end();
        return;
      }

      // Demo mode - Simulate AI response
      const responses = [
        `ได้รับข้อความแล้วค่ะ: "${message}"\n\nนี่คือการตอบกลับแบบ demo นะคะ ในการใช้งานจริงจะเชื่อมต่อกับ Claude API`,
        `สวัสดีค่ะ! คุณถามว่า: "${message}"\n\nตอนนี้เป็นโหมดทดสอบนะคะ ระบบทำงานได้ดี!\n\nเมื่อติดตั้ง dependencies เรียบร้อยแล้ว จะเชื่อมต่อกับ AI จริงๆ ค่ะ`,
        `เข้าใจแล้วค่ะ! "${message}"\n\n✨ ระบบ Web UI ทำงานได้ดีแล้ว\n🎨 สีชมพูสวยไหมคะ\n💬 พร้อมใช้งานเลย!`,
      ];

      const response = responses[Math.floor(Math.random() * responses.length)];

      // Simulate delay
      setTimeout(() => {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });

        res.end(JSON.stringify({
          role: 'assistant',
          content: response,
          metadata: {
            tokens: Math.floor(Math.random() * 300) + 100,
            duration: Math.floor(Math.random() * 2000) + 800,
            model: 'claude-opus-4',
          },
        }));
      }, 1000);

    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid request' }));
    }
  });
}

// Create server
const server = http.createServer((req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // API endpoints
  if (req.url === '/api/chat' && req.method === 'POST') {
    handleChatAPI(req, res);
    return;
  }

  if (req.url === '/api/status') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({
      status: 'running',
      version: '0.1.0',
      model: 'claude-opus-4-demo',
      uptime: process.uptime(),
    }));
    return;
  }

  if (req.url === '/api/health') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // Serve static files
  let filePath = path.join(publicDir, req.url === '/' ? 'index.html' : req.url);

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // File not found - serve index.html (SPA)
        fs.readFile(path.join(publicDir, 'index.html'), (error, content) => {
          if (error) {
            res.writeHead(500);
            res.end('Server error: ' + error.code);
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content, 'utf-8');
          }
        });
      } else {
        res.writeHead(500);
        res.end('Server error: ' + error.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.clear();
  console.log('\x1b[35m╔════════════════════════════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[35m║\x1b[0m                                                                \x1b[35m║\x1b[0m');
  console.log('\x1b[35m║\x1b[0m          \x1b[35m🤖 Agent CLI Web Server (Test Mode)\x1b[0m               \x1b[35m║\x1b[0m');
  console.log('\x1b[35m║\x1b[0m                                                                \x1b[35m║\x1b[0m');
  console.log('\x1b[35m╠════════════════════════════════════════════════════════════════╣\x1b[0m');
  console.log('\x1b[35m║\x1b[0m                                                                \x1b[35m║\x1b[0m');
  console.log('\x1b[35m║\x1b[0m  \x1b[32m✓\x1b[0m Server running at:                                       \x1b[35m║\x1b[0m');
  console.log('\x1b[35m║\x1b[0m                                                                \x1b[35m║\x1b[0m');
  console.log('\x1b[35m║\x1b[0m    \x1b[36m→ http://localhost:' + PORT + '\x1b[0m                                  \x1b[35m║\x1b[0m');
  console.log('\x1b[35m║\x1b[0m    \x1b[36m→ http://127.0.0.1:' + PORT + '\x1b[0m                                  \x1b[35m║\x1b[0m');
  console.log('\x1b[35m║\x1b[0m                                                                \x1b[35m║\x1b[0m');
  console.log('\x1b[35m║\x1b[0m  \x1b[33m⚡ Test Mode:\x1b[0m                                              \x1b[35m║\x1b[0m');
  console.log('\x1b[35m║\x1b[0m    - No dependencies required                                 \x1b[35m║\x1b[0m');
  console.log('\x1b[35m║\x1b[0m    - Demo responses only                                      \x1b[35m║\x1b[0m');
  console.log('\x1b[35m║\x1b[0m    - Pink UI theme active                                     \x1b[35m║\x1b[0m');
  console.log('\x1b[35m║\x1b[0m                                                                \x1b[35m║\x1b[0m');
  console.log('\x1b[35m║\x1b[0m  \x1b[32m📡 API Endpoints:\x1b[0m                                          \x1b[35m║\x1b[0m');
  console.log('\x1b[35m║\x1b[0m    → POST /api/chat      - Send messages                      \x1b[35m║\x1b[0m');
  console.log('\x1b[35m║\x1b[0m    → GET  /api/status    - Server status                      \x1b[35m║\x1b[0m');
  console.log('\x1b[35m║\x1b[0m    → GET  /api/health    - Health check                       \x1b[35m║\x1b[0m');
  console.log('\x1b[35m║\x1b[0m                                                                \x1b[35m║\x1b[0m');
  console.log('\x1b[35m║\x1b[0m  \x1b[35m💡 Tips:\x1b[0m                                                   \x1b[35m║\x1b[0m');
  console.log('\x1b[35m║\x1b[0m    • Open browser and visit the URL above                     \x1b[35m║\x1b[0m');
  console.log('\x1b[35m║\x1b[0m    • Try chatting - it works without npm install!            \x1b[35m║\x1b[0m');
  console.log('\x1b[35m║\x1b[0m    • Press Ctrl+C to stop server                             \x1b[35m║\x1b[0m');
  console.log('\x1b[35m║\x1b[0m                                                                \x1b[35m║\x1b[0m');
  console.log('\x1b[35m╚════════════════════════════════════════════════════════════════╝\x1b[0m');
  console.log('');
  console.log('\x1b[32m✨ Ready to test! Open your browser now!\x1b[0m');
  console.log('');
});

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n\n\x1b[33m👋 Shutting down server...\x1b[0m');
  server.close(() => {
    console.log('\x1b[32m✓ Server stopped successfully\x1b[0m');
    process.exit(0);
  });
});
