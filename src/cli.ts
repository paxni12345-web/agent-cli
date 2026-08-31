#!/usr/bin/env node

// CLI Entry Point

import { Command } from 'commander';
import * as readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import { Agent } from './agent/Agent';
import { AnthropicProvider } from './providers/AnthropicProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { ToolRegistry } from './tools/ToolRegistry';
import { ListFilesTool, ReadFileTool, WriteFileTool, EditFileTool } from './tools/FileTools';
import { ShellTool } from './tools/ShellTool';
import { SearchCodeTool } from './tools/SearchTool';
import { GitStatusTool, GitDiffTool, GitLogTool } from './tools/GitTools';
import { DefaultPermissionManager } from './security/PermissionManager';
import { ConfigLoader } from './config/ConfigLoader';
import { Config, PermissionMode } from './types/index';

const program = new Command();

program
  .name('agent')
  .description('Production-ready autonomous AI coding agent CLI')
  .version('0.1.0');

program
  .command('run', { isDefault: true })
  .description('Start interactive agent session')
  .option('--provider <provider>', 'AI provider (anthropic, openai)')
  .option('--model <model>', 'Model to use')
  .option('--permission-mode <mode>', 'Permission mode (safe, normal, auto, dangerous)')
  .option('--max-iterations <number>', 'Maximum iterations', '30')
  .option('--debug', 'Enable debug mode')
  .action(async (options) => {
    await runInteractive(options);
  });

program
  .command('init')
  .description('Initialize agent configuration in current directory')
  .action(async () => {
    await initProject();
  });

program
  .command('doctor')
  .description('Check system requirements and configuration')
  .action(async () => {
    await runDoctor();
  });

async function runInteractive(options: any) {
  console.log(chalk.cyan.bold('\n╭────────────────────────────────────╮'));
  console.log(chalk.cyan.bold('│    Autonomous Agent CLI v0.1.0     │'));
  console.log(chalk.cyan.bold('╰────────────────────────────────────╯\n'));

  try {
    // Load configuration
    const configLoader = new ConfigLoader();
    const config = await configLoader.load();

    // Apply CLI options
    if (options.provider) config.provider = options.provider;
    if (options.model) config.model = options.model;
    if (options.permissionMode) config.permissionMode = options.permissionMode as PermissionMode;
    if (options.maxIterations) config.maxIterations = parseInt(options.maxIterations);
    if (options.debug) config.debug = true;

    // Get API key
    const apiKey = configLoader.getApiKey(config);
    if (!apiKey) {
      console.error(chalk.red('✗ API key not found'));
      console.log('\nSet your API key:');
      console.log('  export ANTHROPIC_API_KEY=your-key-here');
      console.log('  export OPENAI_API_KEY=your-key-here');
      console.log('\nOr add it to ~/.agent/config.json');
      process.exit(1);
    }

    // Initialize provider
    const provider = createProvider(config, apiKey);

    // Initialize tool registry
    const toolRegistry = new ToolRegistry();
    toolRegistry.register(new ListFilesTool());
    toolRegistry.register(new ReadFileTool());
    toolRegistry.register(new WriteFileTool());
    toolRegistry.register(new EditFileTool());
    toolRegistry.register(new ShellTool());
    toolRegistry.register(new SearchCodeTool());
    toolRegistry.register(new GitStatusTool());
    toolRegistry.register(new GitDiffTool());
    toolRegistry.register(new GitLogTool());

    // Initialize permission manager
    const permissions = new DefaultPermissionManager(config.permissionMode);

    // Initialize agent
    const agent = new Agent(provider, toolRegistry, permissions, config);

    console.log(chalk.gray(`Workspace: ${config.workspaceRoot}`));
    console.log(chalk.gray(`Provider: ${config.provider}`));
    console.log(chalk.gray(`Model: ${config.model}`));
    console.log(chalk.gray(`Permission Mode: ${config.permissionMode}`));
    console.log();

    // Start REPL
    await startREPL(agent, config);

  } catch (error: any) {
    console.error(chalk.red('\n✗ Error:'), error.message);
    if (options.debug) {
      console.error(error);
    }
    process.exit(1);
  }
}

async function startREPL(agent: Agent, config: Config) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan('> '),
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    // Handle special commands
    if (input.startsWith('/')) {
      handleCommand(input, agent, config);
      rl.prompt();
      return;
    }

    // Process with agent
    const spinner = ora('Thinking...').start();

    try {
      const response = await agent.run(input);
      spinner.stop();
      console.log();
      console.log(chalk.white(response));
      console.log();
    } catch (error: any) {
      spinner.stop();
      console.error(chalk.red('\n✗ Error:'), error.message);
      if (config.debug) {
        console.error(error);
      }
      console.log();
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log(chalk.gray('\nGoodbye!'));
    process.exit(0);
  });
}

function handleCommand(command: string, agent: Agent, config: Config) {
  const cmd = command.substring(1).toLowerCase();

  switch (cmd) {
    case 'help':
      console.log('\nAvailable commands:');
      console.log('  /help     - Show this help');
      console.log('  /clear    - Clear conversation history');
      console.log('  /reset    - Reset agent state');
      console.log('  /status   - Show agent status');
      console.log('  /tools    - List available tools');
      console.log('  /config   - Show current configuration');
      console.log('  /exit     - Exit the agent');
      console.log();
      break;

    case 'clear':
      console.clear();
      break;

    case 'reset':
      agent.reset();
      console.log(chalk.green('✓ Agent state reset'));
      break;

    case 'status':
      const state = agent.getState();
      console.log('\nAgent Status:');
      console.log(`  Status: ${state.status}`);
      console.log(`  Iterations: ${state.iterationCount}`);
      console.log(`  Tool calls: ${state.history.length}`);
      console.log();
      break;

    case 'tools':
      console.log('\nAvailable Tools:');
      console.log('  • list_files   - List files in workspace');
      console.log('  • read_file    - Read file contents');
      console.log('  • write_file   - Create or overwrite file');
      console.log('  • edit_file    - Edit specific parts of file');
      console.log('  • shell        - Execute shell commands');
      console.log('  • search_code  - Search for code patterns');
      console.log('  • git_status   - Show git status');
      console.log('  • git_diff     - Show git diff');
      console.log('  • git_log      - Show git log');
      console.log();
      break;

    case 'config':
      console.log('\nCurrent Configuration:');
      console.log(`  Provider: ${config.provider}`);
      console.log(`  Model: ${config.model}`);
      console.log(`  Permission Mode: ${config.permissionMode}`);
      console.log(`  Max Iterations: ${config.maxIterations}`);
      console.log(`  Workspace: ${config.workspaceRoot}`);
      console.log(`  Debug: ${config.debug}`);
      console.log();
      break;

    case 'exit':
    case 'quit':
      console.log(chalk.gray('Goodbye!'));
      process.exit(0);

    default:
      console.log(chalk.red(`Unknown command: ${command}`));
      console.log('Type /help for available commands');
  }
}

function createProvider(config: Config, apiKey: string) {
  if (config.provider === 'anthropic') {
    return new AnthropicProvider(apiKey, { baseUrl: config.baseUrl });
  } else if (config.provider === 'openai') {
    return new OpenAIProvider(apiKey, {
      baseUrl: config.baseUrl,
      model: config.model,
    });
  } else {
    throw new Error(`Unsupported provider: ${config.provider}`);
  }
}

async function initProject() {
  const configLoader = new ConfigLoader();

  console.log(chalk.cyan('\nInitializing agent configuration...\n'));

  const config = {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    permissionMode: 'normal' as PermissionMode,
    maxIterations: 30,
  };

  await configLoader.save(config, false);

  console.log(chalk.green('✓ Created .agent/config.json'));
  console.log(chalk.gray('\nYou can now customize the configuration or add project-specific instructions.'));
  console.log();
}

async function runDoctor() {
  console.log(chalk.cyan('\n🔍 Running system checks...\n'));

  const checks = [
    { name: 'Node.js', check: async () => process.version },
    { name: 'Git', check: async () => {
      const { execSync } = await import('child_process');
      return execSync('git --version', { encoding: 'utf-8' }).trim();
    }},
    { name: 'Workspace', check: async () => process.cwd() },
    { name: 'API Key (Anthropic)', check: async () => process.env.ANTHROPIC_API_KEY ? '✓ Set' : '✗ Not set' },
    { name: 'API Key (OpenAI)', check: async () => process.env.OPENAI_API_KEY ? '✓ Set' : '✗ Not set' },
  ];

  for (const { name, check } of checks) {
    try {
      const result = await check();
      console.log(chalk.green('✓'), name + ':', chalk.gray(result));
    } catch (error) {
      console.log(chalk.red('✗'), name + ':', chalk.red('Not available'));
      console.error(`Error checking ${name}:`, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  console.log();
}

program.parse();
