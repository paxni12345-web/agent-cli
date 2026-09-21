export const CONTEXT_WINDOW = 200000;

export interface ToolEvent {
  id: string;
  name: string;
  status: 'running' | 'done' | 'failed';
  startedAt: number;
  durationMs?: number;
  summary?: string;
}

export interface AgentStatus {
  status: 'idle' | 'thinking' | 'executing';
  model: string;
  mode: 'normal' | 'fast' | 'ultra';
  workingDir: string;
  tokensUsed: number;
  tasksCompleted: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    tokensUsed?: number;
    duration?: number;
    tools?: string[];
  };
}
