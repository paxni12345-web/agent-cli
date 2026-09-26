import React, { useState, useRef, useEffect, useCallback } from 'react';
import { render, Box, Text, useApp } from 'ink';
import { Header } from './components/Header.js';
import { ChatView } from './components/ChatView.js';
import { InputBox } from './components/InputBox.js';
import { StatusBar } from './components/StatusBar.js';
import { AgentStatus, Message, ToolEvent } from './types.js';

import { Agent } from '../agent/Agent.js';
import { createAgent as defaultCreateAgent } from '../createAgent.js';
import { ConfigLoader } from '../config/ConfigLoader.js';
import { Config } from '../types/index.js';
import { SettingsWizard } from './components/SettingsWizard.js';

interface AppProps {
  workingDirectory: string;
  model?: string;
  mode?: 'normal' | 'fast' | 'ultra';
  settingsOnly?: boolean;
  /** Built by the caller so the UI never wires providers/tools itself. */
  createAgent?: (config: Config, apiKey: string) => Agent;
}

let idCounter = 0;
const nextId = () => `${Date.now()}-${++idCounter}`;

// Full screen wipe: clear viewport + flush scrollback + cursor home.
// Written synchronously right before a screen switch so every phase starts
// on a clean terminal — like a brand-new session (no leftover UI above).
const NEW_SESSION_CLEAR = '\x1B[2J\x1B[3J\x1B[H';
const startFreshScreen = () => {
  process.stdout.write(NEW_SESSION_CLEAR);
};

export const App: React.FC<AppProps> = ({ workingDirectory, model, mode = 'normal', settingsOnly = false, createAgent = defaultCreateAgent }) => {
  const { exit } = useApp();

  // null = config still loading — render nothing so the wrong screen never
  // flashes while the async config load decides between wizard and welcome.
  const [config, setConfig] = useState<Config | null>(null);
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasStartedChat, setHasStartedChat] = useState(false);
  const [sessionNote, setSessionNote] = useState<string | null>(null);
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

      const apiKey = loader.getApiKey(cfg);
      if (settingsOnly || !apiKey) {
        setConfig(cfg);
        setStatus(prev => ({ ...prev, model: cfg.model }));
        setSetupRequired(true);
        return;
      }

      try {
        // Happy path — dismiss the loading guard set up above.
        setSetupRequired(false);

        const agent = createAgent(cfg, apiKey);
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

        agent.on('toolEnd', (execution: { tool: string; input: unknown; result: { success: boolean; metadata?: Record<string, unknown>; error?: string }; }) => {
          setToolEvents(prev =>
            prev.map(ev => {
              if (ev.name === execution.tool && ev.status === 'running' && summarizeInput(execution.input) === ev.summary) {
                runningToolsRef.current.delete(ev.id);
                return {
                  ...ev,
                  status: execution.result.success ? ('done' as const) : ('failed' as const),
                  durationMs: Date.now() - ev.startedAt,
                  details: formatToolDetails(execution.tool, execution.input, execution.result),
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

      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to initialize agent');
      }
    })();
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  }, []);

  const initializeConfiguredAgent = useCallback((updatedConfig: Config) => {
    const loader = new ConfigLoader();
    const apiKey = loader.getApiKey(updatedConfig);
    if (!apiKey) {
      setError('ไม่พบ API key ที่ตั้งค่าไว้');
      setSetupRequired(true);
      return;
    }
    const agent = createAgent(updatedConfig, apiKey);
    agent.on('toolStart', (call: { id: string; name: string; input: unknown }) => {
      const ev: ToolEvent = { id: call.id || nextId(), name: call.name, status: 'running', startedAt: Date.now(), summary: summarizeInput(call.input) };
      runningToolsRef.current.set(ev.id, ev);
      setToolEvents(prev => [...prev, ev]);
    });
    agent.on('toolEnd', (execution: { tool: string; input: unknown; result: { success: boolean; metadata?: Record<string, unknown>; error?: string } }) => {
      setToolEvents(prev => prev.map(ev => {
        if (ev.name !== execution.tool || ev.status !== 'running' || summarizeInput(execution.input) !== ev.summary) return ev;
        runningToolsRef.current.delete(ev.id);
        return { ...ev, status: execution.result.success ? 'done' : 'failed', durationMs: Date.now() - ev.startedAt, details: formatToolDetails(execution.tool, execution.input, execution.result) };
      }));
    });
    agent.on('tokenUsage', (usage: { totalTokens: number }) => {
      setStatus(prev => ({ ...prev, tokensUsed: prev.tokensUsed + usage.totalTokens }));
    });
    agent.on('status', (nextStatus: string) => {
      if (nextStatus === 'thinking' || nextStatus === 'executing') setLiveStatus(nextStatus);
    });
    agentRef.current = agent;
    startFreshScreen();
    setConfig(updatedConfig);
    setStatus(prev => ({ ...prev, model: updatedConfig.model }));
    setSetupRequired(false);
    setError(null);
  }, [createAgent, setLiveStatus]);

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
              '  /settings        open settings (fresh screen)',
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

        case 'settings':
        case 'config':
          if (busyRef.current) break;
          startFreshScreen();
          setSetupRequired(true);
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

      // Any submit from the welcome screen — task or slash command — moves
      // into the chat view so command output is actually visible.
      startFreshScreen();
      setHasStartedChat(true);

      if (message.startsWith('/')) {
        await handleCommand(message);
        return;
      }
      setSessionNote(null);

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

        // Task finished — show the answer briefly, then roll straight into
        // a fresh session: wipe the terminal, reset memory, clear the view
        // and land back on the welcome screen with no leftovers.
        const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
        await new Promise(resolve => setTimeout(resolve, 1500));
        agent.reset();
        startFreshScreen();
        setMessages([]);
        setToolEvents([]);
        runningToolsRef.current.clear();
        setInput('');
        setStatus(prev => ({ ...prev, tokensUsed: 0 }));
        setLiveStatus('idle');
        busyRef.current = false;
        setBusy(false);
        setHasStartedChat(false);
        setSessionNote(`✓ task เสร็จใน ${secs}s — เริ่ม session ใหม่ได้เลย`);
      } catch (e) {
        addMessage({
          id: nextId(),
          role: 'system',
          content: `✗ ${e instanceof Error ? e.message : 'Unknown error'}`,
          timestamp: new Date(),
        });
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

  if (!config || setupRequired === null) {
    return null;
  }

  if (setupRequired && config) {
    return <SettingsWizard initialConfig={config} onComplete={settingsOnly ? undefined : initializeConfiguredAgent} />;
  }

  if (!hasStartedChat) {
    return (
      <Box flexDirection="column" height="100%">
        <Box height={3} paddingX={1} alignItems="center">
          <Box paddingX={2} height={2}>
            <Text backgroundColor="#252525" color="#e9d5ff" bold>▣  IRIS</Text>
            <Text color="#a78bfa">  ×</Text>
          </Box>
          <Text color="#d8b4fe">  +</Text>
          <Box flexGrow={1} />
          <Text color="#c4b5fd">─   □   ×</Text>
        </Box>
        <Box flexGrow={1} flexDirection="column" justifyContent="center" alignItems="center">
          <Box flexDirection="column" alignItems="center" marginBottom={2}>
            <Text color="#a78bfa" bold>{`██╗██████╗ ██╗███████╗`}</Text>
            <Text color="#a78bfa" bold>{`██║██╔══██╗██║██╔════╝`}</Text>
            <Text color="#c084fc" bold>{`██║██████╔╝██║███████╗`}</Text>
            <Text color="#c084fc" bold>{`██║██╔══██╗██║╚════██║`}</Text>
            <Text color="#e9d5ff" bold>{`██║██║  ██║██║███████║`}</Text>
            <Text color="#e9d5ff" bold>{`╚═╝╚═╝  ╚═╝╚═╝╚══════╝`}</Text>
            <Box marginTop={1}>
              <Text color="#c084fc" bold>IRIS</Text>
              <Text color="#8b7a9e">  ·  terminal AI workspace</Text>
            </Box>
          </Box>
          {/* Large, prominent centered first-message box — wide and tall,
              but still inside the middle area so the title bar stays visible. */}
          <Box
            width={Math.min(100, Math.max(56, (process.stdout.columns || 96) - 2))}
            minHeight={9}
            flexDirection="column"
            justifyContent="center"
            borderStyle="round"
            borderColor="#a78bfa"
            paddingX={2}
            paddingY={1}
          >
            <Box marginBottom={1} gap={1}>
              <Text color="#e9d5ff" bold>❯ ข้อความแรกของคุณ</Text>
              <Text color="#8b7a9e" dimColor>(Enter เพื่อเริ่ม)</Text>
            </Box>
            {sessionNote && <Text color="#86efac">{sessionNote}</Text>}
            <InputBox
              value={input}
              onChange={setInput}
              onSubmit={handleSubmit}
              disabled={busy}
              placeholder="Ask IRIS anything about your code…"
              welcome
            />
          </Box>
          <Box marginTop={1} gap={1}>
            <Text color="#c084fc">{config?.provider || 'connecting'}</Text>
            <Text color="#f5d0fe" bold>{status.model || 'loading model…'}</Text>
            <Text color="#a78bfa">· {status.mode} mode</Text>
          </Box>
          <Text color="#756783" dimColor>Type a task and press Enter · /help for commands</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height="100%">
      <Header
        provider={config?.provider || '…'}
        model={status.model || '…'}
        baseUrl={config?.baseUrl}
        mode={status.mode}
        workingDir={status.workingDir}
        status={{ status: busy ? agentStateRef.current : 'idle' }}
      />

      <ChatView messages={messages} toolEvents={toolEvents} />

      {busy && (
        <Box paddingLeft={2}>
          <Text color="#c084fc">
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

function formatToolDetails(
  tool: string,
  input: unknown,
  result: { success: boolean; metadata?: Record<string, unknown>; error?: string }
): string | undefined {
  if (!result.success) return result.error ? `failed: ${result.error}` : undefined;
  const args = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const metadata = result.metadata || {};
  const filePath = String(metadata.path ?? args.path ?? '');
  const lineStart = Number(metadata.startLine);
  const lineEnd = Number(metadata.endLine);
  const lineRange = Number.isFinite(lineStart)
    ? `L${lineStart}${Number.isFinite(lineEnd) ? `–${lineEnd}` : ''}`
    : undefined;

  if (tool === 'edit_file' || tool === 'write_file') {
    const changes = [
      Number(metadata.addedLines) > 0 ? `+${metadata.addedLines}` : undefined,
      Number(metadata.removedLines) > 0 ? `-${metadata.removedLines}` : undefined,
    ].filter(Boolean).join(' ');
    return [filePath, lineRange, changes || (tool === 'edit_file' ? `${metadata.replacements ?? 1} replacement(s)` : 'written')]
      .filter(Boolean).join(' · ');
  }
  if (tool === 'read_file') return [filePath, lineRange || 'read file'].filter(Boolean).join(' · ');
  if (filePath) return filePath;
  return undefined;
}

export const startCLI = (options: AppProps) => {
  const { waitUntilExit } = render(<App {...options} />);
  return waitUntilExit();
};

export default App;
