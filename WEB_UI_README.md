# Agent CLI Web Interface

Web UI สำหรับ Agent CLI ที่เชื่อมต่อกับระบบ Agent แบบเต็มรูปแบบ

## Features

### Core Features
- Real-time agent interaction
- Tool execution monitoring
- Performance metrics dashboard
- Configuration management
- Error tracking
- Export metrics

### Agent System Integration
- Native tool calling
- Advanced validation
- Intelligent error recovery
- Performance monitoring
- Smart caching
- Auto retry with exponential backoff
- Timeout protection
- Security checks

## Quick Start

### 1. Install Dependencies

```bash
cd /root/agent-cli
npm install
```

### 2. Set Environment Variables

```bash
export ANTHROPIC_API_KEY=your_api_key_here
export PORT=3000
```

### 3. Build TypeScript

```bash
npm run build
```

### 4. Start Server

```bash
node dist/agent-server.js
```

Or use the start script:

```bash
npm run start:web
```

### 5. Open Browser

Navigate to:
```
http://localhost:3000
```

## Architecture

```
User Browser
    |
    | HTTP/WebSocket
    |
Express Server (agent-server.ts)
    |
    | Direct Integration
    |
Agent System
    |
    +-- ToolRegistry
    +-- AI Provider (Anthropic/OpenAI)
    +-- ToolCallValidator
    +-- ErrorRecoverySystem
    +-- PerformanceMonitor
    |
Tools (FileTools, ShellTool, etc.)
```

## API Endpoints

### POST /api/agent/run
Run agent with a message

Request:
```json
{
  "message": "Create a React component",
  "config": {
    "retry": true,
    "cache": true,
    "validation": true,
    "recovery": true,
    "debug": false
  }
}
```

Response:
```json
{
  "response": "Agent response text",
  "duration": 1234,
  "toolExecutions": [...],
  "stats": {
    "totalCalls": 5,
    "successCalls": 5,
    "avgDuration": 234,
    "iterations": 2
  },
  "toolUsage": {
    "read_file": 2,
    "write_file": 1
  }
}
```

### GET /api/agent/status
Get current agent status

Response:
```json
{
  "status": "idle",
  "tools": [...],
  "iterations": 0,
  "historyLength": 0
}
```

### GET /api/agent/report
Get performance report

Response:
```json
{
  "overview": {
    "totalExecutions": 10,
    "totalSuccess": 9,
    "overallSuccessRate": 90,
    "avgExecutionTime": 500
  },
  "slowestTools": [...],
  "mostUnreliable": [...],
  "recommendations": [...]
}
```

### GET /api/agent/export
Export metrics as JSON file

Returns downloadable JSON file with all metrics

### POST /api/agent/clear
Clear agent state and history

Response:
```json
{
  "success": true
}
```

## UI Components

### 1. Header
- Logo and status badge
- Clear, Export, Report buttons

### 2. Left Sidebar
- Available tools list with usage counts
- Recent errors display

### 3. Main Chat Area
- Message history
- Tool execution details
- Thinking indicator
- Message input

### 4. Right Panel
- Performance stats (total calls, success rate)
- Metrics (duration, cache rate, retry rate)
- Configuration toggles

## Configuration Options

All toggleable in the UI:

- **Tool Retry**: Enable automatic retry on failures (default: on)
- **Caching**: Enable result caching for 1 minute (default: on)
- **Validation**: Validate tool inputs before execution (default: on)
- **Auto Recovery**: Enable intelligent error recovery (default: on)
- **Debug Mode**: Show detailed logs (default: off)

## Performance Metrics

### Real-time Stats
- Total tool calls
- Success rate percentage
- Average execution duration
- Cache hit rate
- Retry rate
- Current iterations

### Tool Usage Tracking
- Per-tool call counts
- Tool performance metrics
- Error distribution

## Development

### File Structure

```
agent-cli/
├── src/
│   ├── agent-server.ts          # Express server
│   ├── agent/
│   │   ├── Agent.ts              # Main agent
│   │   ├── ToolCallValidator.ts  # Validation
│   │   ├── ErrorRecoverySystem.ts
│   │   └── ToolPerformanceMonitor.ts
│   ├── providers/
│   │   ├── AnthropicProvider.ts  # AI provider
│   │   └── OpenAIProvider.ts
│   └── tools/
│       ├── FileTools.ts
│       ├── ShellTool.ts
│       └── SearchTool.ts
└── public/
    └── agent-ui.html             # Web UI
```

### Adding New Tools

1. Create tool class implementing `Tool` interface
2. Register in `agent-server.ts`:

```typescript
import { MyNewTool } from './tools/MyNewTool.js';

const myTool = new MyNewTool();
toolRegistry.register(myTool);
```

3. Tool automatically appears in UI

### Customizing UI

Edit `/root/agent-cli/public/agent-ui.html`

Colors defined in CSS variables:
```css
:root {
  --bg-primary: #0f172a;
  --accent-primary: #3b82f6;
  --success: #10b981;
  ...
}
```

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 node dist/agent-server.js
```

### Agent Not Responding

Check:
1. ANTHROPIC_API_KEY is set
2. Server logs for errors
3. Browser console for client errors
4. Network tab for failed requests

### Tools Not Working

Verify:
1. Tools are registered in agent-server.ts
2. Workspace permissions
3. File paths are correct
4. Shell commands are available

## Production Deployment

### 1. Build for Production

```bash
npm run build
NODE_ENV=production node dist/agent-server.js
```

### 2. Use Process Manager

```bash
# With PM2
pm2 start dist/agent-server.js --name agent-cli

# With systemd
sudo systemctl start agent-cli
```

### 3. Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name agent.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4. HTTPS with Let's Encrypt

```bash
certbot --nginx -d agent.example.com
```

## Security Notes

### Production Checklist
- Set strong ANTHROPIC_API_KEY
- Enable CORS only for trusted domains
- Use HTTPS in production
- Implement authentication
- Rate limit API endpoints
- Sanitize user inputs
- Monitor logs for suspicious activity

### Authentication Example

```typescript
// Add to agent-server.ts
const authenticate = (req, res, next) => {
  const token = req.headers.authorization;
  if (token !== process.env.AUTH_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

app.use('/api/agent/*', authenticate);
```

## Performance Tips

### 1. Enable Caching
Keep caching enabled for repeated operations (50-90% faster)

### 2. Adjust Timeouts
For slow operations:
```typescript
config.toolTimeout = 60000; // 60 seconds
```

### 3. Limit Iterations
For simple tasks:
```typescript
config.maxIterations = 10; // Default 20
```

### 4. Monitor Metrics
Export metrics regularly and analyze bottlenecks

## Testing

### Manual Testing
1. Open http://localhost:3000
2. Send test message: "List files in current directory"
3. Verify tool execution in UI
4. Check metrics update
5. Test configuration toggles

### API Testing

```bash
# Test agent run
curl -X POST http://localhost:3000/api/agent/run \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}'

# Test status
curl http://localhost:3000/api/agent/status

# Test report
curl http://localhost:3000/api/agent/report
```

## Support

For issues:
1. Check server logs
2. Check browser console
3. Review API responses
4. Verify environment variables

## License

Same as Agent CLI project
