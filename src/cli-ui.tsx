#!/usr/bin/env node

import React from 'react';
import { render } from 'ink';
import { Command } from 'commander';
import { App } from './ui/App.js';

const program = new Command();

program
  .name('agent-ui')
  .description('Autonomous AI coding agent CLI with beautiful terminal UI')
  .version('0.2.0')
  .option('-m, --model <model>', 'AI model to use')
  .option('--mode <mode>', 'Operating mode (normal/fast/ultra)', 'normal')
  .option('-d, --dir <directory>', 'Working directory', process.cwd())
  .parse(process.argv);

const options = program.opts();

if (!['normal', 'fast', 'ultra'].includes(options.mode)) {
  console.error('Error: Invalid mode. Must be normal, fast, or ultra.');
  process.exit(1);
}

render(
  <App
    workingDirectory={options.dir}
    model={options.model}
    mode={options.mode}
  />
);
