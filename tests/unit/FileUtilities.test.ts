import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import {
  atomicWriteFile,
  backupBeforeWrite,
  binaryFileDetector,
  detectFileEncoding,
  dirTreeToJSON,
  diskUsageCheck,
  fileLockAcquire,
  fileLockRelease,
  filePermissionSetter,
  findEmptyDirectories,
  getFileExtension,
  getFileHash,
  globMatch,
  ignorePatternLoader,
  isWithinWorkspace,
  lineEndingNormalizer,
  mergeDirectories,
  readFileChunked,
  resolveSafePath,
  symlinkResolver,
  tempWorkspaceCreate,
} from '../../src/utils/FileUtilities.js';

async function makeWorkspace(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'agent-cli-file-utils-'));
}

describe('FileUtilities (500-functions category A)', () => {
  it('resolves paths safely and rejects traversal and symlink escapes', async () => {
    const root = await makeWorkspace();
    const inside = path.join(root, 'inside');
    await fs.mkdir(inside);
    await fs.writeFile(path.join(inside, 'ok.txt'), 'ok');
    expect(await resolveSafePath(root, 'inside/ok.txt')).toBe(path.join(inside, 'ok.txt'));
    expect(await isWithinWorkspace('inside/ok.txt', root)).toBe(true);
    expect(await isWithinWorkspace('../outside.txt', root)).toBe(false);

    const outside = await makeWorkspace();
    await fs.writeFile(path.join(outside, 'secret.txt'), 'secret');
    await fs.symlink(outside, path.join(root, 'escape'));
    await expect(resolveSafePath(root, 'escape/secret.txt')).rejects.toThrow(/workspace/i);
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  });

  it('extracts a file extension without treating a dotfile as an extension', () => {
    expect(getFileExtension('src/file.TS')).toBe('.TS');
    expect(getFileExtension('.gitignore')).toBe('');
    expect(getFileExtension('archive.tar.gz')).toBe('.gz');
  });

  it('detects UTF-8 and UTF-16 BOMs and binary buffers', () => {
    expect(detectFileEncoding(Buffer.from([0xef, 0xbb, 0xbf, 0x61]))).toMatchObject({ encoding: 'utf-8', bom: true, isBinary: false });
    expect(detectFileEncoding(Buffer.from([0xff, 0xfe, 0x61, 0x00]))).toMatchObject({ encoding: 'utf-16le', bom: true, isBinary: false });
    expect(detectFileEncoding(Buffer.from([0xfe, 0xff, 0x00, 0x61]))).toMatchObject({ encoding: 'utf-16be', bom: true, isBinary: false });
    expect(detectFileEncoding(Buffer.from([0x61, 0x00, 0x62]))).toMatchObject({ encoding: 'binary', isBinary: true });
  });

  it('streams files in bounded chunks without changing their bytes', async () => {
    const root = await makeWorkspace();
    const file = path.join(root, 'large.bin');
    const original = Buffer.from(Array.from({ length: 257 }, (_, i) => i % 256));
    await fs.writeFile(file, original);
    const chunks: Buffer[] = [];
    for await (const chunk of readFileChunked(file, 31)) chunks.push(chunk);
    expect(chunks.every(chunk => chunk.length <= 31)).toBe(true);
    expect(Buffer.concat(chunks)).toEqual(original);
    await fs.rm(root, { recursive: true, force: true });
  });

  it('writes atomically, preserves existing permissions and supports a new mode', async () => {
    const root = await makeWorkspace();
    const file = path.join(root, 'config.json');
    await fs.writeFile(file, 'old', { mode: 0o640 });
    await atomicWriteFile(file, 'new');
    expect(await fs.readFile(file, 'utf8')).toBe('new');
    expect((await fs.stat(file)).mode & 0o777).toBe(0o640);
    await atomicWriteFile(file, 'secret', { mode: 0o600 });
    expect((await fs.stat(file)).mode & 0o777).toBe(0o600);
    expect((await fs.readdir(root)).filter(name => name.endsWith('.tmp'))).toEqual([]);
    await fs.rm(root, { recursive: true, force: true });
  });

  it('hashes files using a streaming digest', async () => {
    const root = await makeWorkspace();
    const file = path.join(root, 'data.txt');
    await fs.writeFile(file, 'agent-cli');
    const actual = await getFileHash(file);
    const { createHash } = await import('crypto');
    expect(actual).toBe(createHash('sha256').update('agent-cli').digest('hex'));
    await fs.rm(root, { recursive: true, force: true });
  });

  it('matches simple and recursive workspace globs', () => {
    expect(globMatch('src/*.ts', 'src/app.ts')).toBe(true);
    expect(globMatch('src/*.ts', 'src/deep/app.ts')).toBe(false);
    expect(globMatch('src/**/*.ts', 'src/deep/app.ts')).toBe(true);
    expect(globMatch('*.md', 'README.md')).toBe(true);
    expect(globMatch('*.md', 'docs/README.md')).toBe(false);
  });

  it('loads non-empty ignore rules from gitignore and agentignore', async () => {
    const root = await makeWorkspace();
    await fs.writeFile(path.join(root, '.gitignore'), '# build output\ndist/\n\n*.log\n');
    await fs.writeFile(path.join(root, '.agentignore'), 'vendor/**\n!vendor/keep.ts\n');
    expect(await ignorePatternLoader(root)).toEqual(['dist/', '*.log', 'vendor/**', '!vendor/keep.ts']);
    await fs.rm(root, { recursive: true, force: true });
  });

  it('builds a sorted directory tree without following symlinks', async () => {
    const root = await makeWorkspace();
    await fs.mkdir(path.join(root, 'src'));
    await fs.writeFile(path.join(root, 'src', 'a.ts'), 'x');
    await fs.symlink(path.join(root, 'src'), path.join(root, 'src-link'));
    const tree = await dirTreeToJSON(root);
    expect(tree.type).toBe('directory');
    expect(tree.children?.map(child => child.name)).toEqual(['src', 'src-link']);
    expect(tree.children?.[0].children?.[0]).toMatchObject({ name: 'a.ts', type: 'file', size: 1 });
    expect(tree.children?.[1].type).toBe('symlink');
    await fs.rm(root, { recursive: true, force: true });
  });

  it('finds empty directories and skips symlinks', async () => {
    const root = await makeWorkspace();
    await fs.mkdir(path.join(root, 'empty', 'nested'), { recursive: true });
    await fs.mkdir(path.join(root, 'has-file'));
    await fs.writeFile(path.join(root, 'has-file', 'x'), 'x');
    await fs.symlink(path.join(root, 'empty'), path.join(root, 'empty-link'));
    expect(await findEmptyDirectories(root)).toEqual([path.join('empty', 'nested')]);
    await fs.rm(root, { recursive: true, force: true });
  });

  it('acquires exclusive file locks, releases only its own lock, and times out on contention', async () => {
    const root = await makeWorkspace();
    const lockPath = path.join(root, 'locks', 'task.lock');
    const lock = await fileLockAcquire(lockPath, { timeoutMs: 100, retryMs: 5 });
    await expect(fileLockAcquire(lockPath, { timeoutMs: 20, retryMs: 5 })).rejects.toThrow(/timed out/i);
    await fileLockRelease(lock);
    await fileLockRelease(lock); // release is idempotent
    const next = await fileLockAcquire(lockPath, { timeoutMs: 100 });
    await fileLockRelease(next);
    await expect(fs.access(lockPath)).rejects.toThrow();
    await fs.rm(root, { recursive: true, force: true });
  });

  it('creates a disposable temp workspace inside .agent and cleans it up', async () => {
    const root = await makeWorkspace();
    const temp = await tempWorkspaceCreate(root, 'dry-run');
    expect(temp.path.startsWith(path.join(root, '.agent', 'tmp'))).toBe(true);
    await fs.writeFile(path.join(temp.path, 'probe.txt'), 'temporary');
    await temp.cleanup();
    await expect(fs.access(temp.path)).rejects.toThrow();
    await fs.rm(root, { recursive: true, force: true });
  });

  it('checks available disk space against required plus reserved bytes', async () => {
    const root = await makeWorkspace();
    const available = await diskUsageCheck(root, 0);
    expect(available.ok).toBe(true);
    const impossible = await diskUsageCheck(root, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    expect(impossible.ok).toBe(false);
    await fs.rm(root, { recursive: true, force: true });
  });

  it('detects binary files from a bounded sample', async () => {
    const root = await makeWorkspace();
    const text = path.join(root, 'text.txt');
    const binary = path.join(root, 'binary.bin');
    await fs.writeFile(text, 'hello\nworld');
    await fs.writeFile(binary, Buffer.from([0, 1, 2, 3]));
    expect(await binaryFileDetector(text)).toBe(false);
    expect(await binaryFileDetector(binary)).toBe(true);
    await fs.rm(root, { recursive: true, force: true });
  });

  it('normalizes mixed line endings to the requested convention', () => {
    expect(lineEndingNormalizer('a\r\nb\rc\n')).toBe('a\nb\nc\n');
    expect(lineEndingNormalizer('a\nb', '\r\n')).toBe('a\r\nb');
  });

  it('creates backups before writes and restores them safely', async () => {
    const root = await makeWorkspace();
    const file = path.join(root, 'src', 'config.json');
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, '{"before":true}');
    const backup = await backupBeforeWrite(root, file, 'unit-task');
    await fs.writeFile(file, '{"after":true}');
    await backup.restore();
    expect(await fs.readFile(file, 'utf8')).toBe('{"before":true}');
    await fs.rm(root, { recursive: true, force: true });
  });

  it('resolves symlinks only when the target remains inside workspace', async () => {
    const root = await makeWorkspace();
    const inside = path.join(root, 'inside');
    await fs.mkdir(inside);
    await fs.writeFile(path.join(inside, 'ok.txt'), 'ok');
    await fs.symlink(path.join(inside, 'ok.txt'), path.join(root, 'ok-link'));
    expect(await symlinkResolver(root, 'ok-link')).toBe(path.join(inside, 'ok.txt'));
    const outside = await makeWorkspace();
    await fs.writeFile(path.join(outside, 'secret.txt'), 'secret');
    await fs.symlink(path.join(outside, 'secret.txt'), path.join(root, 'bad-link'));
    await expect(symlinkResolver(root, 'bad-link')).rejects.toThrow(/outside workspace/i);
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  });

  it('merges directory trees without overwriting existing files by default', async () => {
    const root = await makeWorkspace();
    const source = path.join(root, 'source');
    const destination = path.join(root, 'destination');
    await fs.mkdir(path.join(source, 'nested'), { recursive: true });
    await fs.mkdir(path.join(destination, 'nested'), { recursive: true });
    await fs.writeFile(path.join(source, 'nested', 'incoming.txt'), 'incoming');
    await fs.writeFile(path.join(source, 'nested', 'conflict.txt'), 'source');
    await fs.writeFile(path.join(destination, 'nested', 'conflict.txt'), 'destination');
    const result = await mergeDirectories(source, destination);
    expect(result.copied).toEqual([path.join('nested', 'incoming.txt')]);
    expect(result.skipped).toEqual([path.join('nested', 'conflict.txt')]);
    expect(await fs.readFile(path.join(destination, 'nested', 'conflict.txt'), 'utf8')).toBe('destination');
    await fs.rm(root, { recursive: true, force: true });
  });

  it('sets restrictive file permissions when requested', async () => {
    const root = await makeWorkspace();
    const file = path.join(root, 'secret.json');
    await fs.writeFile(file, '{}');
    await filePermissionSetter(file, 0o600);
    expect((await fs.stat(file)).mode & 0o777).toBe(0o600);
    await fs.rm(root, { recursive: true, force: true });
  });
});
