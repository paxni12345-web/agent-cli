/**
 * Unit tests for Sandbox & Execution Isolation (security items 1–8).
 *
 * Covers:
 *  - SecureSandbox.buildRunArgs: docker isolation flags (network none,
 *    memory/cpu/pids caps, read-only rootfs, capped tmpfs, non-root user,
 *    fsize ulimit for disk quota, no-new-privileges, cap-drop ALL)
 *  - LocalSandbox.checkPathEscape: workspace path-escape rejection
 *  - LocalSandbox.wrap: ulimit resource caps, unshare/setpriv wrapping
 *  - PathValidator: canonicalization + traversal blocking (items 3–4)
 */

import { SecureSandbox, LocalSandbox, DEFAULT_DOCKER, SANDBOX_PROFILES } from '../../src/agent/SecurityPipeline.js';
import { PathValidator } from '../../src/tools/FileTools.js';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

// ---------------------------------------------------------------------------
// SecureSandbox docker args (items 1, 2, 5, 7, 8)
// ---------------------------------------------------------------------------

describe('SecureSandbox.buildRunArgs', () => {
  it('includes network isolation', () => {
    const sandbox = new SecureSandbox();
    const args = sandbox.buildRunArgs('echo hi', '/tmp/ws');
    const i = args.indexOf('--network');
    expect(i).toBeGreaterThan(-1);
    expect(args[i + 1]).toBe('none');
  });

  it('caps memory, cpus and pids (resource limits)', () => {
    const sandbox = new SecureSandbox({ memoryMb: 777, cpus: 2, pidsLimit: 99 });
    const args = sandbox.buildRunArgs('echo hi', '/tmp/ws');
    const memIdx = args.indexOf('--memory');
    expect(args[memIdx + 1]).toBe('777m');
    const cpuIdx = args.indexOf('--cpus');
    expect(args[cpuIdx + 1]).toBe('2');
    const pidIdx = args.indexOf('--pids-limit');
    expect(args[pidIdx + 1]).toBe('99');
  });

  it('mounts the workspace read-write by default and read-only when configured', () => {
    const rw = new SecureSandbox();
    const rwArgs = rw.buildRunArgs('echo hi', '/tmp/ws');
    const vIdx = rwArgs.indexOf('-v');
    expect(rwArgs[vIdx + 1]).toBe('/tmp/ws:/workspace');

    const ro = new SecureSandbox({ readOnlyWorkdir: true });
    const roArgs = ro.buildRunArgs('echo hi', '/tmp/ws');
    const roIdx = roArgs.indexOf('-v');
    expect(roArgs[roIdx + 1]).toBe('/tmp/ws:/workspace:ro');
  });

  it('runs as a non-root user by default (least privilege)', () => {
    const sandbox = new SecureSandbox();
    const args = sandbox.buildRunArgs('echo hi', '/tmp/ws');
    const uIdx = args.indexOf('--user');
    expect(uIdx).toBeGreaterThan(-1);
    expect(args[uIdx + 1]).toBe('nobody');
  });

  it('can disable the non-root user with an empty string', () => {
    const sandbox = new SecureSandbox({ user: '' });
    const args = sandbox.buildRunArgs('echo hi', '/tmp/ws');
    expect(args).not.toContain('--user');
  });

  it('uses a read-only rootfs with a size-capped noexec tmpfs at /tmp (disk quota)', () => {
    const sandbox = new SecureSandbox({ tmpfsMb: 128 });
    const args = sandbox.buildRunArgs('echo hi', '/tmp/ws');
    expect(args).toContain('--read-only');
    const tIdx = args.indexOf('--tmpfs');
    expect(tIdx).toBeGreaterThan(-1);
    expect(args[tIdx + 1]).toContain('/tmp:rw,noexec,nosuid,size=128m');
  });

  it('caps file size via fsize ulimit (disk quota)', () => {
    const sandbox = new SecureSandbox({ tmpfsMb: 64 });
    const args = sandbox.buildRunArgs('echo hi', '/tmp/ws');
    const ulIdx = args.indexOf('--ulimit');
    expect(ulIdx).toBeGreaterThan(-1);
    expect(args[ulIdx + 1]).toBe(`fsize=${64 * 1024 * 1024}`);
  });

  it('drops privileges hard: no-new-privileges + cap-drop ALL', () => {
    const sandbox = new SecureSandbox();
    const args = sandbox.buildRunArgs('echo hi', '/tmp/ws');
    const sIdx = args.indexOf('--security-opt');
    expect(args[sIdx + 1]).toBe('no-new-privileges');
    expect(args).toContain('--cap-drop');
    expect(args[args.indexOf('--cap-drop') + 1]).toBe('ALL');
  });

  it('passes the command through sh -c as the container entrypoint', () => {
    const sandbox = new SecureSandbox();
    const args = sandbox.buildRunArgs('echo hi && ls', '/tmp/ws');
    const imgIdx = args.indexOf(DEFAULT_DOCKER.image);
    expect(imgIdx).toBeGreaterThan(-1);
    expect(args.slice(imgIdx + 1)).toEqual(['sh', '-c', 'echo hi && ls']);
  });

  it('profiles provide their own resource defaults', () => {
    const alpine = new SecureSandbox({ profile: 'alpine' });
    expect(alpine.resolvedOptions.memoryMb).toBe(SANDBOX_PROFILES.alpine.memoryMb);
    expect(alpine.resolvedOptions.pidsLimit).toBe(SANDBOX_PROFILES.alpine.pidsLimit);
  });
});

// ---------------------------------------------------------------------------
// LocalSandbox path-escape check (items 1 + 2)
// ---------------------------------------------------------------------------

describe('LocalSandbox.checkPathEscape', () => {
  it('allows workspace-relative commands', () => {
    const ls = new LocalSandbox();
    expect(ls.checkPathEscape('ls -la src').ok).toBe(true);
    expect(ls.checkPathEscape('node dist/cli.js --help').ok).toBe(true);
    expect(ls.checkPathEscape('npm test').ok).toBe(true);
  });

  it('blocks absolute system paths outside the workspace', () => {
    const ls = new LocalSandbox();
    for (const cmd of [
      'cat /etc/passwd',
      'ls /usr/bin',
      'rm -rf /var/log',
      'cat /home/user/secret.txt',
      'chmod 777 /tmp',
    ]) {
      const verdict = ls.checkPathEscape(cmd);
      expect(verdict.ok).toBe(false);
      if (verdict.ok === false) expect(verdict.reason).toMatch(/outside the workspace/);
    }
  });

  it('blocks ~ and $HOME expansion', () => {
    const ls = new LocalSandbox();
    expect(ls.checkPathEscape('cat ~/.ssh/id_rsa').ok).toBe(false);
    expect(ls.checkPathEscape('ls $HOME').ok).toBe(false);
    expect(ls.checkPathEscape('cat ~/.bash_history').ok).toBe(false);
  });

  it('does not flag /-prefixed text inside quoted strings', () => {
    const ls = new LocalSandbox();
    // The quoted arg mentions a system path but as data, not a traversal.
    const verdict = ls.checkPathEscape('grep "see /etc/hosts for details" README.md');
    expect(verdict.ok).toBe(true);
  });

  it('is bypassable only via the explicit allowOutsideWorkspace option', () => {
    const permissive = new LocalSandbox({ allowOutsideWorkspace: true });
    expect(permissive.checkPathEscape('cat /etc/passwd').ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// LocalSandbox.wrap (items 5, 7, 8)
// ---------------------------------------------------------------------------

describe('LocalSandbox.wrap', () => {
  it('wraps the command with ulimit resource caps by default', async () => {
    const ls = new LocalSandbox();
    const { argv, guards } = await ls.wrap('node build.js');
    expect(argv[0]).toBe('sh');
    expect(argv[1]).toBe('-c');
    const shell = argv[2];
    expect(shell).toMatch(/ulimit -t 30/);
    expect(shell).toMatch(/ulimit -v 1048576/);
    expect(shell).toMatch(/ulimit -f 262144/);
    expect(shell).toMatch(/ulimit -u 128/);
    expect(shell).toMatch(/ulimit -c 0/);
    expect(shell).toContain('exec node build.js');
    expect(guards.some(g => g.startsWith('ulimit('))).toBe(true);
  });

  it('honors custom resource caps', async () => {
    const ls = new LocalSandbox({ cpuSeconds: 5, maxMemoryKb: 262144, maxFileKb: 1024, maxProcesses: 16 });
    const { argv } = await ls.wrap('make');
    const shell = argv[2];
    expect(shell).toMatch(/ulimit -t 5/);
    expect(shell).toMatch(/ulimit -v 262144/);
    expect(shell).toMatch(/ulimit -f 1024/);
    expect(shell).toMatch(/ulimit -u 16/);
  });

  it('prefers unshare -n for network isolation when available (Linux)', async () => {
    const ls = new LocalSandbox();
    const { argv, guards } = await ls.wrap('curl example.com');
    const shell = argv[2];
    if (process.platform === 'linux') {
      // unshare detection is cached; when the binary exists the prefix appears.
      const hasUnshare = shell.includes('unshare -n');
      if (hasUnshare) {
        expect(guards.some(g => g.includes('unshare -n'))).toBe(true);
        expect(shell).toMatch(/unshare -n .*exec curl example\.com/);
      }
    } else {
      expect(shell).not.toContain('unshare');
    }
  });

  it('can force network isolation on or off', async () => {
    const on = new LocalSandbox({ isolateNetwork: true });
    const off = new LocalSandbox({ isolateNetwork: false });
    const onShell = (await on.wrap('ls')).argv[2];
    const offShell = (await off.wrap('ls')).argv[2];
    if (process.platform === 'linux') {
      expect(onShell).toContain('unshare -n');
      expect(offShell).not.toContain('unshare');
    }
  });

  it('demotes from root via setpriv when running as root on Linux', async () => {
    const ls = new LocalSandbox();
    const { argv, guards } = await ls.wrap('id');
    const shell = argv[2];
    const runningAsRoot = typeof process.getuid === 'function' && process.getuid() === 0;
    if (runningAsRoot && process.platform === 'linux') {
      // setpriv may or may not be installed; both outcomes are valid but
      // must be reflected in the guards list.
      if (shell.includes('setpriv')) {
        expect(guards.some(g => g.includes('setpriv'))).toBe(true);
        // setpriv must come before the command.
        expect(shell.indexOf('setpriv')).toBeLessThan(shell.indexOf('exec id'));
      }
    } else {
      expect(shell).not.toContain('setpriv');
    }
    expect(shell).toContain('exec id');
  });
});

// ---------------------------------------------------------------------------
// PathValidator (items 3 + 4 — canonicalization & traversal)
// ---------------------------------------------------------------------------

describe('PathValidator workspace boundary (existing guarantees)', () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'agentcli-iso-'));
    await fs.mkdir(path.join(tmpRoot, 'src'), { recursive: true });
    await fs.writeFile(path.join(tmpRoot, 'src', 'a.ts'), 'export {};\n');
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('rejects ../ traversal (item 4)', async () => {
    await expect(PathValidator.validatePath('../outside.txt', tmpRoot)).rejects.toThrow(/traversal|outside|dangerous/i);
  });

  it('rejects encoded traversal (item 4)', async () => {
    await expect(PathValidator.validatePath('%2e%2e/secret', tmpRoot)).rejects.toThrow(/dangerous/i);
  });

  it('rejects symlink escapes to outside the workspace (items 3+4)', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'agentcli-out-'));
    await fs.writeFile(path.join(outside, 'leak.txt'), 'secret');
    const link = path.join(tmpRoot, 'link');
    await fs.symlink(outside, link);
    try {
      await expect(PathValidator.validatePath('link/leak.txt', tmpRoot)).rejects.toThrow(/outside workspace|traversal/i);
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });

  it('canonicalizes paths that resolve inside the workspace (item 3)', async () => {
    const resolved = await PathValidator.validatePath('src/a.ts', tmpRoot);
    expect(resolved.startsWith(path.resolve(tmpRoot))).toBe(true);
    expect(resolved.endsWith(path.join('src', 'a.ts'))).toBe(true);
  });

  it('allows paths for files that do not exist yet (resolve via nearest existing parent)', async () => {
    const resolved = await PathValidator.validatePath('src/deep/new-file.ts', tmpRoot);
    expect(resolved.startsWith(path.resolve(tmpRoot))).toBe(true);
  });
});
