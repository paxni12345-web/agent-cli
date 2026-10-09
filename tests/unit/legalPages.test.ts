import type { Server } from 'http';

let server: Server;
let base: string;
beforeAll(async () => {
  const app = (await import('../../src/agent-server.js')).default;
  await new Promise<void>(resolve => {
    server = app.listen(0, '127.0.0.1', () => {
      const a = server.address();
      base = `http://127.0.0.1:${typeof a === 'object' && a ? a.port : 0}`;
      resolve();
    });
  });
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });

describe('terms and privacy pages', () => {
  it('fill in the operator name and contact, escaped', async () => {
    process.env.PUBLIC_SERVICE_NAME = 'Iris <script>x</script>';
    process.env.PUBLIC_CONTACT_EMAIL = 'help@example.com';
    for (const page of ['/terms.html', '/privacy.html']) {
      const res = await fetch(base + page);
      const html = await res.text();
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      expect(html).toContain('help@example.com');
      expect(html).toContain('Iris &lt;script&gt;x&lt;/script&gt;');
      expect(html).not.toContain('<script>x');
      expect(html).not.toContain('{{');
    }
  });
  it('say so when no contact address is configured', async () => {
    delete process.env.PUBLIC_CONTACT_EMAIL;
    const html = await (await fetch(base + '/privacy.html')).text();
    expect(html).toContain('ยังไม่ได้ตั้งอีเมลติดต่อ');
    expect(html).not.toContain('{{');
  });
  it('are linked from the login page', async () => {
    const html = await (await fetch(base + '/login.html')).text();
    expect(html).toContain('href="/terms.html"');
    expect(html).toContain('href="/privacy.html"');
    expect(html).not.toContain('กู้คืนบัญชี');
  });
});
