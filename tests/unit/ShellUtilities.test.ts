/**
 * ShellUtilities — category F (101-120).
 * Behavioral tests: pure helpers directly, process helpers against
 * real short-lived commands (node/echo/cat), sandbox via ShellSafety.
 */
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import {
  ExecError,
  backgroundJobManager,
  blacklistPatternCheck,
  captureStdoutStderr,
  commandHistoryLogger,
  detectDestructiveCommand,
  dryRunCommandPreview,
  envVarInjector,
  execSafe,
  execWithRetry,
  execWithTimeout,
  exitCodeInterpreter,
  interactivePromptDetector,
  killProcessTree,
  pipelineComposer,
  processHealthCheck,
  processResourceLimiter,
  sandboxExec,
  shellEscapeArg,
  streamProcessOutput,
  whitelistCommandCheck,
} from '../../src/utils/ShellUtilities.js';

describe('execSafe (101)', () => {
  it('runs argv without a shell and captures output', async () => {
    const r = await execSafe('node', ['-e', "console.log('hi')"]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('hi');
  });

  it('rejects with ExecError on nonzero exit', async () => {
    const err = await execSafe('node', ['-e', 'process.exit(3)']).catch(e => e);
    expect(err).toBeInstanceOf(ExecError);
    expect((err as ExecError).exitCode).toBe(3);
  });

  it('rejects unknown programs instead of hanging', async () => {
    await expect(execSafe('definitely-not-a-real-binary-xyz', [])).rejects.toThrow();
  });
});

describe('execWithTimeout (102)', () => {
  it('resolves when the command finishes in time', async () => {
    const r = await execWithTimeout('node', ['-e', "console.log('fast')"], { timeoutMs: 10000 });
    expect(r.stdout).toContain('fast');
  });

  it('flags timedOut when the deadline passes', async () => {
    const err = await execWithTimeout('node', ['-e', 'setTimeout(()=>{},5000)'], { timeoutMs: 300 }).catch(e => e);
    expect(err).toBeInstanceOf(ExecError);
    expect((err as ExecError).timedOut).toBe(true);
    expect((err as ExecError).exitCode).toBe(124);
  });

  it('validates timeoutMs', async () => {
    await expect(execWithTimeout('node', ['-e', '1'], { timeoutMs: 0 })).rejects.toThrow(/timeoutMs/);
  });
});

describe('execWithRetry (103)', () => {
  it('returns attempts=1 on first-try success', async () => {
    const r = await execWithRetry('node', ['-e', "console.log('ok')"], { retries: 2, delayMs: 10 });
    expect(r.attempts).toBe(1);
    expect(r.stdout).toContain('ok');
  });

  it('retries then throws the last error with attempt count', async () => {
    const err = await execWithRetry('node', ['-e', 'process.exit(1)'], { retries: 2, delayMs: 10 }).catch(e => e);
    expect(err).toBeInstanceOf(ExecError);
    expect((err as ExecError).attempts).toBe(3);
  });
});

describe('streamProcessOutput (104)', () => {
  it('streams chunks while capturing the full result', async () => {
    const outChunks: string[] = [];
    const errChunks: string[] = [];
    const r = await streamProcessOutput('node', ['-e', "console.log('out'); console.error('err')"], {
      onStdout: c => outChunks.push(c),
      onStderr: c => errChunks.push(c),
    });
    expect(r.stdout).toContain('out');
    expect(r.stderr).toContain('err');
    expect(outChunks.join('')).toContain('out');
    expect(errChunks.join('')).toContain('err');
  });
});

describe('killProcessTree (105)', () => {
  it('rejects invalid pids', () => {
    expect(() => killProcessTree(0)).toThrow(/pid/);
    expect(() => killProcessTree(-5)).toThrow(/pid/);
  });

  it('returns false for a pid that does not exist', () => {
    expect(killProcessTree(2147483647)).toBe(false);
  });
});

describe('sandboxExec (106)', () => {
  it('blocks dangerous commands without spawning', async () => {
    const r = await sandboxExec('rm -rf /', { cwd: process.cwd() });
    expect(r.ok).toBe(false);
    expect(r.reason ?? r.stderr).toMatch(/dangerous|blocked/i);
  });

  it('runs reviewed commands with sandbox guards', async () => {
    const r = await sandboxExec('echo hello', { cwd: process.cwd(), timeoutMs: 15000 });
    expect(r.ok).toBe(true);
    expect(r.stdout).toContain('hello');
    expect(r.guards?.join(' ')).toMatch(/ulimit/);
  });
});

describe('whitelistCommandCheck (107)', () => {
  it('allows listed programs', () => {
    expect(whitelistCommandCheck('git status', ['git', 'npm'])).toMatchObject({ ok: true, program: 'git' });
  });

  it('blocks programs outside the list', () => {
    const r = whitelistCommandCheck('curl https://example.com', ['git']);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/allowlist/);
  });
});

describe('blacklistPatternCheck (108)', () => {
  const patterns = [{ id: 'no-rm', pattern: /\brm\b/, why: 'no deletes' }];
  it('hits the first matching pattern', () => {
    expect(blacklistPatternCheck('rm foo', patterns)).toMatchObject({ blocked: true, id: 'no-rm' });
  });

  it('passes clean commands', () => {
    expect(blacklistPatternCheck('git status', patterns)).toEqual({ blocked: false });
  });
});

describe('detectDestructiveCommand (109)', () => {
  it('flags rm -rf / and raw disk writes', () => {
    expect(detectDestructiveCommand('rm -rf /').destructive).toBe(true);
    expect(detectDestructiveCommand('dd if=/dev/zero of=/dev/sda').destructive).toBe(true);
  });

  it('passes everyday commands', () => {
    expect(detectDestructiveCommand('git status').destructive).toBe(false);
    expect(detectDestructiveCommand('npm test').destructive).toBe(false);
  });
});

describe('captureStdoutStderr (110)', () => {
  it('returns ok:false with data instead of throwing', async () => {
    const r = await captureStdoutStderr('node', ['-e', "console.error('boom'); process.exit(2)"]);
    expect(r.ok).toBe(false);
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toContain('boom');
  });
});

describe('envVarInjector (111)', () => {
  it('injects only allowlisted keys', () => {
    const env = envVarInjector({ KEEP: '1', DROP: '2' }, ['KEEP'], {});
    expect(env.KEEP).toBe('1');
    expect(env.DROP).toBeUndefined();
  });

  it('injects everything without an allowlist', () => {
    const env = envVarInjector({ A: 'x' }, undefined, {});
    expect(env.A).toBe('x');
  });
});

describe('processResourceLimiter (112)', () => {
  it('builds a ulimit prefix with defaults', () => {
    const { prefix, description } = processResourceLimiter({});
    expect(prefix).toMatch(/ulimit -t 30/);
    expect(description).toMatch(/cpu=30s/);
  });

  it('honours custom caps', () => {
    const { prefix } = processResourceLimiter({ cpuSeconds: 5, maxProcesses: 16 });
    expect(prefix).toMatch(/ulimit -t 5/);
    expect(prefix).toMatch(/ulimit -u 16/);
  });
});

describe('commandHistoryLogger (113)', () => {
  it('appends one JSON line per entry', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hist-'));
    const log = path.join(dir, 'commands.log');
    await commandHistoryLogger(log, { command: 'git status', exitCode: 0 });
    const text = await fs.readFile(log, 'utf-8');
    expect(JSON.parse(text.trim())).toMatchObject({ command: 'git status', exitCode: 0 });
  });
});

describe('interactivePromptDetector (114)', () => {
  it('spots prompts that would hang stdin', () => {
    expect(interactivePromptDetector('Password: ')).toBe(true);
    expect(interactivePromptDetector('Are you sure? (y/n)')).toBe(true);
  });

  it('passes plain output', () => {
    expect(interactivePromptDetector('all tests passed\n')).toBe(false);
  });
});

describe('exitCodeInterpreter (115)', () => {
  it('explains common codes', () => {
    expect(exitCodeInterpreter(0)).toMatchObject({ ok: true, kind: 'success' });
    expect(exitCodeInterpreter(127).kind).toBe('not-found');
    expect(exitCodeInterpreter(137).message).toMatch(/memory/i);
    expect(exitCodeInterpreter(1).kind).toBe('failure');
  });

  it('explains signals', () => {
    expect(exitCodeInterpreter(0, 'SIGKILL')).toMatchObject({ ok: false, kind: 'signal' });
  });
});

describe('shellEscapeArg (116)', () => {
  it('leaves safe args bare', () => {
    expect(shellEscapeArg('plain-arg_1')).toBe('plain-arg_1');
  });

  it('single-quotes args with spaces', () => {
    expect(shellEscapeArg('hello world')).toBe("'hello world'");
  });

  it('escapes embedded single quotes', () => {
    const out = shellEscapeArg("it's");
    expect(out.startsWith("'")).toBe(true);
    expect(out).toContain('it');
  });
});

describe('pipelineComposer (117)', () => {
  it('pipes stdout of one stage into stdin of the next', async () => {
    const r = await pipelineComposer([['echo', 'hello'], ['cat']]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('hello');
  });

  it('reports which stage failed', async () => {
    const err = await pipelineComposer([
      ['echo', 'hi'],
      ['node', '-e', 'process.exit(7)'],
    ]).catch(e => e);
    expect(err).toBeInstanceOf(ExecError);
    expect((err as Error).message).toMatch(/stage 1/);
  });

  it('requires at least one stage', async () => {
    await expect(pipelineComposer([])).rejects.toThrow(/one stage/);
  });
});

describe('backgroundJobManager (118)', () => {
  it('starts, lists, waits and reports a quick job', async () => {
    const mgr = backgroundJobManager();
    const job = mgr.start('node', ['-e', 'setTimeout(()=>{},300)']);
    expect(job.status).toBe('running');
    expect(mgr.list().map(j => j.id)).toContain(job.id);
    const done = await mgr.wait(job.id, 10000);
    expect(['exited', 'failed', 'killed']).toContain(done.status);
  });

  it('kills a long-running job', async () => {
    const mgr = backgroundJobManager();
    const job = mgr.start('node', ['-e', 'setInterval(()=>{},1000)']);
    expect(mgr.kill(job.id)).toBe(true);
    const done = await mgr.wait(job.id, 10000);
    expect(done.status).not.toBe('running');
  });

  it('rejects unknown job ids', async () => {
    const mgr = backgroundJobManager();
    await expect(mgr.wait(999999, 100)).rejects.toThrow(/Unknown job/);
  });
});

describe('processHealthCheck (119)', () => {
  it('reports the current process as alive', () => {
    expect(processHealthCheck(process.pid)).toEqual({ alive: true, pid: process.pid });
  });

  it('reports a missing pid as dead', () => {
    expect(processHealthCheck(2147483647).alive).toBe(false);
  });
});

describe('dryRunCommandPreview (120)', () => {
  it('previews without executing', () => {
    const text = dryRunCommandPreview('git status');
    expect(text).toMatch(/DRY-RUN/);
    expect(text).toMatch(/git status/);
  });

  it('shows BLOCK for dangerous commands', () => {
    expect(dryRunCommandPreview('rm -rf /')).toMatch(/BLOCK/);
  });
});
