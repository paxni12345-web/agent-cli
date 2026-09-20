#!/usr/bin/env node

import { Command } from 'commander';
import * as readline from 'readline';
import chalk from 'chalk';
import { Agent } from './agent/Agent.js';
import { AnthropicProvider } from './providers/AnthropicProvider.js';
import { OpenAIProvider } from './providers/OpenAIProvider.js';
import { ToolRegistry } from './tools/ToolRegistry.js';
import { ListFilesTool, ReadFileTool, WriteFileTool, EditFileTool } from './tools/FileTools.js';
import { ShellTool } from './tools/ShellTool.js';
import { SearchCodeTool } from './tools/SearchTool.js';
import { GitStatusTool, GitDiffTool, GitLogTool } from './tools/GitTools.js';
import { DefaultPermissionManager } from './security/PermissionManager.js';
import { ConfigLoader } from './config/ConfigLoader.js';
import { Config, PermissionMode } from './types/index.js';

const program = new Command();

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

interface Spinner {
  text: string;
  start(): Spinner;
  stop(): void;
}

function createSpinner(initialText: string): Spinner {
  const interactive = Boolean(process.stdout.isTTY);
  let text = initialText;
  let frame = 0;
  let timer: NodeJS.Timeout | null = null;

  function render() {
    process.stdout.write(`\r${chalk.cyan(SPINNER_FRAMES[frame])} ${chalk.gray(text)}`);
    frame = (frame + 1) % SPINNER_FRAMES.length;
  }

  const spinner: Spinner = {
    get text() {
      return text;
    },
    set text(value: string) {
      text = value;
    },
    start() {
      if (!interactive) {
        console.log(chalk.gray(text));
        return spinner;
      }
      render();
      timer = setInterval(render, 80);
      return spinner;
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      if (interactive) {
        process.stdout.write('\r\x1b[K');
      }
    },
  };

  return spinner;
}

let rl: readline.Interface | null = null;
let currentAgent: Agent | null = null;

program
  .name('agent')
  .description('Autonomous AI coding agent CLI')
  .version('0.2.0');

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
  .option('--permission-mode <mode>', 'Permission mode (safe, normal, auto, dangerous)')
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

function printBanner(config: Config) {
  const line = chalk.cyan('─'.repeat(62));
  console.log();
  console.log(line);
  console.log(
    chalk.cyanBright.bold('  ◆ AGENT CLI ') +
      chalk.gray('v0.2.0') +
      chalk.gray('  ·  autonomous coding agent')
  );
  console.log(line);
  console.log(
    '  ' +
      chalk.gray('provider') +
      '  ' +
      chalk.white(config.provider) +
      '    ' +
      chalk.gray('model') +
      '  ' +
      chalk.white(config.model)
  );
  console.log(
    '  ' +
      chalk.gray('mode') +
      '  ' +
      chalk.magenta(config.permissionMode) +
      '    ' +
      chalk.gray('workspace') +
      '  ' +
      chalk.gray(config.workspaceRoot)
  );
  console.log(
    '  ' + chalk.gray("type your message · ") + chalk.white('/help') + chalk.gray(' for commands')
  );
  console.log(line);
  console.log();
}

async function startChat(options: any) {
  const configLoader = new ConfigLoader();
  let config: Config;

  try {
    config = await configLoader.load();
  } catch (error) {
    console.log(chalk.yellow('⚠ No configuration found, using defaults'));
    config = ConfigLoader.getDefaults();
  }

  if (options.provider) config.provider = options.provider;
  if (options.model) config.model = options.model;
  if (options.permissionMode) config.permissionMode = options.permissionMode as PermissionMode;
  if (options.maxIterations) config.maxIterations = options.maxIterations;

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

  let provider;
  try {
    provider = createProvider(config, apiKey);
  } catch (error) {
    console.error(chalk.red('✗ Failed to initialize AI provider:'));
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }

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

  const permissions = new DefaultPermissionManager(config.permissionMode);

  try {
    currentAgent = new Agent(provider, toolRegistry, permissions, config);
  } catch (error) {
    console.error(chalk.red('✗ Failed to initialize agent:'));
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }

  printBanner(config);

  try {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.cyan('❯ '),
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

    const spinner = createSpinner('Thinking...').start();

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout after 5 minutes')), 300000);
      });

      const responsePromise = currentAgent!.run(input);

      const response = await Promise.race([responsePromise, timeoutPromise]);

      spinner.stop();
      console.log(chalk.magentaBright('\n◆ Agent'), chalk.gray('·'));
      console.log(response);
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
    config = ConfigLoader.getDefaults();
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

  const spinner = createSpinner('Initializing...').start();

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

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Task timeout after 10 minutes')), 600000);
    });

    const responsePromise = agent.run(task);
    const response = await Promise.race([responsePromise, timeoutPromise]);

    spinner.stop();
    console.log(chalk.green('\n✓ Task completed'));
    console.log('\n' + response);

    const report = agent.getPerformanceMonitor().generateReport();
    if (report.overview.totalExecutions > 0) {
      console.log(
        chalk.gray(
          `\n  tools used: ${report.overview.totalExecutions} · success: ${report.overview.totalSuccess} · avg ${Math.round(report.overview.avgExecutionTime)}ms`
        )
      );
    }
  } catch (error) {
    spinner.stop();
    console.error(chalk.red('\n✗ Task failed:'));
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

async function handleCommand(command: string, agent: Agent, config: Config) {
  const [cmd, ...args] = command.substring(1).split(/\s+/);
  const sub = args.join(' ');

  switch (cmd.toLowerCase()) {
    case 'help':
      console.log(`
${chalk.cyanBright('Commands')}
  ${chalk.white('/help')}            Show this help
  ${chalk.white('/clear')}           Clear screen
  ${chalk.white('/reset')}           Reset agent state (fresh conversation)
  ${chalk.white('/status')}          Show agent status
  ${chalk.white('/stats')}           Tool performance report (success rate, latency)
  ${chalk.white('/tools')}           List available tools (from registry)
  ${chalk.white('/config')}          Show current configuration
  ${chalk.white('/history')}         Show recent tool executions
  ${chalk.white('/model <name>')}    Switch model (e.g. /model gpt-4o)
  ${chalk.white('/exit')}            Exit the agent
`);
      break;

    case 'clear':
      console.clear();
      break;

    case 'reset':
      agent.reset();
      console.log(chalk.green('✓ Agent state reset'));
      break;

    case 'status': {
      const state = agent.getState();
      const stats = agent.getToolStats();
      console.log(`
${chalk.cyanBright('Agent Status')}
  ${chalk.gray('status:')}      ${state.status}
  ${chalk.gray('iterations:')}  ${state.iterationCount}/${config.maxIterations}
  ${chalk.gray('tool calls:')}  ${state.history.length}
  ${chalk.gray('messages:')}    ${state.conversationMessages.length}
  ${chalk.gray('tracked:')}     ${stats.size} tools
`);
      break;
    }

    case 'stats': {
      const report = agent.getPerformanceMonitor().generateReport();
      console.log(`
${chalk.cyanBright('Tool Performance')}`);
      if (report.overview.totalExecutions === 0) {
        console.log(chalk.gray('  No tool executions yet.'));
      } else {
        console.log(
          `  ${chalk.gray('executions:')} ${report.overview.totalExecutions}  ` +
            `${chalk.gray('success:')} ${chalk.green(String(report.overview.totalSuccess))}  ` +
            `${chalk.gray('failed:')} ${chalk.red(String(report.overview.totalFailures))}  ` +
            `${chalk.gray('avg:')} ${Math.round(report.overview.avgExecutionTime)}ms`
        );
        if (report.slowestTools.length > 0) {
          console.log(`\n  ${chalk.gray('slowest tools:')}`);
          for (const t of report.slowestTools.slice(0, 5)) {
            console.log(`    ${chalk.white(t.tool)}  ${chalk.gray(Math.round(t.avgDuration) + 'ms')}`);
          }
        }
        if (report.recommendations?.length > 0) {
          console.log(`\n  ${chalk.gray('recommendations:')}`);
          for (const rec of report.recommendations.slice(0, 3)) {
            console.log(`    · ${rec}`);
          }
        }
      }
      console.log();
      break;
    }

    case 'tools': {
      const tools = agent.getToolRegistry().list();
      console.log(`
${chalk.cyanBright(`Available Tools (${tools.length})`)}`);
      for (const tool of tools) {
        console.log(`  ${chalk.cyan('●')} ${chalk.white(tool.name.padEnd(14))} ${chalk.gray(tool.description)}`);
      }
      console.log();
      break;
    }

    case 'config':
      console.log(`
${chalk.cyanBright('Configuration')}
  ${chalk.gray('provider:')}        ${config.provider}
  ${chalk.gray('model:')}           ${config.model}
  ${chalk.gray('permission mode:')} ${config.permissionMode}
  ${chalk.gray('max iterations:')}  ${config.maxIterations}
  ${chalk.gray('workspace:')}       ${config.workspaceRoot}
  ${chalk.gray('debug:')}           ${config.debug}
`);
      break;

    case 'history': {
      const state = agent.getState();
      console.log(`
${chalk.cyanBright('Tool Executions (latest 10)')}`);
      if (state.history.length === 0) {
        console.log(chalk.gray('  No tool executions yet.'));
      } else {
        for (const exec of state.history.slice(-10)) {
          const statusIcon = exec.result?.success ? chalk.green('✓') : chalk.red('✗');
          console.log(
            `  ${statusIcon} ${chalk.white(exec.tool.padEnd(14))} ${chalk.gray(String(exec.timestamp instanceof Date ? exec.timestamp.toLocaleTimeString() : ''))}`
          );
        }
      }
      console.log();
      break;
    }

    case 'model':
      if (!sub) {
        console.log(chalk.gray('Usage: /model <name>  (current: ' + config.model + ')'));
      } else {
        config.model = sub;
        console.log(chalk.green(`✓ Model set to ${sub} (takes effect on the next provider request)`));
      }
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
      return new AnthropicProvider(apiKey, { baseUrl: config.baseUrl, model: config.model });
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

function cleanup() {
  if (rl) {
    try {
      rl.close();
    } catch {
      // best-effort cleanup
    }
    rl = null;
  }

  if (currentAgent) {
    try {
      currentAgent.reset();
    } catch {
      // best-effort cleanup
    }
    currentAgent = null;
  }
}

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

try {
  program.parse();
} catch (error) {
  console.error(chalk.red('✗ Failed to parse command:'));
  console.error(error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
}
