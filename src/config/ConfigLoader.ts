import { Config, PermissionMode } from '../types/index.js';

export class ConfigLoader {
  private static readonly DEFAULT_CONFIG: Config = {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    permissionMode: 'normal',
    maxIterations: 30,
    temperature: 0.7,
    workspaceRoot: process.cwd(),
    debug: false,
  };

  static getDefaults(): Config {
    return { ...ConfigLoader.DEFAULT_CONFIG };
  }

  getDefaults(): Config {
    return ConfigLoader.getDefaults();
  }

  async load(): Promise<Config> {
    const config = { ...ConfigLoader.DEFAULT_CONFIG };
    const globalConfig = await this.loadGlobalConfig();
    const projectConfig = await this.loadProjectConfig(config.workspaceRoot);
    Object.assign(config, globalConfig, projectConfig);
    this.applyEnvironmentVariables(config);
    this.validate(config);
    return config;
  }

  validate(config: Config): void {
    if (!['anthropic', 'openai', 'openai-compatible'].includes(config.provider)) {
      throw new Error(`Unsupported provider: ${config.provider}`);
    }

    const permissionModes: PermissionMode[] = ['safe', 'normal', 'auto', 'dangerous'];
    if (!permissionModes.includes(config.permissionMode)) {
      throw new Error(`Invalid permission mode: ${config.permissionMode}`);
    }

    if (!Number.isInteger(config.maxIterations) || config.maxIterations < 1 || config.maxIterations > 1000) {
      throw new Error('maxIterations must be an integer between 1 and 1000');
    }

    if (!Number.isFinite(config.temperature) || config.temperature < 0 || config.temperature > 2) {
      throw new Error('temperature must be a number between 0 and 2');
    }
  }

  private async loadGlobalConfig(): Promise<Partial<Config>> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const homeDir = process.env.HOME || process.env.USERPROFILE || '/root';
      const configPath = path.join(homeDir, '.agent', 'config.json');
      const content = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  private async loadProjectConfig(workspaceRoot: string): Promise<Partial<Config>> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const configPath = path.join(workspaceRoot, '.agent', 'config.json');
      const content = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  private applyEnvironmentVariables(config: Config): void {
    if (process.env.AGENT_MODEL) config.model = process.env.AGENT_MODEL;
    if (process.env.AGENT_PROVIDER) config.provider = process.env.AGENT_PROVIDER;
    if (process.env.AGENT_API_KEY) config.apiKey = process.env.AGENT_API_KEY;
    if (process.env.AGENT_BASE_URL) config.baseUrl = process.env.AGENT_BASE_URL;
    if (process.env.AGENT_PERMISSION_MODE) config.permissionMode = process.env.AGENT_PERMISSION_MODE as PermissionMode;
    if (process.env.AGENT_MAX_ITERATIONS) config.maxIterations = parseInt(process.env.AGENT_MAX_ITERATIONS, 10);
    if (process.env.AGENT_DEBUG) config.debug = process.env.AGENT_DEBUG === 'true';
  }

  async save(config: Partial<Config>, global = true): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const homeDir = process.env.HOME || process.env.USERPROFILE || '/root';
    const configDir = global ? path.join(homeDir, '.agent') : path.join(config.workspaceRoot || process.cwd(), '.agent');
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(path.join(configDir, 'config.json'), JSON.stringify(config, null, 2), 'utf-8');
  }

  getApiKey(config: Config): string | undefined {
    if (config.apiKey) return config.apiKey;
    if (config.provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
    if ((config.provider === 'openai' || config.provider === 'openai-compatible') && process.env.OPENAI_API_KEY) {
      return process.env.OPENAI_API_KEY;
    }
    return undefined;
  }
}
