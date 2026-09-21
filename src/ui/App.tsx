import React, { useState, useRef, useEffect, useCallback } from 'react';
import { render, Box, Text, useApp } from 'ink';
import { Header } from './components/Header.js';
import { ChatView } from './components/ChatView.js';
import { InputBox } from './components/InputBox.js';
import { StatusBar } from './components/StatusBar.js';
import { AgentStatus, Message, ToolEvent } from './types.js';

import { Agent } from '../agent/Agent.js';
import { AnthropicProvider } from '../providers/AnthropicProvider.js';
import { OpenAIProvider } from '../providers/OpenAIProvider.js';
import { createDefaultToolRegistry } from '../tools/index.js';
import { DefaultPermissionManager } from '../security/PermissionManager.js';
import { ConfigLoader } from '../config/ConfigLoader.js';
import { Config } from '../types/index.js';

interface AppProps {
  workingDirectory: string;
  model?: string;
  mode?: 'normal' | 'fast' | 'ultra';
}

let idCounter = 0;
const nextId = () => `${Date.now()}-${++idCounter}`;

export const App: React.FC<AppProps> = ({ workingDirectory, model, mode = 'normal' }) => {
  const { exit } = useApp();

  const [config, setConfig] = useState<Config | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<AgentStatus>({
    status: 'idle',
    model: model ?? '',
    mode,
    workingDir: workingDirectory,
    tokensUsed: 0,
    tasksCompleted: 0,
  });

  const agentRef = useRef<Agent | null>(null);
  const busyRef = useRef(false);
  const agentStateRef = useRef<'idle' | 'thinking' | 'executing'>('idle');
  const runningToolsRef = useRef(new Map<string, ToolEvent>());

  const addMessage = useCallback((msg: Message) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const setLiveStatus = useCallback((s: 'idle' | 'thinking' | 'executing') => {
    agentStateRef.current = s;
    setStatus(prev => ({ ...prev, status: s }));
  }, []);

  useEffect(() => {
    (async () => {
      const loader = new ConfigLoader();
      let cfg: Config;
      try {
        cfg = await loader.load();
      } catch {
        cfg = ConfigLoader.getDefaults();
      }
      if (model) cfg.model = model;

      const apiKey =
        cfg.provider === 'anthropic'
          ? process.env.ANTHROPIC_API_KEY
          : process.env.OPENAI_API_KEY;

      if (!apiKey) {
        setError('API key not found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY and restart.');
        return;
      }

      try {
        const provider =
          cfg.provider === 'anthropic'
            ? new AnthropicProvider(apiKey, { baseUrl: cfg.baseUrl, model: cfg.model })
            : new OpenAIProvider(apiKey, { baseUrl: cfg.baseUrl, model: cfg.model });

        const agent = new Agent(
          provider,
          createDefaultToolRegistry(),
          new DefaultPermissionManager(cfg.permissionMode),
          cfg
        );
        agentRef.current = agent;

        agent.on('toolStart', (call: { id: string; name: string; input: unknown }) => {
          const ev: ToolEvent = {
            id: call.id || nextId(),
            name: call.name,
            status: 'running',
            startedAt: Date.now(),
            summary: summarizeInput(call.input),
          };
          runningToolsRef.current.set(ev.id, ev);
          setToolEvents(prev => [...prev, ev]);
        });

        agent.on('toolEnd', (execution: { tool: string; result: { success: boolean }; }) => {
          setToolEvents(prev =>
            prev.map(ev => {
              if (ev.name === execution.tool && ev.status === 'running') {
                runningToolsRef.current.delete(ev.id);
                return {
                  ...ev,
                  status: execution.result.success ? ('done' as const) : ('failed' as const),
                  durationMs: Date.now() - ev.startedAt,
                };
              }
              return ev;
            })
          );
        });

        agent.on('tokenUsage', (usage: { totalTokens: number }) => {
          setStatus(prev => ({
            ...prev,
            tokensUsed: prev.tokensUsed + usage.totalTokens,
          }));
        });

        agent.on('status', (s: string) => {
          if (s === 'thinking' || s === 'executing') {
            setLiveStatus(s);
          }
        });

        setConfig(cfg);
        setStatus(prev => ({ ...prev, model: cfg.model }));

        setMessages([
          {
            id: nextId(),
            role: 'system',
            content:
              `Welcome to Agent CLI — connected to ${cfg.provider} (${cfg.model}).\n` +
              `Type a task, or /help for commands.`,
            timestamp: new Date(),
          },
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to initialize agent');
      }
    })();
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  }, []);

  const handleCommand = useCallback(
    async (message: string) => {
      const [cmd, ...rest] = message.slice(1).split(/\s+/);
      const arg = rest.join(' ');
      const agent = agentRef.current;

      switch (cmd.toLowerCase()) {
        case 'help':
          addMessage({
            id: nextId(),
            role: 'system',
            content: [
              'Commands:',
              '  /help            this help',
              '  /clear           clear conversation view',
              '  /reset           reset agent memory',
              '  /status          agent status',
              '  /stats           tool performance',
              '  /tools           list registered tools',
              '  /model <name>    switch model',
              '  /exit            quit',
            ].join('\n'),
            timestamp: new Date(),
          });
          break;

        case 'clear':
          setMessages([]);
          setToolEvents([]);
          break;

        case 'reset':
          agent?.reset();
          setMessages([]);
          setToolEvents([]);
          setStatus(prev => ({ ...prev, tokensUsed: 0 }));
          addMessage({
            id: nextId(),
            role: 'system',
            content: 'Agent memory cleared.',
            timestamp: new Date(),
          });
          break;

        case 'status': {
          const st = agent?.getState();
          addMessage({
            id: nextId(),
            role: 'system',
            content: st
              ? `status: ${st.status} · iterations: ${st.iterationCount} · tool calls: ${st.history.length}`
              : 'agent not initialized',
            timestamp: new Date(),
          });
          break;
        }

        case 'stats': {
          if (!agent) break;
          const report = agent.getPerformanceMonitor().generateReport();
          const lines: string[] = [];
          if (report.overview.totalExecutions === 0) {
            lines.push('No tool executions yet.');
          } else {
            lines.push(
              `executions: ${report.overview.totalExecutions} · success: ${report.overview.totalSuccess} · failed: ${report.overview.totalFailures} · avg ${Math.round(report.overview.avgExecutionTime)}ms`
            );
            for (const t of report.slowestTools.slice(0, 5)) {
              lines.push(`  ${t.tool}: ${Math.round(t.avgDuration)}ms avg`);
            }
          }
          addMessage({
            id: nextId(),
            role: 'system',
            content: lines.join('\n'),
            timestamp: new Date(),
          });
          break;
        }

        case 'tools': {
          if (!agent) break;
          const tools = agent.getToolRegistry().list();
          addMessage({
            id: nextId(),
            role: 'system',
            content: tools.map(t => `● ${t.name.padEnd(14)} ${t.description}`).join('\n'),
            timestamp: new Date(),
          });
          break;
        }

        case 'model':
          if (!arg) {
            addMessage({
              id: nextId(),
              role: 'system',
              content: `current model: ${status.model}`,
              timestamp: new Date(),
            });
          } else {
            agent?.updateConfig({ model: arg });
            setStatus(prev => ({ ...prev, model: arg }));
            addMessage({
              id: nextId(),
              role: 'system',
              content: `Model set to ${arg} (applies to next provider request)`,
              timestamp: new Date(),
            });
          }
          break;

        case 'exit':
          exit();
          break;

        default:
          addMessage({
            id: nextId(),
            role: 'system',
            content: `Unknown command: /${cmd} — type /help`,
            timestamp: new Date(),
          });
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    [status.model]
  );

  const handleSubmit = useCallback(
    async (raw: string) => {
      const message = raw.trim();
      if (!message || busyRef.current) {
        setInput('');
        return;
      }

      setInput('');

      if (message.startsWith('/')) {
        await handleCommand(message);
        return;
      }

      const agent = agentRef.current;
      if (!agent || !config) {
        addMessage({
          id: nextId(),
          role: 'system',
          content: error ?? 'Agent is not ready yet.',
          timestamp: new Date(),
        });
        return;
      }

      busyRef.current = true;
      setBusy(true);
      setError(null);
      setToolEvents([]);
      runningToolsRef.current.clear();
      setLiveStatus('thinking');

      addMessage({
        id: nextId(),
        role: 'user',
        content: message,
        timestamp: new Date(),
      });

      const startedAt = Date.now();

      try {
        const finalText = await agent.run(message);

        addMessage({
          id: nextId(),
          role: 'assistant',
          content: finalText || '(no content)',
          timestamp: new Date(),
          metadata: {
            duration: Date.now() - startedAt,
          },
        });

        setStatus(prev => ({
          ...prev,
          tasksCompleted: prev.tasksCompleted + 1,
        }));
      } catch (e) {
        addMessage({
          id: nextId(),
          role: 'system',
          content: `✗ ${e instanceof Error ? e.message : 'Unknown error'}`,
          timestamp: new Date(),
        });
      } finally {
        busyRef.current = false;
        setBusy(false);
        setLiveStatus('idle');
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    [config, error]
  );

  if (error && !config) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">✗ {error}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height="100%">
      <Header
        model={status.model || '…'}
        mode={status.mode}
        workingDir={status.workingDir}
        status={{ status: busy ? agentStateRef.current : 'idle' }}
      />

      <ChatView messages={messages} toolEvents={toolEvents} />

      {busy && (
        <Box paddingLeft={2}>
          <Text color="cyan">
            {agentStateRef.current === 'executing' ? '⚙ working with tools…' : '◉ thinking…'}
          </Text>
        </Box>
      )}

      <Box flexGrow={1} />

      <InputBox
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        disabled={busy}
        placeholder={busy ? 'agent is working…' : 'Type a task… (/help for commands)'}
      />

      <StatusBar status={status} />
    </Box>
  );
};

function summarizeInput(input: unknown): string | undefined {
  if (input === null || input === undefined) return undefined;
  try {
    const obj = typeof input === 'object' ? (input as Record<string, unknown>) : { input };
    const first = String(obj.path ?? obj.command ?? obj.pattern ?? obj.query ?? obj.content ?? '');
    if (!first) return undefined;
    const oneLine = first.replace(/\s+/g, ' ').trim();
    return oneLine.length > 60 ? oneLine.slice(0, 57) + '…' : oneLine;
  } catch {
    return undefined;
  }
}

export const startCLI = (options: AppProps) => {
  const { waitUntilExit } = render(<App {...options} />);
  return waitUntilExit();
};

export default App;
