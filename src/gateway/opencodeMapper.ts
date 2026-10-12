import type { ApprovalChoice, ApprovalRequest, PublishedEvent } from './types.js';

/**
 * Pure translation of OpenCode `/event` SSE payloads into gateway events.
 * Event shapes were checked against a real `opencode serve` 1.18.35 run (VERIFIED) and its
 * OpenAPI schema; items marked INFERRED come from the schema only and were not seen in a run.
 */

export interface OpenCodeRawEvent {
  type: string;
  properties?: Record<string, any>;
}

/** Per-stream memory so repeated `message.part.updated` snapshots do not produce duplicate events. */
export interface MapperState {
  userMessages: Set<string>;
  startedTools: Set<string>;
  finishedTools: Set<string>;
  doneParts: Set<string>;
  usageParts: Set<string>;
  textParts: Map<string, { messageId: string; text: string }>;
  lastStatus?: string;
}

export function newMapperState(): MapperState {
  return {
    userMessages: new Set(),
    startedTools: new Set(),
    finishedTools: new Set(),
    doneParts: new Set(),
    usageParts: new Set(),
    textParts: new Map(),
  };
}

const REPLY_TO_CHOICE: Record<string, ApprovalChoice> = { once: 'once', always: 'always', reject: 'deny' };

export function choiceToReply(choice: ApprovalChoice): 'once' | 'always' | 'reject' {
  switch (choice) {
    case 'once': return 'once';
    case 'always': return 'always';
    case 'deny': return 'reject';
    default:
      // OpenCode has no per-session grant; the gateway must not offer it for this backend.
      throw new Error(`OpenCode cannot honour approval choice "${choice}"`);
  }
}

function kindOf(permission: string): ApprovalRequest['kind'] {
  if (permission === 'bash') return 'shell';
  if (permission === 'edit' || permission === 'read' || permission === 'external_directory') return 'file';
  if (permission === 'webfetch' || permission === 'websearch') return 'network';
  return 'other';
}

/** Build the gateway approval from OpenCode's `permission.asked` properties or a `GET /permission` item. */
export function toApproval(p: Record<string, any>, now: number): ApprovalRequest {
  const patterns: string[] = Array.isArray(p.patterns) ? p.patterns : [];
  const command = typeof p.metadata?.command === 'string' ? p.metadata.command : undefined;
  return {
    id: p.id,
    upstreamId: p.id,
    kind: kindOf(String(p.permission ?? '')),
    summary: command ?? (patterns.join(', ') || String(p.permission ?? '')),
    detail: { permission: p.permission, patterns, metadata: p.metadata ?? {}, tool: p.tool },
    // "session" does not exist upstream; "always" is offered only because upstream supports it and the gateway may strip it.
    choices: ['once', 'always', 'deny'],
    createdAt: now,
  };
}

/** Translate one raw event. Returns [] for events that are not about `upstreamSessionId` or are not interesting. */
export function mapOpenCodeEvent(
  raw: OpenCodeRawEvent,
  upstreamSessionId: string,
  st: MapperState,
  now: () => number = Date.now,
): PublishedEvent[] {
  const p = raw.properties ?? {};
  if (p.sessionID !== upstreamSessionId) return [];
  const out: PublishedEvent[] = [];

  const setStatus = (status: 'running' | 'waiting_for_approval' | 'completed' | 'failed') => {
    if (st.lastStatus === status) return;
    st.lastStatus = status;
    out.push({ type: 'status', status });
  };

  switch (raw.type) {
    case 'message.updated': { // VERIFIED
      const info = p.info ?? {};
      if (info.role === 'user' && typeof info.id === 'string') st.userMessages.add(info.id);
      return out;
    }

    case 'message.part.updated': { // VERIFIED (text, tool, step-start); step-finish INFERRED from schema
      const part = p.part ?? {};
      const messageId: string = part.messageID;
      if (st.userMessages.has(messageId)) return out;

      if (part.type === 'text') {
        st.textParts.set(part.id, { messageId, text: part.text ?? '' });
        if (part.time?.end !== undefined && !st.doneParts.has(part.id)) {
          st.doneParts.add(part.id);
          out.push({ type: 'message.done', messageId: part.id, text: part.text ?? '' });
        }
      } else if (part.type === 'tool') {
        const callId: string = part.callID ?? part.id;
        const state = part.state ?? {};
        if ((state.status === 'pending' || state.status === 'running') && !st.startedTools.has(callId)) {
          st.startedTools.add(callId);
          setStatus('running');
          out.push({ type: 'tool.started', toolId: callId, name: String(part.tool), input: state.input });
        } else if ((state.status === 'completed' || state.status === 'error') && !st.finishedTools.has(callId)) {
          if (!st.startedTools.has(callId)) { // fast tool: never saw it start
            st.startedTools.add(callId);
            out.push({ type: 'tool.started', toolId: callId, name: String(part.tool), input: state.input });
          }
          st.finishedTools.add(callId);
          out.push({
            type: 'tool.finished', toolId: callId, ok: state.status === 'completed',
            output: state.status === 'completed' ? state.output : state.error,
          });
        }
      } else if (part.type === 'step-finish' && part.tokens && !st.usageParts.has(part.id)) {
        st.usageParts.add(part.id);
        const input = (part.tokens.input ?? 0) + (part.tokens.cache?.read ?? 0) + (part.tokens.cache?.write ?? 0);
        const output = (part.tokens.output ?? 0) + (part.tokens.reasoning ?? 0);
        out.push({
          type: 'usage', cumulative: false,
          usage: { inputTokens: input, outputTokens: output, totalTokens: input + output },
        });
      }
      return out;
    }

    case 'message.part.delta': { // INFERRED (schema only)
      if (p.field !== 'text' || typeof p.delta !== 'string' || st.userMessages.has(p.messageID)) return out;
      const known = st.textParts.get(p.partID);
      if (known) known.text += p.delta;
      else st.textParts.set(p.partID, { messageId: p.messageID, text: p.delta });
      out.push({ type: 'message.delta', messageId: p.partID, text: p.delta });
      return out;
    }

    case 'permission.asked': { // VERIFIED
      setStatus('waiting_for_approval');
      out.push({ type: 'approval.requested', approval: toApproval(p, now()) });
      return out;
    }

    case 'permission.replied': { // shape from schema; INFERRED in a run
      const choice = REPLY_TO_CHOICE[String(p.reply)] ?? 'deny';
      out.push({ type: 'approval.resolved', approvalId: String(p.requestID), choice });
      st.lastStatus = undefined; // approval gate is over: next status event re-announces running
      setStatus('running');
      return out;
    }

    case 'session.status': { // VERIFIED busy; idle/retry from schema
      const t = p.status?.type;
      if (t === 'busy') setStatus('running');
      else if (t === 'idle' && st.lastStatus !== undefined) setStatus('completed'); // idle before any work = fresh session
      return out;
    }

    case 'session.idle': // INFERRED (schema)
      if (st.lastStatus !== undefined) setStatus('completed');
      return out;

    case 'session.error': { // INFERRED (schema)
      const err = p.error ?? {};
      const aborted = err.name === 'MessageAbortedError';
      if (aborted) { setStatus('failed'); return out; }
      out.push({
        type: 'error', code: String(err.name ?? 'upstream_error'),
        message: String(err.data?.message ?? err.message ?? 'OpenCode session error'), retryable: false,
      });
      setStatus('failed');
      return out;
    }

    default:
      return out;
  }
}
