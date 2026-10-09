/**
 * Per-user sandboxes for the code agent. The agent's tools (shell, files, git)
 * run on whatever machine hosts the agent, so signed-in users get their own
 * disposable machine instead of sharing the main server.
 */

export interface SandboxHandle {
  /** Origin of the agent server running inside the user's sandbox. */
  baseUrl: string;
  /** Headers every upstream request must carry (sandbox traffic token + agent bearer token). */
  headers: Record<string, string>;
}

export type AcquireResult =
  | { kind: 'ready'; handle: SandboxHandle }
  | { kind: 'starting' }
  | { kind: 'busy' }
  | { kind: 'failed'; message: string };

export interface SandboxRuntime {
  /** Returns a ready sandbox, or starts (or keeps waiting for) one without blocking the request. */
  acquire(uid: string): Promise<AcquireResult>;
  stop(uid: string): Promise<void>;
}

export interface ModelSettings {
  provider: 'anthropic' | 'openai';
  model: string;
  apiKey: string;
  baseUrl?: string;
  thinkingLevel?: string;
}
