/**
 * Terminal UI Components - Rich interactive terminal interface
 * Ink-based components for beautiful CLI experience
 */

import { eventBus } from '../core/EventBus';

export interface ProgressBarConfig {
  total: number;
  current: number;
  label?: string;
  width?: number;
  showPercentage?: boolean;
  showETA?: boolean;
}

export interface TableColumn {
  header: string;
  key: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  format?: (value: any) => string;
}

export interface SpinnerConfig {
  text: string;
  type?: 'dots' | 'line' | 'arc' | 'arrow';
  color?: string;
}

/**
 * Progress Bar Component
 */
export class ProgressBar {
  private config: Required<ProgressBarConfig>;
  private startTime: Date;

  constructor(config: ProgressBarConfig) {
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

  update(current: number): void {
    this.config.current = current;
    this.render();
  }

  increment(amount = 1): void {
    this.config.current = Math.min(
      this.config.current + amount,
      this.config.total
    );
    this.render();
  }

  render(): string {
    const percentage = Math.min(
      (this.config.current / this.config.total) * 100,
      100
    );
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
      } else {
        output += ` | ETA: ${Math.ceil(eta / 60)}m`;
      }
    }

    output += ` (${this.config.current}/${this.config.total})`;

    return output;
  }

  complete(): void {
    this.config.current = this.config.total;
    console.log(this.render() + ' ✓');
  }
}

/**
 * Table Renderer
 */
export class TableRenderer {
  private columns: TableColumn[];
  private rows: any[];

  constructor(columns: TableColumn[]) {
    this.columns = columns;
    this.rows = [];
  }

  addRow(row: any): void {
    this.rows.push(row);
  }

  addRows(rows: any[]): void {
    this.rows.push(...rows);
  }

  render(): string {
    if (this.rows.length === 0) {
      return 'No data';
    }

    // Calculate column widths
    const widths = this.columns.map((col) => {
      const headerWidth = col.header.length;
      const dataWidth = Math.max(
        ...this.rows.map((row) => {
          const value = col.format ? col.format(row[col.key]) : row[col.key];
          return String(value || '').length;
        })
      );
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

  private alignText(text: string, width: number, align: 'left' | 'center' | 'right'): string {
    if (text.length >= width) {
      return text.slice(0, width);
    }

    const padding = width - text.length;

    if (align === 'right') {
      return ' '.repeat(padding) + text;
    } else if (align === 'center') {
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
    } else {
      return text + ' '.repeat(padding);
    }
  }
}

/**
 * Spinner Component
 */
export class Spinner {
  private config: Required<SpinnerConfig>;
  private frames: string[];
  private currentFrame = 0;
  private interval: NodeJS.Timeout | null = null;

  constructor(config: SpinnerConfig) {
    this.config = {
      text: config.text,
      type: config.type || 'dots',
      color: config.color || 'cyan',
    };

    this.frames = this.getFrames(this.config.type);
  }

  start(): void {
    if (this.interval) return;

    this.interval = setInterval(() => {
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
      process.stdout.write(`\r${this.frames[this.currentFrame]} ${this.config.text}`);
    }, 80);
  }

  update(text: string): void {
    this.config.text = text;
  }

  stop(message?: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    process.stdout.write('\r' + ' '.repeat(100) + '\r');

    if (message) {
      console.log(message);
    }
  }

  succeed(message?: string): void {
    this.stop(`✓ ${message || this.config.text}`);
  }

  fail(message?: string): void {
    this.stop(`✗ ${message || this.config.text}`);
  }

  private getFrames(type: string): string[] {
    const frameMap: Record<string, string[]> = {
      dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
      line: ['-', '\\', '|', '/'],
      arc: ['◜', '◠', '◝', '◞', '◡', '◟'],
      arrow: ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'],
    };

    return frameMap[type] || frameMap.dots;
  }
}

/**
 * Box Component
 */
export class Box {
  static single(content: string, title?: string, width?: number): string {
    const lines = content.split('\n');
    const maxWidth = width || Math.max(...lines.map((l) => l.length), title?.length || 0);

    let output = '';

    // Top border
    if (title) {
      const titlePadding = Math.floor((maxWidth - title.length) / 2);
      output += '┌' + '─'.repeat(titlePadding) + title + '─'.repeat(maxWidth - titlePadding - title.length) + '┐\n';
    } else {
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

  static double(content: string, title?: string, width?: number): string {
    const lines = content.split('\n');
    const maxWidth = width || Math.max(...lines.map((l) => l.length), title?.length || 0);

    let output = '';

    // Top border
    if (title) {
      const titlePadding = Math.floor((maxWidth - title.length) / 2);
      output += '╔' + '═'.repeat(titlePadding) + title + '═'.repeat(maxWidth - titlePadding - title.length) + '╗\n';
    } else {
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

  static rounded(content: string, title?: string, width?: number): string {
    const lines = content.split('\n');
    const maxWidth = width || Math.max(...lines.map((l) => l.length), title?.length || 0);

    let output = '';

    // Top border
    if (title) {
      const titlePadding = Math.floor((maxWidth - title.length) / 2);
      output += '╭' + '─'.repeat(titlePadding) + title + '─'.repeat(maxWidth - titlePadding - title.length) + '╮\n';
    } else {
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

/**
 * Tree Renderer
 */
export interface TreeNode {
  label: string;
  children?: TreeNode[];
  expanded?: boolean;
}

export class TreeRenderer {
  render(node: TreeNode, prefix = '', isLast = true): string {
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

/**
 * Chart Renderer (ASCII charts)
 */
export class ChartRenderer {
  static barChart(data: Array<{ label: string; value: number }>, maxWidth = 50): string {
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

  static lineChart(data: number[], height = 10, width = 50): string {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const chart: string[][] = Array(height)
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

  static sparkline(data: number[]): string {
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

/**
 * Status Display
 */
export class StatusDisplay {
  static success(message: string): string {
    return `✓ ${message}`;
  }

  static error(message: string): string {
    return `✗ ${message}`;
  }

  static warning(message: string): string {
    return `⚠ ${message}`;
  }

  static info(message: string): string {
    return `ℹ ${message}`;
  }

  static loading(message: string): string {
    return `⟳ ${message}`;
  }
}

/**
 * Interactive Menu
 */
export interface MenuItem {
  label: string;
  value: string;
  description?: string;
}

export class Menu {
  private items: MenuItem[];
  private selectedIndex = 0;

  constructor(items: MenuItem[]) {
    this.items = items;
  }

  render(): string {
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

  moveUp(): void {
    this.selectedIndex = Math.max(0, this.selectedIndex - 1);
  }

  moveDown(): void {
    this.selectedIndex = Math.min(this.items.length - 1, this.selectedIndex + 1);
  }

  getSelected(): MenuItem {
    return this.items[this.selectedIndex];
  }
}

/**
 * Diff Renderer
 */
export class DiffRenderer {
  static render(oldText: string, newText: string): string {
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
      } else if (oldLine && !newLine) {
        output += `- ${oldLine}\n`;
      } else if (!oldLine && newLine) {
        output += `+ ${newLine}\n`;
      } else {
        output += `- ${oldLine}\n`;
        output += `+ ${newLine}\n`;
      }
    }

    return output;
  }
}
