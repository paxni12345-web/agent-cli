#!/usr/bin/env node
"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const readline = __importStar(require("readline"));
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const Agent_1 = require("./agent/Agent");
const AnthropicProvider_1 = require("./providers/AnthropicProvider");
const OpenAIProvider_1 = require("./providers/OpenAIProvider");
const ToolRegistry_1 = require("./tools/ToolRegistry");
const FileTools_1 = require("./tools/FileTools");
const ShellTool_1 = require("./tools/ShellTool");
const SearchTool_1 = require("./tools/SearchTool");
const GitTools_1 = require("./tools/GitTools");
const PermissionManager_1 = require("./security/PermissionManager");
const ConfigLoader_1 = require("./config/ConfigLoader");
const program = new commander_1.Command();
// Global state for cleanup
let rl = null;
let currentAgent = null;
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
    }
    catch (error) {
        console.error(chalk_1.default.red('✗ Failed to initialize project:'));
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
    }
    catch (error) {
        console.error(chalk_1.default.red('✗ Doctor check failed:'));
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
    }
    catch (error) {
        console.error(chalk_1.default.red('\n✗ Fatal error:'));
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
    }
    catch (error) {
        console.error(chalk_1.default.red('✗ Task execution failed:'));
        console.error(error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
    }
});
async function startChat(options) {
    const configLoader = new ConfigLoader_1.ConfigLoader();
    let config;
    try {
        config = await configLoader.load();
    }
    catch (error) {
        console.log(chalk_1.default.yellow('⚠ No configuration found, using defaults'));
        config = configLoader.getDefaults();
    }
    // Override with CLI options
    if (options.provider)
        config.provider = options.provider;
    if (options.model)
        config.model = options.model;
    if (options.permissionMode)
        config.permissionMode = options.permissionMode;
    if (options.maxIterations)
        config.maxIterations = options.maxIterations;
    // Validate API key
    const apiKey = config.provider === 'anthropic'
        ? process.env.ANTHROPIC_API_KEY
        : process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.error(chalk_1.default.red('\n✗ API key not found'));
        console.log(chalk_1.default.gray('\nSet your API key:'));
        console.log('  export ANTHROPIC_API_KEY=your-key-here');
        console.log('  export OPENAI_API_KEY=your-key-here');
        console.log('\nOr add it to ~/.agent/config.json');
        process.exit(1);
    }
    // Initialize provider with error handling
    let provider;
    try {
        provider = createProvider(config, apiKey);
    }
    catch (error) {
        console.error(chalk_1.default.red('✗ Failed to initialize AI provider:'));
        console.error(error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
    }
    // Initialize tool registry
    const toolRegistry = new ToolRegistry_1.ToolRegistry();
    try {
        toolRegistry.register(new FileTools_1.ListFilesTool());
        toolRegistry.register(new FileTools_1.ReadFileTool());
        toolRegistry.register(new FileTools_1.WriteFileTool());
        toolRegistry.register(new FileTools_1.EditFileTool());
        toolRegistry.register(new ShellTool_1.ShellTool());
        toolRegistry.register(new SearchTool_1.SearchCodeTool());
        toolRegistry.register(new GitTools_1.GitStatusTool());
        toolRegistry.register(new GitTools_1.GitDiffTool());
        toolRegistry.register(new GitTools_1.GitLogTool());
    }
    catch (error) {
        console.error(chalk_1.default.red('✗ Failed to register tools:'));
        console.error(error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
    }
    // Initialize permission manager
    const permissions = new PermissionManager_1.DefaultPermissionManager(config.permissionMode);
    // Initialize agent
    try {
        currentAgent = new Agent_1.Agent(provider, toolRegistry, permissions, config);
    }
    catch (error) {
        console.error(chalk_1.default.red('✗ Failed to initialize agent:'));
        console.error(error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
    }
    console.log(chalk_1.default.cyan('\n🤖 Agent CLI v0.1.0'));
    console.log(chalk_1.default.gray(`Provider: ${config.provider} | Model: ${config.model}`));
    console.log(chalk_1.default.gray(`Permission Mode: ${config.permissionMode}`));
    console.log(chalk_1.default.gray('\nType your message or /help for commands\n'));
    // Create readline interface with error handling
    try {
        rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: chalk_1.default.cyan('You: '),
        });
    }
    catch (error) {
        console.error(chalk_1.default.red('✗ Failed to create readline interface:'));
        console.error(error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
    }
    rl.prompt();
    rl.on('line', async (line) => {
        const input = line.trim();
        if (!input) {
            rl.prompt();
            return;
        }
        // Handle commands
        if (input.startsWith('/')) {
            try {
                await handleCommand(input, currentAgent, config);
            }
            catch (error) {
                console.error(chalk_1.default.red('✗ Command error:'));
                console.error(error instanceof Error ? error.message : 'Unknown error');
            }
            rl.prompt();
            return;
        }
        // Process user message with timeout and error handling
        const spinner = (0, ora_1.default)('Thinking...').start();
        try {
            // Add timeout protection (5 minutes)
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Request timeout after 5 minutes')), 300000);
            });
            const responsePromise = currentAgent.processMessage(input);
            const response = await Promise.race([responsePromise, timeoutPromise]);
            spinner.stop();
            console.log(chalk_1.default.green('\nAgent:'), response);
            console.log();
        }
        catch (error) {
            spinner.stop();
            if (error instanceof Error) {
                if (error.message.includes('timeout')) {
                    console.error(chalk_1.default.red('\n✗ Request timed out. Please try a simpler query.'));
                }
                else if (error.message.includes('rate limit')) {
                    console.error(chalk_1.default.red('\n✗ Rate limit exceeded. Please wait a moment.'));
                }
                else {
                    console.error(chalk_1.default.red('\n✗ Error processing message:'));
                    console.error(chalk_1.default.red(error.message));
                }
            }
            else {
                console.error(chalk_1.default.red('\n✗ Unknown error occurred'));
            }
            console.log();
        }
        rl.prompt();
    });
    rl.on('close', () => {
        console.log(chalk_1.default.gray('\nGoodbye!'));
        cleanup();
        process.exit(0);
    });
    // Handle errors on readline
    rl.on('error', (error) => {
        console.error(chalk_1.default.red('\n✗ Readline error:'));
        console.error(error.message);
        cleanup();
        process.exit(1);
    });
}
async function runTask(task, options) {
    const configLoader = new ConfigLoader_1.ConfigLoader();
    let config;
    try {
        config = await configLoader.load();
    }
    catch {
        config = configLoader.getDefaults();
    }
    if (options.provider)
        config.provider = options.provider;
    if (options.model)
        config.model = options.model;
    const apiKey = config.provider === 'anthropic'
        ? process.env.ANTHROPIC_API_KEY
        : process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.error(chalk_1.default.red('✗ API key not found'));
        process.exit(1);
    }
    const spinner = (0, ora_1.default)('Initializing...').start();
    try {
        const provider = createProvider(config, apiKey);
        const toolRegistry = new ToolRegistry_1.ToolRegistry();
        toolRegistry.register(new FileTools_1.ListFilesTool());
        toolRegistry.register(new FileTools_1.ReadFileTool());
        toolRegistry.register(new FileTools_1.WriteFileTool());
        toolRegistry.register(new FileTools_1.EditFileTool());
        toolRegistry.register(new ShellTool_1.ShellTool());
        toolRegistry.register(new SearchTool_1.SearchCodeTool());
        toolRegistry.register(new GitTools_1.GitStatusTool());
        toolRegistry.register(new GitTools_1.GitDiffTool());
        toolRegistry.register(new GitTools_1.GitLogTool());
        const permissions = new PermissionManager_1.DefaultPermissionManager(config.permissionMode);
        const agent = new Agent_1.Agent(provider, toolRegistry, permissions, config);
        spinner.text = 'Processing task...';
        // Add timeout protection
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Task timeout after 10 minutes')), 600000);
        });
        const responsePromise = agent.processMessage(task);
        const response = await Promise.race([responsePromise, timeoutPromise]);
        spinner.stop();
        console.log(chalk_1.default.green('\n✓ Task completed'));
        console.log('\n' + response);
    }
    catch (error) {
        spinner.stop();
        console.error(chalk_1.default.red('\n✗ Task failed:'));
        console.error(error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
    }
}
async function handleCommand(command, agent, config) {
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
            console.log(chalk_1.default.green('✓ Agent state reset'));
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
            console.log(chalk_1.default.gray('Goodbye!'));
            cleanup();
            process.exit(0);
        default:
            console.log(chalk_1.default.red(`Unknown command: ${command}`));
            console.log('Type /help for available commands');
    }
}
function createProvider(config, apiKey) {
    try {
        if (config.provider === 'anthropic') {
            return new AnthropicProvider_1.AnthropicProvider(apiKey, { baseUrl: config.baseUrl });
        }
        else if (config.provider === 'openai') {
            return new OpenAIProvider_1.OpenAIProvider(apiKey, {
                baseUrl: config.baseUrl,
                model: config.model,
            });
        }
        else {
            throw new Error(`Unsupported provider: ${config.provider}`);
        }
    }
    catch (error) {
        throw new Error(`Failed to create provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
async function initProject() {
    const configLoader = new ConfigLoader_1.ConfigLoader();
    console.log(chalk_1.default.cyan('\nInitializing agent configuration...\n'));
    const config = {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        permissionMode: 'normal',
        maxIterations: 30,
    };
    try {
        await configLoader.save(config, false);
        console.log(chalk_1.default.green('✓ Created .agent/config.json'));
        console.log(chalk_1.default.gray('\nYou can now customize the configuration or add project-specific instructions.'));
        console.log();
    }
    catch (error) {
        throw new Error(`Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
async function runDoctor() {
    console.log(chalk_1.default.cyan('\n🔍 Running system checks...\n'));
    const checks = [
        { name: 'Node.js', check: async () => process.version },
        { name: 'Git', check: async () => {
                const { execSync } = await Promise.resolve().then(() => __importStar(require('child_process')));
                return execSync('git --version', { encoding: 'utf-8' }).trim();
            } },
        { name: 'Workspace', check: async () => process.cwd() },
        { name: 'API Key (Anthropic)', check: async () => process.env.ANTHROPIC_API_KEY ? '✓ Set' : '✗ Not set' },
        { name: 'API Key (OpenAI)', check: async () => process.env.OPENAI_API_KEY ? '✓ Set' : '✗ Not set' },
    ];
    for (const { name, check } of checks) {
        try {
            const result = await check();
            console.log(chalk_1.default.green('✓'), name + ':', chalk_1.default.gray(result));
        }
        catch (error) {
            console.log(chalk_1.default.red('✗'), name + ':', chalk_1.default.red('Not available'));
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
        }
        catch (error) {
            // Ignore cleanup errors
        }
        rl = null;
    }
    if (currentAgent) {
        try {
            currentAgent.reset();
        }
        catch (error) {
            // Ignore cleanup errors
        }
        currentAgent = null;
    }
}
// Signal handlers for graceful shutdown
process.on('SIGINT', () => {
    console.log(chalk_1.default.gray('\n\nReceived SIGINT, shutting down gracefully...'));
    cleanup();
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log(chalk_1.default.gray('\n\nReceived SIGTERM, shutting down gracefully...'));
    cleanup();
    process.exit(0);
});
// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk_1.default.red('\n✗ Unhandled Promise Rejection:'));
    console.error(reason);
    if (process.env.AGENT_DEBUG) {
        console.error('Promise:', promise);
    }
});
process.on('uncaughtException', (error) => {
    console.error(chalk_1.default.red('\n✗ Uncaught Exception:'));
    console.error(error);
    cleanup();
    process.exit(1);
});
// Parse CLI arguments
try {
    program.parse();
}
catch (error) {
    console.error(chalk_1.default.red('✗ Failed to parse command:'));
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
}
