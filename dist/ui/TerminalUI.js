"use strict";
/**
 * Terminal UI Components - Rich interactive terminal interface
 * Ink-based components for beautiful CLI experience
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiffRenderer = exports.Menu = exports.StatusDisplay = exports.ChartRenderer = exports.TreeRenderer = exports.Box = exports.Spinner = exports.TableRenderer = exports.ProgressBar = void 0;
/**
 * Progress Bar Component
 */
class ProgressBar {
    config;
    startTime;
    constructor(config) {
        this.config = {
            total: config.total,
            current: config.current,
            label: config.label || 'Progress',
            width: config.width || 40,
            showPercentage: config.showPercentage ?? true,
            showETA: config.showETA ?? true,
        };
        this.startTime = new Date();
    }
    update(current) {
        this.config.current = current;
        this.render();
    }
    increment(amount = 1) {
        this.config.current = Math.min(this.config.current + amount, this.config.total);
        this.render();
    }
    render() {
        const percentage = Math.min((this.config.current / this.config.total) * 100, 100);
        const filled = Math.floor((percentage / 100) * this.config.width);
        const empty = this.config.width - filled;
        const bar = '█'.repeat(filled) + '░'.repeat(empty);
        let output = `${this.config.label}: [${bar}]`;
        if (this.config.showPercentage) {
            output += ` ${percentage.toFixed(1)}%`;
        }
        if (this.config.showETA && this.config.current > 0) {
            const elapsed = Date.now() - this.startTime.getTime();
            const rate = this.config.current / elapsed;
            const remaining = (this.config.total - this.config.current) / rate;
            const eta = Math.ceil(remaining / 1000);
            if (eta < 60) {
                output += ` | ETA: ${eta}s`;
            }
            else {
                output += ` | ETA: ${Math.ceil(eta / 60)}m`;
            }
        }
        output += ` (${this.config.current}/${this.config.total})`;
        return output;
    }
    complete() {
        this.config.current = this.config.total;
        console.log(this.render() + ' ✓');
    }
}
exports.ProgressBar = ProgressBar;
/**
 * Table Renderer
 */
class TableRenderer {
    columns;
    rows;
    constructor(columns) {
        this.columns = columns;
        this.rows = [];
    }
    addRow(row) {
        this.rows.push(row);
    }
    addRows(rows) {
        this.rows.push(...rows);
    }
    render() {
        if (this.rows.length === 0) {
            return 'No data';
        }
        // Calculate column widths
        const widths = this.columns.map((col) => {
            const headerWidth = col.header.length;
            const dataWidth = Math.max(...this.rows.map((row) => {
                const value = col.format ? col.format(row[col.key]) : row[col.key];
                return String(value || '').length;
            }));
            return col.width || Math.max(headerWidth, dataWidth);
        });
        let output = '';
        // Header
        output += this.columns
            .map((col, i) => this.alignText(col.header, widths[i], col.align || 'left'))
            .join(' │ ');
        output += '\n';
        // Separator
        output += widths.map((w) => '─'.repeat(w)).join('─┼─');
        output += '\n';
        // Rows
        for (const row of this.rows) {
            output += this.columns
                .map((col, i) => {
                const value = col.format ? col.format(row[col.key]) : row[col.key];
                return this.alignText(String(value || ''), widths[i], col.align || 'left');
            })
                .join(' │ ');
            output += '\n';
        }
        return output;
    }
    alignText(text, width, align) {
        if (text.length >= width) {
            return text.slice(0, width);
        }
        const padding = width - text.length;
        if (align === 'right') {
            return ' '.repeat(padding) + text;
        }
        else if (align === 'center') {
            const leftPad = Math.floor(padding / 2);
            const rightPad = padding - leftPad;
            return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
        }
        else {
            return text + ' '.repeat(padding);
        }
    }
}
exports.TableRenderer = TableRenderer;
/**
 * Spinner Component
 */
class Spinner {
    config;
    frames;
    currentFrame = 0;
    interval = null;
    constructor(config) {
        this.config = {
            text: config.text,
            type: config.type || 'dots',
            color: config.color || 'cyan',
        };
        this.frames = this.getFrames(this.config.type);
    }
    start() {
        if (this.interval)
            return;
        this.interval = setInterval(() => {
            this.currentFrame = (this.currentFrame + 1) % this.frames.length;
            process.stdout.write(`\r${this.frames[this.currentFrame]} ${this.config.text}`);
        }, 80);
    }
    update(text) {
        this.config.text = text;
    }
    stop(message) {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        process.stdout.write('\r' + ' '.repeat(100) + '\r');
        if (message) {
            console.log(message);
        }
    }
    succeed(message) {
        this.stop(`✓ ${message || this.config.text}`);
    }
    fail(message) {
        this.stop(`✗ ${message || this.config.text}`);
    }
    getFrames(type) {
        const frameMap = {
            dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
            line: ['-', '\\', '|', '/'],
            arc: ['◜', '◠', '◝', '◞', '◡', '◟'],
            arrow: ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'],
        };
        return frameMap[type] || frameMap.dots;
    }
}
exports.Spinner = Spinner;
/**
 * Box Component
 */
class Box {
    static single(content, title, width) {
        const lines = content.split('\n');
        const maxWidth = width || Math.max(...lines.map((l) => l.length), title?.length || 0);
        let output = '';
        // Top border
        if (title) {
            const titlePadding = Math.floor((maxWidth - title.length) / 2);
            output += '┌' + '─'.repeat(titlePadding) + title + '─'.repeat(maxWidth - titlePadding - title.length) + '┐\n';
        }
        else {
            output += '┌' + '─'.repeat(maxWidth) + '┐\n';
        }
        // Content
        for (const line of lines) {
            output += '│ ' + line.padEnd(maxWidth - 2) + ' │\n';
        }
        // Bottom border
        output += '└' + '─'.repeat(maxWidth) + '┘';
        return output;
    }
    static double(content, title, width) {
        const lines = content.split('\n');
        const maxWidth = width || Math.max(...lines.map((l) => l.length), title?.length || 0);
        let output = '';
        // Top border
        if (title) {
            const titlePadding = Math.floor((maxWidth - title.length) / 2);
            output += '╔' + '═'.repeat(titlePadding) + title + '═'.repeat(maxWidth - titlePadding - title.length) + '╗\n';
        }
        else {
            output += '╔' + '═'.repeat(maxWidth) + '╗\n';
        }
        // Content
        for (const line of lines) {
            output += '║ ' + line.padEnd(maxWidth - 2) + ' ║\n';
        }
        // Bottom border
        output += '╚' + '═'.repeat(maxWidth) + '╝';
        return output;
    }
    static rounded(content, title, width) {
        const lines = content.split('\n');
        const maxWidth = width || Math.max(...lines.map((l) => l.length), title?.length || 0);
        let output = '';
        // Top border
        if (title) {
            const titlePadding = Math.floor((maxWidth - title.length) / 2);
            output += '╭' + '─'.repeat(titlePadding) + title + '─'.repeat(maxWidth - titlePadding - title.length) + '╮\n';
        }
        else {
            output += '╭' + '─'.repeat(maxWidth) + '╮\n';
        }
        // Content
        for (const line of lines) {
            output += '│ ' + line.padEnd(maxWidth - 2) + ' │\n';
        }
        // Bottom border
        output += '╰' + '─'.repeat(maxWidth) + '╯';
        return output;
    }
}
exports.Box = Box;
class TreeRenderer {
    render(node, prefix = '', isLast = true) {
        let output = '';
        const connector = isLast ? '└── ' : '├── ';
        output += prefix + connector + node.label + '\n';
        if (node.children && node.children.length > 0 && node.expanded !== false) {
            const childPrefix = prefix + (isLast ? '    ' : '│   ');
            for (let i = 0; i < node.children.length; i++) {
                const isLastChild = i === node.children.length - 1;
                output += this.render(node.children[i], childPrefix, isLastChild);
            }
        }
        return output;
    }
}
exports.TreeRenderer = TreeRenderer;
/**
 * Chart Renderer (ASCII charts)
 */
class ChartRenderer {
    static barChart(data, maxWidth = 50) {
        const maxValue = Math.max(...data.map((d) => d.value));
        const maxLabelWidth = Math.max(...data.map((d) => d.label.length));
        let output = '';
        for (const item of data) {
            const barWidth = Math.round((item.value / maxValue) * maxWidth);
            const bar = '█'.repeat(barWidth);
            const label = item.label.padEnd(maxLabelWidth);
            output += `${label} │ ${bar} ${item.value}\n`;
        }
        return output;
    }
    static lineChart(data, height = 10, width = 50) {
        const min = Math.min(...data);
        const max = Math.max(...data);
        const range = max - min || 1;
        const chart = Array(height)
            .fill(null)
            .map(() => Array(width).fill(' '));
        // Plot points
        for (let i = 0; i < data.length && i < width; i++) {
            const normalized = (data[i] - min) / range;
            const y = Math.round((1 - normalized) * (height - 1));
            chart[y][i] = '●';
            // Connect with lines
            if (i > 0) {
                const prevNormalized = (data[i - 1] - min) / range;
                const prevY = Math.round((1 - prevNormalized) * (height - 1));
                const minY = Math.min(y, prevY);
                const maxY = Math.max(y, prevY);
                for (let j = minY; j <= maxY; j++) {
                    if (chart[j][i - 1] === ' ') {
                        chart[j][i - 1] = '│';
                    }
                }
            }
        }
        // Render
        let output = '';
        for (let y = 0; y < height; y++) {
            output += chart[y].join('') + '\n';
        }
        return output;
    }
    static sparkline(data) {
        const min = Math.min(...data);
        const max = Math.max(...data);
        const range = max - min || 1;
        const chars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
        return data
            .map((value) => {
            const normalized = (value - min) / range;
            const index = Math.min(Math.floor(normalized * chars.length), chars.length - 1);
            return chars[index];
        })
            .join('');
    }
}
exports.ChartRenderer = ChartRenderer;
/**
 * Status Display
 */
class StatusDisplay {
    static success(message) {
        return `✓ ${message}`;
    }
    static error(message) {
        return `✗ ${message}`;
    }
    static warning(message) {
        return `⚠ ${message}`;
    }
    static info(message) {
        return `ℹ ${message}`;
    }
    static loading(message) {
        return `⟳ ${message}`;
    }
}
exports.StatusDisplay = StatusDisplay;
class Menu {
    items;
    selectedIndex = 0;
    constructor(items) {
        this.items = items;
    }
    render() {
        let output = '';
        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            const selected = i === this.selectedIndex;
            const prefix = selected ? '❯ ' : '  ';
            output += prefix + item.label;
            if (item.description) {
                output += ` - ${item.description}`;
            }
            output += '\n';
        }
        return output;
    }
    moveUp() {
        this.selectedIndex = Math.max(0, this.selectedIndex - 1);
    }
    moveDown() {
        this.selectedIndex = Math.min(this.items.length - 1, this.selectedIndex + 1);
    }
    getSelected() {
        return this.items[this.selectedIndex];
    }
}
exports.Menu = Menu;
/**
 * Diff Renderer
 */
class DiffRenderer {
    static render(oldText, newText) {
        const oldLines = oldText.split('\n');
        const newLines = newText.split('\n');
        let output = '';
        // Simple line-by-line diff
        const maxLines = Math.max(oldLines.length, newLines.length);
        for (let i = 0; i < maxLines; i++) {
            const oldLine = oldLines[i];
            const newLine = newLines[i];
            if (oldLine === newLine) {
                output += `  ${oldLine || ''}\n`;
            }
            else if (oldLine && !newLine) {
                output += `- ${oldLine}\n`;
            }
            else if (!oldLine && newLine) {
                output += `+ ${newLine}\n`;
            }
            else {
                output += `- ${oldLine}\n`;
                output += `+ ${newLine}\n`;
            }
        }
        return output;
    }
}
exports.DiffRenderer = DiffRenderer;
