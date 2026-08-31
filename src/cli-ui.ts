/**
 * CLI Entry Point with Beautiful UI
 * Launches the Claude Code style interface
 */

#!/usr/bin/env node

import React from 'react';
import { render } from 'ink';
import { Command } from 'commander';
import chalk from 'chalk';
import App from './ui/App.js';

const program = new Command();

program
  .name('agent')
  .description('Production-ready autonomous AI coding agent CLI with beautiful interface')
  .version('0.1.0')
  .option('-m, --model <model>', 'AI model to use', 'claude-opus-4')
  .option('--mode <mode>', 'Operating mode (normal/fast/ultra)', 'normal')
  .option('-d, --dir <directory>', 'Working directory', process.cwd())
  .option('--no-ui', 'Disable UI and use plain text mode')
  .parse(process.argv);

const options = program.opts();

// Validate mode
if (!['normal', 'fast', 'ultra'].includes(options.mode)) {
  console.error(chalk.red('Error: Invalid mode. Must be normal, fast, or ultra.'));
  process.exit(1);
}

// Display banner
console.clear();
console.log(chalk.cyan('╔═══════════════════════════════════════════════════════════════╗'));
console.log(chalk.cyan('║') + chalk.cyanBright.bold('              Agent CLI - Claude Code Style UI                ') + chalk.cyan('║'));
console.log(chalk.cyan('╠═══════════════════════════════════════════════════════════════╣'));
console.log(chalk.cyan('║') + '  Version: ' + chalk.white('0.1.0') + '                                                 ' + chalk.cyan('║'));
console.log(chalk.cyan('║') + '  Model:   ' + chalk.white(options.model.padEnd(49)) + chalk.cyan('║'));
console.log(chalk.cyan('║') + '  Mode:    ' + chalk.magenta(options.mode.toUpperCase().padEnd(49)) + chalk.cyan('║'));
console.log(chalk.cyan('║') + '  Dir:     ' + chalk.gray(options.dir.slice(0, 49).padEnd(49)) + chalk.cyan('║'));
console.log(chalk.cyan('╚═══════════════════════════════════════════════════════════════╝'));
console.log('');
console.log(chalk.gray('Starting interface...'));
console.log('');

// Small delay for banner
setTimeout(() => {
  if (options.ui) {
    // Launch beautiful UI
    render(
      <App
        workingDirectory={options.dir}
        model={options.model}
        mode={options.mode}
      />
    );
  } else {
    // Fallback to plain text mode
    console.log(chalk.yellow('Plain text mode not yet implemented. Use --ui flag.'));
    process.exit(0);
  }
}, 500);
