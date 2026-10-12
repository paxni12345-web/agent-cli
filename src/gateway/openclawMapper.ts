import type { ApprovalChoice, ApprovalRequest, PublishedEvent } from './types.js';

/**
 * Pure translation of OpenClaw gateway WebSocket events (protocol v4) into gateway events.
 * VERIFIED in a real 2026.9.9 run (see audit-openclaw.md / openclaw-approval-probe.mjs): event names `chat`, `agent`
 * (streams run_status / lifecycle / usage / item / assistant), `exec.approval.requested` / `.resolved`, the approval
 * fields id + request.command/cwd/host + allowedDecisions, `agent` item data.name/phase/status/error, and that `usage`
 * carries a running outputTokens. INFERRED (not seen in a run): where the text sits in `chat` payloads, the exact
 * item phase values, tool call ids, `chat` error/aborted states and a `sessionKey` field on events.
 */

export interface OpenClawFrame { event: string; payload?: Record<string, any> }

export interface OpenClawMapperState {
  sessionKey: string;
  /** Text seen so far for the current reply, so cumulative and incremental `chat` deltas both become deltas. */
  text: string;
  messageSeq: number;
  toolSeq: number;
  openTools: Map<string, string[]>;
  lastOutputTokens: number;
  lastStatus?: string;
}

export function newOpenClawState(sessionKey: string): OpenClawMapperState {
  return { sessionKey, text: '', messageSeq: 0, toolSeq: 0, openTools: new Map(), lastOutputTokens: -1 };
}

const DECISION_TO_CHOICE: Record<string, ApprovalChoice> = { 'allow-once': 'once', 'allow-always': 'always', deny: 'deny' };

export function choiceToDecision(choice: ApprovalChoice): 'allow-once' | 'allow-always' | 'deny' {
  switch (choice) {
    case 'once': return 'allow-once';
    case 'always': return 'allow-always';
    case 'deny': return 'deny';
    default: throw new Error(`OpenClaw cannot honour approval choice "${choice}"`);
  }
}

/** Text of a `chat` payload: a plain string field, or message content as a string or an array of text parts. */
export function extractText(p: Record<string, any>): string | undefined {
  for (const k of ['text', 'delta']) if (typeof p[k] === 'string') return p[k];
  const m = p.message;
  if (typeof m === 'string') return m;
  if (m && typeof m === 'object') {
    if (typeof m.text === 'string') return m.text;
    if (typeof m.content === 'string') return m.content;
    if (Array.isArray(m.content)) {
      const parts = m.content.filter((c: any) => typeof c?.text === 'string').map((c: any) => c.text as string);
      if (parts.length) return parts.join('');
    }
  }
  return undefined;
}

export function toApproval(p: Record<string, any>, now: number): ApprovalRequest {
  const req = p.request ?? {};
  const decisions: string[] = Array.isArray(p.allowedDecisions) ? p.allowedDecisions : ['allow-once', 'deny'];
  const choices = decisions.map((d) => DECISION_TO_CHOICE[d]).filter((c): c is ApprovalChoice => !!c);
  if (!choices.includes('deny')) choices.push('deny');
  const id = String(p.id ?? p.approvalId ?? p.requestId);
  return {
    id, upstreamId: id, kind: 'shell',
    summary: typeof req.command === 'string' ? req.command : 'Command approval',
    detail: { command: req.command, cwd: req.cwd, host: req.host, resolvedPath: req.resolvedPath, commandAnalysis: req.commandAnalysis },
    choices, createdAt: now,
  };
}

export function mapOpenClawEvent(f: OpenClawFrame, st: OpenClawMapperState, now: () => number = Date.now): PublishedEvent[] {
  const p = f.payload ?? {};
  const out: PublishedEvent[] = [];
  const setStatus = (s: 'running' | 'waiting_for_approval' | 'completed' | 'failed') => {
    if (st.lastStatus === s) return;
    st.lastStatus = s;
    out.push({ type: 'status', status: s });
  };
  const forOtherSession = typeof p.sessionKey === 'string' && p.sessionKey !== st.sessionKey;
  const msgId = () => `${st.sessionKey}:m${st.messageSeq}`;

  switch (f.event) {
    case 'exec.approval.requested': {
      if (forOtherSession || (typeof p.request?.sessionKey === 'string' && p.request.sessionKey !== st.sessionKey)) return out;
      setStatus('waiting_for_approval');
      out.push({ type: 'approval.requested', approval: toApproval(p, now()) });
      return out;
    }
    case 'exec.approval.resolved': { // field names for the decision are INFERRED
      if (forOtherSession) return out;
      const choice = DECISION_TO_CHOICE[String(p.decision)] ?? 'deny';
      out.push({ type: 'approval.resolved', approvalId: String(p.id ?? p.approvalId ?? p.requestId), choice });
      st.lastStatus = undefined;
      setStatus('running');
      return out;
    }
    case 'chat': {
      if (forOtherSession) return out;
      if (p.state === 'delta') {
        const t = extractText(p);
        if (t === undefined || t === '') return out;
        setStatus('running');
        // Cumulative snapshot (starts with what we have) => send only the new part; otherwise it is already a chunk.
        const delta = st.text && t.startsWith(st.text) ? t.slice(st.text.length) : t;
        st.text = st.text && t.startsWith(st.text) ? t : st.text + t;
        if (delta) out.push({ type: 'message.delta', messageId: msgId(), text: delta });
        return out;
      }
      if (p.state === 'final') {
        const text = extractText(p) ?? st.text;
        if (text) out.push({ type: 'message.done', messageId: msgId(), text });
        st.text = ''; st.messageSeq++;
        setStatus('completed');
        return out;
      }
      if (p.state === 'error' || p.state === 'aborted') { // INFERRED states
        if (p.state === 'error') out.push({ type: 'error', code: 'openclaw_error', message: String(p.errorMessage ?? p.error?.message ?? 'OpenClaw run failed'), retryable: false });
        st.text = ''; st.messageSeq++;
        setStatus('failed');
        return out;
      }
      if (p.state === 'status') setStatus('running');
      return out;
    }
    case 'agent': {
      if (forOtherSession) return out;
      const d = p.data ?? {};
      if (p.stream === 'run_status' || p.stream === 'lifecycle') {
        if (st.lastStatus !== 'waiting_for_approval') setStatus('running');
      } else if (p.stream === 'item' && typeof d.name === 'string') {
        const key = String(d.id ?? d.toolCallId ?? d.itemId ?? '');
        if (d.phase === 'start') {
          const id = key || `${d.name}#${++st.toolSeq}`;
          const q = st.openTools.get(d.name) ?? [];
          q.push(id); st.openTools.set(d.name, q);
          setStatus('running');
          out.push({ type: 'tool.started', toolId: id, name: d.name, input: d.input ?? d.args });
        } else if (d.phase === 'end') {
          const id = key || st.openTools.get(d.name)?.shift() || `${d.name}#${++st.toolSeq}`;
          if (key) st.openTools.set(d.name, (st.openTools.get(d.name) ?? []).filter((x) => x !== key));
          const failed = !!d.error || d.status === 'error' || d.status === 'failed';
          out.push({ type: 'tool.finished', toolId: id, ok: !failed, output: failed ? d.error : (d.output ?? d.result) });
        }
      } else if (p.stream === 'usage' && typeof d.outputTokens === 'number' && d.outputTokens !== st.lastOutputTokens) {
        st.lastOutputTokens = d.outputTokens;
        const input = typeof d.inputTokens === 'number' ? d.inputTokens : 0;
        out.push({ type: 'usage', cumulative: true, usage: { inputTokens: input, outputTokens: d.outputTokens, totalTokens: input + d.outputTokens } });
      }
      return out;
    }
    default:
      return out;
  }
}
