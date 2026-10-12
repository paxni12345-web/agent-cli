/**
 * Gateway internal contracts — the ONLY shapes the client and the rest of the
 * gateway ever see. Each upstream (OpenCode / Hermes / OpenClaw / direct LLM) is hidden
 * behind an AgentAdapter that translates to/from these types.
 */

export type Mode = "chat" | "code" | "work" | "agent";

/** Which upstream serves a mode. "work" may be served by Hermes or OpenClaw. */
export type Backend = "direct-llm" | "opencode" | "hermes" | "openclaw";

export type ApprovalChoice = "once" | "session" | "always" | "deny";

export type RunStatus =
  | "queued"
  | "running"
  | "waiting_for_approval"
  | "completed"
  | "failed"
  | "stopped";

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  /** Computed by the gateway from its own price table; upstreams do not give reliable cost. */
  costMicroUsd?: number;
}

export interface ApprovalRequest {
  /** Gateway-level id (stable across upstreams). */
  id: string;
  /** Upstream's own id, needed to reply (OpenCode: per_…, Hermes: request_id). */
  upstreamId: string;
  kind: "shell" | "file" | "network" | "other";
  /** Human readable: the command or path shown on the phone. */
  summary: string;
  detail?: Record<string, unknown>;
  /** Only choices the gateway is willing to offer (it may strip "always"). */
  choices: ApprovalChoice[];
  createdAt: number;
}

/** Normalised event stream. `seq` is gateway-assigned, monotonic per session (for SSE Last-Event-ID resume). */
export type AgentEvent = { seq: number; sessionId: string; at: number } & (
  | { type: "status"; status: RunStatus }
  | { type: "message.delta"; messageId: string; text: string }
  | { type: "message.done"; messageId: string; text: string }
  | { type: "tool.started"; toolId: string; name: string; input?: unknown }
  | { type: "tool.finished"; toolId: string; ok: boolean; output?: string }
  | { type: "approval.requested"; approval: ApprovalRequest }
  | { type: "approval.resolved"; approvalId: string; choice: ApprovalChoice }
  | { type: "usage"; usage: Usage; cumulative: boolean }
  | { type: "error"; code: string; message: string; retryable: boolean }
);

export interface SessionRef {
  /** Gateway session id (uuid). */
  id: string;
  userId: string;
  mode: Mode;
  backend: Backend;
  /** Upstream session / run id once created. */
  upstreamId?: string;
  createdAt: number;
}

export interface SendInput {
  text: string;
  /** Model override, subject to the user's plan. */
  model?: string;
}

/** What a sandbox hands the adapter: where to call and the secret that only the gateway knows. */
export interface SandboxEndpoint {
  baseUrl: string; // internal network address, never exposed to clients
  secret: string; // OPENCODE_SERVER_PASSWORD / API_SERVER_KEY (>=16 chars for Hermes)
  sandboxId: string;
  /** Extra headers every upstream request must carry (e.g. the E2B traffic access token). */
  headers?: Record<string, string>;
}

export interface AgentAdapter {
  readonly backend: Backend;

  /** Create the upstream session. Must not run anything yet. */
  createSession(ep: SandboxEndpoint, ref: SessionRef): Promise<{ upstreamId: string }>;

  /** Start a turn. Returns once the upstream accepted it; progress arrives via events(). */
  send(ep: SandboxEndpoint, ref: SessionRef, input: SendInput): Promise<void>;

  /**
   * Long-lived translated stream for one session. The adapter owns reconnecting to the upstream SSE;
   * it yields events WITHOUT seq/sessionId/at — the EventBus stamps those.
   */
  events(ep: SandboxEndpoint, ref: SessionRef, signal: AbortSignal): AsyncIterable<DistributiveOmit<AgentEvent, "seq" | "sessionId" | "at">>;

  /** Reply to a pending approval. Must be idempotent (409/already-resolved => resolve quietly). */
  approve(ep: SandboxEndpoint, ref: SessionRef, a: ApprovalRequest, choice: ApprovalChoice): Promise<void>;

  stop(ep: SandboxEndpoint, ref: SessionRef): Promise<void>;

  /** Code mode only. Optional because Hermes/direct-llm have no workspace API. */
  listFiles?(ep: SandboxEndpoint, ref: SessionRef, path: string): Promise<FileEntry[]>;
  readFile?(ep: SandboxEndpoint, ref: SessionRef, path: string): Promise<{ content: string; truncated: boolean }>;

  health(ep: SandboxEndpoint): Promise<boolean>;
}

export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export interface FileEntry {
  path: string;
  type: "file" | "dir";
  size?: number;
}

/* ---------- Gateway services ---------- */

export type PublishedEvent = DistributiveOmit<AgentEvent, 'seq' | 'sessionId' | 'at'>;

export interface EventBus {
  /** Stamps seq/at/sessionId, buffers for resume, and fans out to live subscribers. */
  publish(sessionId: string, e: PublishedEvent): AgentEvent;
  /**
   * Events with seq > afterSeq (from the buffer), then live events, until `signal` aborts or the session is closed.
   * If afterSeq is older than the buffer, a single `error` event with code `resume_gap` is yielded first.
   */
  subscribe(sessionId: string, afterSeq: number, signal?: AbortSignal): AsyncIterable<AgentEvent>;
  /** Ends all subscribers of the session and frees its buffer. */
  close(sessionId: string): void;
}

export type ResolveOutcome = 'resolved' | 'already_resolved' | 'not_found' | 'forbidden' | 'invalid_choice' | 'expired';

export interface StoredApproval {
  sessionId: string;
  userId: string;
  approval: ApprovalRequest;
  resolved?: { choice: ApprovalChoice; byUserId: string; at: number };
}

export interface ApprovalStore {
  put(sessionId: string, userId: string, a: ApprovalRequest): void;
  get(approvalId: string): StoredApproval | null;
  /** Atomic: first writer wins so two phones cannot double-approve. Only the owning user may resolve. */
  resolve(approvalId: string, choice: ApprovalChoice, byUserId: string): ResolveOutcome;
  /** Unresolved, unexpired approvals for a user (for the mobile approval inbox). */
  pending(userId: string): ApprovalRequest[];
}
