import { ConfigLoader } from '../../src/config/ConfigLoader.js';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

describe('ConfigLoader', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('loads a valid environment override', async () => {
    process.env.AGENT_PROVIDER = 'openai';
    process.env.AGENT_MAX_ITERATIONS = '12';
    process.env.AGENT_PERMISSION_MODE = 'safe';

    const config = await new ConfigLoader().load();

    expect(config.provider).toBe('openai');
    expect(config.maxIterations).toBe(12);
    expect(config.permissionMode).toBe('safe');
  });

  it('rejects invalid environment values instead of passing them to the agent', async () => {
    process.env.AGENT_MAX_ITERATIONS = 'not-a-number';

    await expect(new ConfigLoader().load()).rejects.toThrow(
      'maxIterations must be an integer between 1 and 1000'
    );
  });

  it('prefers the provider-specific environment key when config has no API key', () => {
    process.env.OPENAI_API_KEY = 'openai-test-key';

    const config = { ...ConfigLoader.getDefaults(), provider: 'openai' };
    expect(new ConfigLoader().getApiKey(config)).toBe('openai-test-key');
  });

  it('stores global credentials in an owner-only config file', async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), 'iris-config-'));
    const previousHome = process.env.HOME;
    process.env.HOME = home;
    try {
      await new ConfigLoader().save({ apiKey: 'test-secret' }, true);
      const configPath = path.join(home, '.agent', 'config.json');
      const stats = await fs.stat(configPath);
      expect(stats.mode & 0o777).toBe(0o600);
      expect(await fs.readFile(configPath, 'utf-8')).toContain('test-secret');
    } finally {
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      await fs.rm(home, { recursive: true, force: true });
    }
  });
});
