#!/usr/bin/env node
"use strict";
/**
 * CLI Entry Point with Beautiful UI
 * Launches the Claude Code style interface
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ink_1 = require("ink");
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const program = new commander_1.Command();
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
    console.error(chalk_1.default.red('Error: Invalid mode. Must be normal, fast, or ultra.'));
    process.exit(1);
}
// Display banner
console.clear();
console.log(chalk_1.default.cyan('╔═══════════════════════════════════════════════════════════════╗'));
console.log(chalk_1.default.cyan('║') + chalk_1.default.cyanBright.bold('              Agent CLI - Claude Code Style UI                ') + chalk_1.default.cyan('║'));
console.log(chalk_1.default.cyan('╠═══════════════════════════════════════════════════════════════╣'));
console.log(chalk_1.default.cyan('║') + '  Version: ' + chalk_1.default.white('0.1.0') + '                                                 ' + chalk_1.default.cyan('║'));
console.log(chalk_1.default.cyan('║') + '  Model:   ' + chalk_1.default.white(options.model.padEnd(49)) + chalk_1.default.cyan('║'));
console.log(chalk_1.default.cyan('║') + '  Mode:    ' + chalk_1.default.magenta(options.mode.toUpperCase().padEnd(49)) + chalk_1.default.cyan('║'));
console.log(chalk_1.default.cyan('║') + '  Dir:     ' + chalk_1.default.gray(options.dir.slice(0, 49).padEnd(49)) + chalk_1.default.cyan('║'));
console.log(chalk_1.default.cyan('╚═══════════════════════════════════════════════════════════════╝'));
console.log('');
console.log(chalk_1.default.gray('Starting interface...'));
console.log('');
// Small delay for banner
setTimeout(() => {
    if (options.ui) {
        // Launch beautiful UI
        (0, ink_1.render)(workingDirectory, { options, : .dir }, model = { options, : .model }, mode = { options, : .mode }
            /  >
        );
    }
    else {
        // Fallback to plain text mode
        console.log(chalk_1.default.yellow('Plain text mode not yet implemented. Use --ui flag.'));
        process.exit(0);
    }
}, 500);
