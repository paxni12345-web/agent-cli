#!/usr/bin/env node

/**
 * CLI Entry Point with Enhanced Stability
 * Version: 1.0.0 - Stability Improvements
 *
 * Changes:
 * - Comprehensive error handling
 * - Graceful degradation
 * - Better resource cleanup
 * - Signal handling
 * - Timeout protection
 */

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

// Global state for cleanup
let rl: readline.Interface | null = null;
let currentAgent: Agent | null = null;

program
  .name('agent')
  .description('Production-ready autonomous AI coding agent CLI')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize agent configuration in current directory')
  .action(async () => {
    try {
      await initProject();
    } catch (error) {
      console.error(chalk.red('✗ Failed to initialize project:'));
      console.error(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program
  .command('doctor')
  .description('Check system dependencies and configuration')
  .action(async () => {
    try {
      await runDoctor();
    } catch (error) {
      console.error(chalk.red('✗ Doctor check failed:'));
      console.error(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program
  .command('chat')
  .description('Start interactive chat session')
  .option('-p, --provider <provider>', 'AI provider (anthropic or openai)')
  .option('-m, --model <model>', 'Model to use')
  .option('--permission-mode <mode>', 'Permission mode (auto, normal, strict)')
  .option('--max-iterations <number>', 'Maximum iterations', parseInt)
  .action(async (options) => {
    try {
      await startChat(options);
    } catch (error) {
      console.error(chalk.red('\n✗ Fatal error:'));
      console.error(error instanceof Error ? error.message : 'Unknown error');
      cleanup();
      process.exit(1);
    }
  });

program
  .command('run <task>')
  .description('Run a single task')
  .option('-p, --provider <provider>', 'AI provider')
  .option('-m, --model <model>', 'Model to use')
  .action(async (task, options) => {
    try {
      await runTask(task, options);
    } catch (error) {
      console.error(chalk.red('✗ Task execution failed:'));
      console.error(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

async function startChat(options: any) {
  const configLoader = new ConfigLoader();
  let config: Config;

  try {
    config = await configLoader.load();
  } catch (error) {
    console.log(chalk.yellow('⚠ No configuration found, using defaults'));
    config = configLoader.getDefaults();
  }

  // Override with CLI options
  if (options.provider) config.provider = options.provider;
  if (options.model) config.model = options.model;
  if (options.permissionMode) config.permissionMode = options.permissionMode;
  if (options.maxIterations) config.maxIterations = options.maxIterations;

  // Validate API key
  const apiKey = config.provider === 'anthropic'
    ? process.env.ANTHROPIC_API_KEY
    : process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error(chalk.red('\n✗ API key not found'));
    console.log(chalk.gray('\nSet your API key:'));
    console.log('  export ANTHROPIC_API_KEY=your-key-here');
    console.log('  export OPENAI_API_KEY=your-key-here');
    console.log('\nOr add it to ~/.agent/config.json');
    process.exit(1);
  }

  // Initialize provider with error handling
  let provider;
  try {
    provider = createProvider(config, apiKey);
  } catch (error) {
    console.error(chalk.red('✗ Failed to initialize AI provider:'));
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }

  // Initialize tool registry
  const toolRegistry = new ToolRegistry();
  try {
    toolRegistry.register(new ListFilesTool());
    toolRegistry.register(new ReadFileTool());
    toolRegistry.register(new WriteFileTool());
    toolRegistry.register(new EditFileTool());
    toolRegistry.register(new ShellTool());
    toolRegistry.register(new SearchCodeTool());
    toolRegistry.register(new GitStatusTool());
    toolRegistry.register(new GitDiffTool());
    toolRegistry.register(new GitLogTool());
  } catch (error) {
    console.error(chalk.red('✗ Failed to register tools:'));
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }

  // Initialize permission manager
  const permissions = new DefaultPermissionManager(config.permissionMode);

  // Initialize agent
  try {
    currentAgent = new Agent(provider, toolRegistry, permissions, config);
  } catch (error) {
    console.error(chalk.red('✗ Failed to initialize agent:'));
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }

  console.log(chalk.cyan('\n🤖 Agent CLI v0.1.0'));
  console.log(chalk.gray(`Provider: ${config.provider} | Model: ${config.model}`));
  console.log(chalk.gray(`Permission Mode: ${config.permissionMode}`));
  console.log(chalk.gray('\nType your message or /help for commands\n'));

  // Create readline interface with error handling
  try {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.cyan('You: '),
    });
  } catch (error) {
    console.error(chalk.red('✗ Failed to create readline interface:'));
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    if (!input) {
      rl!.prompt();
      return;
    }

    // Handle commands
    if (input.startsWith('/')) {
      try {
        await handleCommand(input, currentAgent!, config);
      } catch (error) {
        console.error(chalk.red('✗ Command error:'));
        console.error(error instanceof Error ? error.message : 'Unknown error');
      }
      rl!.prompt();
      return;
    }

    // Process user message with timeout and error handling
    const spinner = ora('Thinking...').start();

    try {
      // Add timeout protection (5 minutes)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout after 5 minutes')), 300000);
      });

      const responsePromise = currentAgent!.processMessage(input);

      const response = await Promise.race([responsePromise, timeoutPromise]);

      spinner.stop();
      console.log(chalk.green('\nAgent:'), response);
      console.log();
    } catch (error) {
      spinner.stop();

      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          console.error(chalk.red('\n✗ Request timed out. Please try a simpler query.'));
        } else if (error.message.includes('rate limit')) {
          console.error(chalk.red('\n✗ Rate limit exceeded. Please wait a moment.'));
        } else {
          console.error(chalk.red('\n✗ Error processing message:'));
          console.error(chalk.red(error.message));
        }
      } else {
        console.error(chalk.red('\n✗ Unknown error occurred'));
      }

      console.log();
    }

    rl!.prompt();
  });

  rl.on('close', () => {
    console.log(chalk.gray('\nGoodbye!'));
    cleanup();
    process.exit(0);
  });

  // Handle errors on readline
  rl.on('error', (error) => {
    console.error(chalk.red('\n✗ Readline error:'));
    console.error(error.message);
    cleanup();
    process.exit(1);
  });
}

async function runTask(task: string, options: any) {
  const configLoader = new ConfigLoader();
  let config: Config;

  try {
    config = await configLoader.load();
  } catch {
    config = configLoader.getDefaults();
  }

  if (options.provider) config.provider = options.provider;
  if (options.model) config.model = options.model;

  const apiKey = config.provider === 'anthropic'
    ? process.env.ANTHROPIC_API_KEY
    : process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error(chalk.red('✗ API key not found'));
    process.exit(1);
  }

  const spinner = ora('Initializing...').start();

  try {
    const provider = createProvider(config, apiKey);
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

    const permissions = new DefaultPermissionManager(config.permissionMode);
    const agent = new Agent(provider, toolRegistry, permissions, config);

    spinner.text = 'Processing task...';

    // Add timeout protection
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Task timeout after 10 minutes')), 600000);
    });

    const responsePromise = agent.processMessage(task);
    const response = await Promise.race([responsePromise, timeoutPromise]);

    spinner.stop();
    console.log(chalk.green('\n✓ Task completed'));
    console.log('\n' + response);
  } catch (error) {
    spinner.stop();
    console.error(chalk.red('\n✗ Task failed:'));
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

async function handleCommand(command: string, agent: Agent, config: Config) {
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
      cleanup();
      process.exit(0);

    default:
      console.log(chalk.red(`Unknown command: ${command}`));
      console.log('Type /help for available commands');
  }
}

function createProvider(config: Config, apiKey: string) {
  try {
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
  } catch (error) {
    throw new Error(`Failed to create provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  try {
    await configLoader.save(config, false);
    console.log(chalk.green('✓ Created .agent/config.json'));
    console.log(chalk.gray('\nYou can now customize the configuration or add project-specific instructions.'));
    console.log();
  } catch (error) {
    throw new Error(`Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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
      if (process.env.AGENT_DEBUG) {
        console.error(`  Debug: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  console.log();
}

// Cleanup function
function cleanup() {
  if (rl) {
    try {
      rl.close();
    } catch (error) {
      // Ignore cleanup errors
    }
    rl = null;
  }

  if (currentAgent) {
    try {
      currentAgent.reset();
    } catch (error) {
      // Ignore cleanup errors
    }
    currentAgent = null;
  }
}

// Signal handlers for graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.gray('\n\nReceived SIGINT, shutting down gracefully...'));
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(chalk.gray('\n\nReceived SIGTERM, shutting down gracefully...'));
  cleanup();
  process.exit(0);
});

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('\n✗ Unhandled Promise Rejection:'));
  console.error(reason);
  if (process.env.AGENT_DEBUG) {
    console.error('Promise:', promise);
  }
});

process.on('uncaughtException', (error) => {
  console.error(chalk.red('\n✗ Uncaught Exception:'));
  console.error(error);
  cleanup();
  process.exit(1);
});

// Parse CLI arguments
try {
  program.parse();
} catch (error) {
  console.error(chalk.red('✗ Failed to parse command:'));
  console.error(error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
}
