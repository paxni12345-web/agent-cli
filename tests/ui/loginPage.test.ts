import { readFileSync } from 'fs';
import { join } from 'path';
import { JSDOM, VirtualConsole } from 'jsdom';

const html = readFileSync(join(process.cwd(), 'public', 'login.html'), 'utf8');

describe('public/login.html', () => {
  it('does not hard-code a Firebase key (the server provides the config)', () => {
    expect(html).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
    expect(html).toContain('/api/auth/config');
  });

  it('loads a pinned Firebase SDK version only when sign-in is configured', () => {
    expect(html).toMatch(/firebasejs\/10\.\d+\.\d+\//);
    expect(html).toContain("cfg.mode !== 'firebase'");
  });

  it('asks the server whether the account is allowed before continuing', () => {
    expect(html).toContain('/api/agent/me');
  });

  it('only follows same-origin paths after sign-in', () => {
    const dom = new JSDOM(html, { url: 'http://localhost:3000/login.html', runScripts: 'dangerously', virtualConsole: new VirtualConsole() });
    const safeNext = (dom.window as any).safeNext as (raw: unknown) => string;
    expect(safeNext('/agent-ui.html')).toBe('/agent-ui.html');
    expect(safeNext('/agent-ui.html?x=1')).toBe('/agent-ui.html?x=1');
    for (const bad of ['//evil.example', 'https://evil.example', '/\\evil.example', 'javascript:alert(1)', '', null, undefined]) {
      expect(safeNext(bad)).toBe('/agent-ui.html');
    }
    dom.window.close();
  });
});
