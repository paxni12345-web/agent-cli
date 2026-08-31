// Configuration Management

import * as fs from 'fs/promises';
import * as path from 'path';
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

  async load(): Promise<Config> {
    const config = { ...ConfigLoader.DEFAULT_CONFIG };

    // Load from global config
    const globalConfig = await this.loadGlobalConfig();
    Object.assign(config, globalConfig);

    // Load from project config
    const projectConfig = await this.loadProjectConfig(config.workspaceRoot);
    Object.assign(config, projectConfig);

    // Override with environment variables
    this.applyEnvironmentVariables(config);

    return config;
  }

  private async loadGlobalConfig(): Promise<Partial<Config>> {
    try {
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
      const configPath = path.join(workspaceRoot, '.agent', 'config.json');
      const content = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  private applyEnvironmentVariables(config: Config): void {
    if (process.env.AGENT_MODEL) {
      config.model = process.env.AGENT_MODEL;
    }

    if (process.env.AGENT_PROVIDER) {
      config.provider = process.env.AGENT_PROVIDER;
    }

    if (process.env.AGENT_API_KEY) {
      config.apiKey = process.env.AGENT_API_KEY;
    }

    if (process.env.AGENT_BASE_URL) {
      config.baseUrl = process.env.AGENT_BASE_URL;
    }

    if (process.env.AGENT_PERMISSION_MODE) {
      config.permissionMode = process.env.AGENT_PERMISSION_MODE as PermissionMode;
    }

    if (process.env.AGENT_MAX_ITERATIONS) {
      config.maxIterations = parseInt(process.env.AGENT_MAX_ITERATIONS, 10);
    }

    if (process.env.AGENT_DEBUG) {
      config.debug = process.env.AGENT_DEBUG === 'true';
    }
  }

  async save(config: Partial<Config>, global: boolean = true): Promise<void> {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '/root';
    const configDir = global
      ? path.join(homeDir, '.agent')
      : path.join(config.workspaceRoot || process.cwd(), '.agent');

    await fs.mkdir(configDir, { recursive: true });

    const configPath = path.join(configDir, 'config.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  getApiKey(config: Config): string | undefined {
    // Priority: config.apiKey > environment variable > undefined
    if (config.apiKey) {
      return config.apiKey;
    }

    if (config.provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
      return process.env.ANTHROPIC_API_KEY;
    }

    if (config.provider === 'openai' && process.env.OPENAI_API_KEY) {
      return process.env.OPENAI_API_KEY;
    }

    return undefined;
  }
}
