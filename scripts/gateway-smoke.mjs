#!/usr/bin/env node
// Smoke test for a running gateway. Usage:
//   GATEWAY_URL=https://your-app.onrender.com SMOKE_AUTH="Bearer <user token>" node scripts/gateway-smoke.mjs chat code work agent
// SMOKE_AUTH is the full Authorization header value your app's login accepts.
// For each mode: create session -> send a message -> read events until completed/failed -> print a verdict.
const base = (process.env.GATEWAY_URL ?? '').replace(/\/+$/, '');
const auth = process.env.SMOKE_AUTH;
if (!base || !auth) { console.error('Set GATEWAY_URL and SMOKE_AUTH'); process.exit(2); }
const modes = process.argv.slice(2).length ? process.argv.slice(2) : ['chat'];
const H = { authorization: auth, 'content-type': 'application/json' };
const api = (p, o = {}) => fetch(`${base}/api/v2${p}`, { ...o, headers: { ...H, ...(o.headers ?? {}) } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function create(mode) {
  for (let i = 0; i < 100; i++) { // sandbox modes answer 202 "starting" until the container is up
    const r = await api('/sessions', { method: 'POST', body: JSON.stringify({ mode }) });
    const b = await r.json().catch(() => ({}));
    if (r.status === 201) return b.id;
    if (r.status === 202) { await sleep(3000); continue; }
    throw new Error(`create ${r.status}: ${JSON.stringify(b)}`);
  }
  throw new Error('sandbox did not start in time');
}

async function run(mode) {
  const prompt = mode === 'chat' ? 'Reply with the single word: pong' : 'Create a file hello.txt containing "hi", then tell me it is done.';
  const id = await create(mode);
  const ev = await api(`/sessions/${id}/events`); // read via fetch (EventSource cannot send Authorization)
  const send = await api(`/sessions/${id}/messages`, { method: 'POST', body: JSON.stringify({ text: prompt }) });
  if (send.status !== 202) throw new Error(`send ${send.status}`);
  const seen = { text: '', usage: false, approvals: 0, status: '' };
  const dec = new TextDecoder(); let buf = '';
  const deadline = Date.now() + 180_000;
  for await (const chunk of ev.body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i); buf = buf.slice(i + 2);
      const data = block.split('\n').find((l) => l.startsWith('data: '));
      if (!data) continue;
      const e = JSON.parse(data.slice(6));
      if (e.type === 'message.done') seen.text = e.text;
      if (e.type === 'usage') seen.usage = true;
      if (e.type === 'status') seen.status = e.status;
      if (e.type === 'error') seen.error = e.message;
      if (e.type === 'approval.requested') { // auto-allow once so tool modes can finish
        seen.approvals++;
        await api(`/sessions/${id}/approvals/${encodeURIComponent(e.approval.id)}`, { method: 'POST', body: JSON.stringify({ choice: 'once' }) });
      }
    }
    if (seen.status === 'completed' || seen.status === 'failed' || Date.now() > deadline) break;
  }
  await api(`/sessions/${id}`, { method: 'DELETE' });
  return seen;
}

let bad = 0;
for (const mode of modes) {
  try {
    const s = await run(mode);
    const ok = s.status === 'completed' && s.text && s.usage;
    if (!ok) bad++;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${mode}: status=${s.status} usage=${s.usage} approvals=${s.approvals} reply=${JSON.stringify(s.text.slice(0, 80))}${s.error ? ' error=' + s.error : ''}`);
  } catch (err) { bad++; console.log(`FAIL ${mode}: ${err.message}`); }
}
const u = await api('/usage'); console.log('usage:', JSON.stringify(await u.json().catch(() => ({}))));
process.exit(bad ? 1 : 0);
