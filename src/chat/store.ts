import crypto from 'crypto';

/**
 * Per-user chat storage. Every method takes the owner's uid and only ever
 * touches that user's rows: there is no call that reads across users except
 * the aggregate usage counter used for the global cost cap.
 */

export interface ChatRecord { id: string; title: string; createdAt: string; updatedAt: string }
export interface MessageRecord { role: 'user' | 'assistant'; content: string; createdAt: string }
export interface ChatWithMessages extends ChatRecord { messages: MessageRecord[] }

export interface ChatStore {
  listChats(uid: string, limit: number): Promise<ChatRecord[]>;
  countChats(uid: string): Promise<number>;
  createChat(uid: string, title: string): Promise<ChatRecord>;
  getChat(uid: string, chatId: string): Promise<ChatWithMessages | null>;
  setTitle(uid: string, chatId: string, title: string): Promise<void>;
  deleteChat(uid: string, chatId: string): Promise<boolean>;
  appendMessage(uid: string, chatId: string, message: Pick<MessageRecord, 'role' | 'content'>): Promise<void>;
  getUsage(uid: string, day: string): Promise<number>;
  getGlobalUsage(day: string): Promise<number>;
  addUsage(uid: string, day: string, tokens: number): Promise<void>;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** In-memory store for tests and local development. Data is lost on restart. */
export class MemoryChatStore implements ChatStore {
  private chats = new Map<string, { uid: string; rec: ChatRecord; messages: MessageRecord[] }>();
  private usage = new Map<string, number>();

  async listChats(uid: string, limit: number): Promise<ChatRecord[]> {
    return [...this.chats.values()].filter(c => c.uid === uid).map(c => c.rec)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
  }
  async countChats(uid: string): Promise<number> {
    return [...this.chats.values()].filter(c => c.uid === uid).length;
  }
  async createChat(uid: string, title: string): Promise<ChatRecord> {
    const now = new Date().toISOString();
    const rec = { id: crypto.randomUUID(), title, createdAt: now, updatedAt: now };
    this.chats.set(rec.id, { uid, rec, messages: [] });
    return { ...rec };
  }
  async getChat(uid: string, chatId: string): Promise<ChatWithMessages | null> {
    const c = this.chats.get(chatId);
    if (!c || c.uid !== uid) return null;
    return { ...c.rec, messages: c.messages.map(m => ({ ...m })) };
  }
  async setTitle(uid: string, chatId: string, title: string): Promise<void> {
    const c = this.chats.get(chatId);
    if (c && c.uid === uid) c.rec.title = title;
  }
  async deleteChat(uid: string, chatId: string): Promise<boolean> {
    const c = this.chats.get(chatId);
    if (!c || c.uid !== uid) return false;
    return this.chats.delete(chatId);
  }
  async appendMessage(uid: string, chatId: string, message: Pick<MessageRecord, 'role' | 'content'>): Promise<void> {
    const c = this.chats.get(chatId);
    if (!c || c.uid !== uid) throw new Error('chat not found');
    const now = new Date().toISOString();
    c.messages.push({ ...message, createdAt: now });
    c.rec.updatedAt = now;
  }
  async getUsage(uid: string, day: string): Promise<number> { return this.usage.get(`${uid}|${day}`) ?? 0; }
  async getGlobalUsage(day: string): Promise<number> {
    let total = 0;
    for (const [key, value] of this.usage) if (key.endsWith(`|${day}`)) total += value;
    return total;
  }
  async addUsage(uid: string, day: string, tokens: number): Promise<void> {
    this.usage.set(`${uid}|${day}`, (this.usage.get(`${uid}|${day}`) ?? 0) + tokens);
  }
}

/**
 * Supabase through its PostgREST API with the service-role key (server only,
 * never sent to browsers). Every query is scoped with user_id=eq.<uid>; row
 * level security is enabled with no policies, so the public anon key can read
 * nothing. See db/supabase.sql.
 */
export class SupabaseChatStore implements ChatStore {
  constructor(private readonly url: string, private readonly serviceKey: string, private readonly fetchImpl: typeof fetch = fetch) {}

  private async call<T>(method: string, path: string, body?: unknown, extra: Record<string, string> = {}): Promise<T> {
    const res = await this.fetchImpl(`${this.url.replace(/\/$/, '')}/rest/v1/${path}`, {
      method,
      headers: { apikey: this.serviceKey, Authorization: `Bearer ${this.serviceKey}`, 'Content-Type': 'application/json', ...extra },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`supabase ${method} ${path.split('?')[0]} failed: ${res.status}`);
    const text = await res.text();
    return (text ? JSON.parse(text) : null) as T;
  }
  private static q = (value: string) => encodeURIComponent(value);
  private static chat(row: Record<string, string>): ChatRecord {
    return { id: row.id, title: row.title, createdAt: row.created_at, updatedAt: row.updated_at };
  }

  async listChats(uid: string, limit: number): Promise<ChatRecord[]> {
    const rows = await this.call<Record<string, string>[]>('GET', `chats?user_id=eq.${SupabaseChatStore.q(uid)}&select=id,title,created_at,updated_at&order=updated_at.desc&limit=${Math.max(1, Math.floor(limit))}`);
    return rows.map(SupabaseChatStore.chat);
  }
  async countChats(uid: string): Promise<number> {
    const rows = await this.call<{ id: string }[]>('GET', `chats?user_id=eq.${SupabaseChatStore.q(uid)}&select=id&limit=1000`);
    return rows.length;
  }
  async createChat(uid: string, title: string): Promise<ChatRecord> {
    const rows = await this.call<Record<string, string>[]>('POST', 'chats', { user_id: uid, title }, { Prefer: 'return=representation' });
    return SupabaseChatStore.chat(rows[0]);
  }
  async getChat(uid: string, chatId: string): Promise<ChatWithMessages | null> {
    if (!UUID_RE.test(chatId)) return null;
    const rows = await this.call<Record<string, string>[]>('GET', `chats?id=eq.${chatId}&user_id=eq.${SupabaseChatStore.q(uid)}&select=id,title,created_at,updated_at`);
    if (!rows.length) return null;
    const msgs = await this.call<Record<string, string>[]>('GET', `messages?chat_id=eq.${chatId}&user_id=eq.${SupabaseChatStore.q(uid)}&select=role,content,created_at&order=id.asc&limit=1000`);
    return { ...SupabaseChatStore.chat(rows[0]), messages: msgs.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content, createdAt: m.created_at })) };
  }
  async setTitle(uid: string, chatId: string, title: string): Promise<void> {
    if (!UUID_RE.test(chatId)) return;
    await this.call('PATCH', `chats?id=eq.${chatId}&user_id=eq.${SupabaseChatStore.q(uid)}`, { title });
  }
  async deleteChat(uid: string, chatId: string): Promise<boolean> {
    if (!UUID_RE.test(chatId)) return false;
    const rows = await this.call<unknown[]>('DELETE', `chats?id=eq.${chatId}&user_id=eq.${SupabaseChatStore.q(uid)}`, undefined, { Prefer: 'return=representation' });
    return rows.length > 0;
  }
  async appendMessage(uid: string, chatId: string, message: Pick<MessageRecord, 'role' | 'content'>): Promise<void> {
    if (!UUID_RE.test(chatId)) throw new Error('chat not found');
    // The insert is only allowed for a chat this user owns (checked first, then bumped).
    const owned = await this.call<unknown[]>('PATCH', `chats?id=eq.${chatId}&user_id=eq.${SupabaseChatStore.q(uid)}`, { updated_at: new Date().toISOString() }, { Prefer: 'return=representation' });
    if (!owned.length) throw new Error('chat not found');
    await this.call('POST', 'messages', { chat_id: chatId, user_id: uid, role: message.role, content: message.content });
  }
  async getUsage(uid: string, day: string): Promise<number> {
    const rows = await this.call<{ tokens: number }[]>('GET', `usage_daily?user_id=eq.${SupabaseChatStore.q(uid)}&day=eq.${SupabaseChatStore.q(day)}&select=tokens`);
    return rows[0]?.tokens ?? 0;
  }
  async getGlobalUsage(day: string): Promise<number> {
    return Number(await this.call<number>('POST', 'rpc/global_usage', { p_day: day })) || 0;
  }
  async addUsage(uid: string, day: string, tokens: number): Promise<void> {
    await this.call('POST', 'rpc/add_usage', { p_user: uid, p_day: day, p_tokens: Math.max(0, Math.round(tokens)) });
  }
}

export function createChatStoreFromEnv(env: NodeJS.ProcessEnv = process.env): ChatStore | null {
  const url = env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && key) return new SupabaseChatStore(url, key);
  if (env.NODE_ENV === 'production') return null; // never keep public users' chats in process memory
  return new MemoryChatStore();
}
