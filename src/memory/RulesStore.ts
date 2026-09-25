/**
 * RulesStore — the "regulations & settings brain" (ChromaDB-style).
 *
 * Optimized for small, authoritative plain-text records that must be
 * stable and queryable by tags/metadata:
 *
 *   - guardrails        hard safety conditions ("never run npm publish")
 *   - user preferences  "concise reports", "answer in Thai"
 *   - project agreements the CLAUDE.md-style pact between user and agent
 *   - short-term history recent chat turns (session-scoped, TTL-capped)
 *
 * Storage: one JSON document per collection under .agent/memory/rules/ —
 * plain, inspectable, no native deps. Records carry metadata and optional
 * embedding-free keyword index entries for exact/tag retrieval.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { SecretScanner } from '../agent/SecretScanner.js';

export type RuleKind = 'guardrail' | 'preference' | 'agreement' | 'history';

export interface RuleRecord {
  id: string;
  kind: RuleKind;
  text: string;
  tags: string[];
  /** Arbitrary metadata (source, priority, scope…). */
  meta: Record<string, unknown>;
  createdAt: string;
  /** History records expire; rules/agreements are permanent until removed. */
  expiresAt?: string;
}

interface StoreShape {
  version: 1;
  records: RuleRecord[];
}

const TTL_HISTORY_MS = 6 * 60 * 60 * 1000; // short-term chat memory: 6h

export class RulesStore {
  private records: RuleRecord[] = [];
  private loaded = false;
  private seq = 0;

  constructor(private readonly memoryDir = '.agent/memory/rules') {}

  private storePath(workspaceRoot: string): string {
    return path.join(workspaceRoot, this.memoryDir, 'rules.json');
  }

  async load(workspaceRoot: string): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await fs.readFile(this.storePath(workspaceRoot), 'utf-8');
      const parsed = JSON.parse(raw) as StoreShape;
      if (parsed.version === 1 && Array.isArray(parsed.records)) {
        this.records = parsed.records;
      }
    } catch {
      this.records = [];
    }
    this.loaded = true;
  }

  async save(workspaceRoot: string): Promise<void> {
    const filePath = this.storePath(workspaceRoot);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const payload: StoreShape = { version: 1, records: this.records };
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
  }

  private newId(kind: RuleKind): string {
    return `${kind}-${Date.now().toString(36)}-${(++this.seq).toString(36)}`;
  }

  async add(
    workspaceRoot: string,
    kind: RuleKind,
    text: string,
    options: { tags?: string[]; meta?: Record<string, unknown> } = {}
  ): Promise<RuleRecord> {
    await this.load(workspaceRoot);
    // Items 29 + 85: memory is non-secret by contract — redact before persist.
    const scanner = new SecretScanner();
    const record: RuleRecord = {
      id: this.newId(kind),
      kind,
      text: scanner.redact(text.trim()).text.slice(0, 2000),
      tags: options.tags ?? [],
      meta: options.meta ?? {},
      createdAt: new Date().toISOString(),
    };
    if (kind === 'history') {
      record.expiresAt = new Date(Date.now() + TTL_HISTORY_MS).toISOString();
    }
    // Dedup: same kind + identical normalized text updates the existing
    // record (refresh timestamp) instead of piling up duplicates.
    const normalized = record.text.toLowerCase().replace(/\s+/g, ' ').trim();
    const existing = this.records.find(
      r => r.kind === kind && r.text.toLowerCase().replace(/\s+/g, ' ').trim() === normalized
    );
    if (existing) {
      existing.createdAt = record.createdAt;
      existing.tags = [...new Set([...existing.tags, ...record.tags])];
      await this.save(workspaceRoot);
      return existing;
    }
    this.records.push(record);
    await this.save(workspaceRoot);
    return record;
  }

  /** Removes records by predicate (used for history pruning / rule removal). */
  async removeWhere(
    workspaceRoot: string,
    predicate: (record: RuleRecord) => boolean
  ): Promise<number> {
    await this.load(workspaceRoot);
    const before = this.records.length;
    this.records = this.records.filter(record => !predicate(record));
    const removed = before - this.records.length;
    if (removed > 0) await this.save(workspaceRoot);
    return removed;
  }

  /** Queries by kind + optional tag/text filter; expires stale history lazily. */
  async query(
    workspaceRoot: string,
    options: { kind?: RuleKind; tags?: string[]; textContains?: string; limit?: number } = {}
  ): Promise<RuleRecord[]> {
    await this.load(workspaceRoot);
    const now = Date.now();
    const result: RuleRecord[] = [];
    for (const record of this.records) {
      if (record.expiresAt && new Date(record.expiresAt).getTime() < now) continue;
      if (options.kind && record.kind !== options.kind) continue;
      if (options.tags?.length && !options.tags.every(tag => record.tags.includes(tag))) continue;
      if (options.textContains && !record.text.toLowerCase().includes(options.textContains.toLowerCase())) continue;
      result.push(record);
      if (options.limit && result.length >= options.limit) break;
    }
    return result;
  }

  /** Renders guardrails + preferences + agreements for the system prompt. */
  async renderForPrompt(workspaceRoot: string, maxChars = 1800): Promise<string> {
    const sections: string[] = [];
    const guardrails = await this.query(workspaceRoot, { kind: 'guardrail' });
    const preferences = await this.query(workspaceRoot, { kind: 'preference' });
    const agreements = await this.query(workspaceRoot, { kind: 'agreement' });
    if (guardrails.length) {
      sections.push('GUARDRAILS (hard user rules — never violate):\n' + guardrails.map(r => `- ${r.text}`).join('\n'));
    }
    if (preferences.length) {
      sections.push('USER PREFERENCES:\n' + preferences.slice(-10).map(r => `- ${r.text}`).join('\n'));
    }
    if (agreements.length) {
      sections.push('PROJECT AGREEMENTS:\n' + agreements.slice(-10).map(r => `- ${r.text}`).join('\n'));
    }
    return sections.join('\n\n').slice(0, maxChars);
  }

  /** Short-term chat turns (auto-expiring). */
  async rememberTurn(workspaceRoot: string, role: 'user' | 'assistant', text: string): Promise<void> {
    await this.add(workspaceRoot, 'history', `[${role}] ${text}`.slice(0, 500), { tags: ['turn'] });
    // Keep only the latest 50 turns.
    const turns = await this.query(workspaceRoot, { kind: 'history' });
    if (turns.length > 50) {
      const stale = new Set(turns.slice(0, turns.length - 50).map(t => t.id));
      await this.removeWhere(workspaceRoot, r => stale.has(r.id));
    }
  }

  /** Recent turns as context lines (newest last). */
  async recentTurns(workspaceRoot: string, limit = 10): Promise<string[]> {
    const turns = await this.query(workspaceRoot, { kind: 'history', limit: 1000 });
    return turns.slice(-limit).map(t => t.text);
  }

  get size(): number {
    return this.records.length;
  }
}
