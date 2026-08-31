/**
 * Type Definitions for UI Components
 */

export interface AgentStatus {
  status: 'idle' | 'thinking' | 'executing' | 'completed' | 'error';
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

export interface ToolExecution {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  output?: string;
  error?: string;
}

export interface SystemNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: Date;
}
