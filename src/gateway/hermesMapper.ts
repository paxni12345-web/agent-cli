import type { ApprovalChoice, ApprovalRequest, PublishedEvent } from './types.js';

/**
 * Translation of Hermes `/v1/runs/{id}/events` SSE payloads into gateway events.
 * VERIFIED in a real run: `tool.started`, `approval.request` (fields below), usage shape on completion.
 * From source (gateway/platforms/api_server_runs.py) but not seen in a run: `message.delta`,
 * `tool.completed`, `run.completed|failed|cancelled|interrupted`, `replay.truncated`.
 */

export interface HermesRawEvent {
  event: string;
  run_id?: string;
  seq?: number;
  [k: string]: unknown;
}

export interface HermesMapperState {
  runId: string;
  /** tool name -> FIFO of generated ids for tools that started but have not completed. */
  openTools: Map<string, string[]>;
  toolCounter: number;
  resolvedApprovals: Set<string>;
  terminal: boolean;
}

export function newHermesState(runId: string): HermesMapperState {
  return { runId, openTools: new Map(), toolCounter: 0, resolvedApprovals: new Set(), terminal: false };
}

const CHOICES: ApprovalChoice[] = ['once', 'session', 'always', 'deny'];

export function toHermesApproval(ev: Record<string, unknown>, runId: string, now: number): ApprovalRequest {
  const requestId = String(ev.request_id ?? '');
  const offered = Array.isArray(ev.choices) ? (ev.choices as unknown[]).filter((c): c is ApprovalChoice => CHOICES.includes(c as ApprovalChoice)) : [];
  const command = typeof ev.command === 'string' ? ev.command : undefined;
  return {
    id: requestId,
    upstreamId: requestId,
    kind: command !== undefined ? 'shell' : 'other',
    summary: command ?? String(ev.description ?? 'approval requested'),
    detail: { runId, description: ev.description, pattern: ev.pattern_key },
    choices: offered.length ? offered : ['once', 'deny'],
    createdAt: now,
  };
}

export function mapHermesEvent(raw: HermesRawEvent, st: HermesMapperState, now: () => number = Date.now): PublishedEvent[] {
  const out: PublishedEvent[] = [];
  switch (raw.event) {
    case 'message.delta':
      if (typeof raw.delta === 'string' && raw.delta) out.push({ type: 'message.delta', messageId: st.runId, text: raw.delta });
      return out;

    case 'tool.started': {
      const name = String(raw.tool ?? 'tool');
      const id = `${st.runId}:${++st.toolCounter}`;
      const q = st.openTools.get(name) ?? [];
      q.push(id);
      st.openTools.set(name, q);
      out.push({ type: 'tool.started', toolId: id, name, input: raw.preview });
      return out;
    }

    case 'tool.completed': {
      const name = String(raw.tool ?? 'tool');
      const id = st.openTools.get(name)?.shift() ?? `${st.runId}:${++st.toolCounter}`;
      out.push({ type: 'tool.finished', toolId: id, ok: raw.error !== true, output: typeof raw.preview === 'string' ? raw.preview : undefined });
      return out;
    }

    case 'approval.request': {
      const a = toHermesApproval(raw, st.runId, now());
      out.push({ type: 'status', status: 'waiting_for_approval' }, { type: 'approval.requested', approval: a });
      return out;
    }

    case 'approval.responded': { // may not be on the SSE stream; the adapter also synthesises it
      const id = String(raw.request_id ?? '');
      if (id && !st.resolvedApprovals.has(id)) {
        st.resolvedApprovals.add(id);
        out.push({ type: 'approval.resolved', approvalId: id, choice: (CHOICES.includes(raw.choice as ApprovalChoice) ? raw.choice : 'deny') as ApprovalChoice }, { type: 'status', status: 'running' });
      }
      return out;
    }

    case 'run.completed': {
      st.terminal = true;
      if (typeof raw.output === 'string') out.push({ type: 'message.done', messageId: st.runId, text: raw.output });
      const u = raw.usage as Record<string, number> | undefined;
      if (u) {
        const input = (u.input_tokens ?? 0) + (u.cache_read_tokens ?? 0) + (u.cache_write_tokens ?? 0);
        const output = u.output_tokens ?? 0;
        out.push({ type: 'usage', cumulative: false, usage: { inputTokens: input, outputTokens: output, totalTokens: input + output } });
      }
      out.push({ type: 'status', status: 'completed' });
      return out;
    }

    case 'run.failed':
      st.terminal = true;
      out.push({ type: 'error', code: 'run_failed', message: String(raw.error ?? raw.turn_exit_reason ?? 'agent run failed'), retryable: false }, { type: 'status', status: 'failed' });
      return out;

    case 'run.cancelled':
    case 'run.interrupted':
      st.terminal = true;
      out.push({ type: 'status', status: 'stopped' });
      return out;

    case 'replay.truncated':
      out.push({ type: 'error', code: 'upstream_replay_truncated', message: 'some run events were no longer available upstream', retryable: false });
      return out;

    default: // reasoning.available, message.interim, subagent.*, run.stopping, ...
      return out;
  }
}
