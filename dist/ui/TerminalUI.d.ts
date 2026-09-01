/**
 * Terminal UI Components - Rich interactive terminal interface
 * Ink-based components for beautiful CLI experience
 */
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
export declare class ProgressBar {
    private config;
    private startTime;
    constructor(config: ProgressBarConfig);
    update(current: number): void;
    increment(amount?: number): void;
    render(): string;
    complete(): void;
}
/**
 * Table Renderer
 */
export declare class TableRenderer {
    private columns;
    private rows;
    constructor(columns: TableColumn[]);
    addRow(row: any): void;
    addRows(rows: any[]): void;
    render(): string;
    private alignText;
}
/**
 * Spinner Component
 */
export declare class Spinner {
    private config;
    private frames;
    private currentFrame;
    private interval;
    constructor(config: SpinnerConfig);
    start(): void;
    update(text: string): void;
    stop(message?: string): void;
    succeed(message?: string): void;
    fail(message?: string): void;
    private getFrames;
}
/**
 * Box Component
 */
export declare class Box {
    static single(content: string, title?: string, width?: number): string;
    static double(content: string, title?: string, width?: number): string;
    static rounded(content: string, title?: string, width?: number): string;
}
/**
 * Tree Renderer
 */
export interface TreeNode {
    label: string;
    children?: TreeNode[];
    expanded?: boolean;
}
export declare class TreeRenderer {
    render(node: TreeNode, prefix?: string, isLast?: boolean): string;
}
/**
 * Chart Renderer (ASCII charts)
 */
export declare class ChartRenderer {
    static barChart(data: Array<{
        label: string;
        value: number;
    }>, maxWidth?: number): string;
    static lineChart(data: number[], height?: number, width?: number): string;
    static sparkline(data: number[]): string;
}
/**
 * Status Display
 */
export declare class StatusDisplay {
    static success(message: string): string;
    static error(message: string): string;
    static warning(message: string): string;
    static info(message: string): string;
    static loading(message: string): string;
}
/**
 * Interactive Menu
 */
export interface MenuItem {
    label: string;
    value: string;
    description?: string;
}
export declare class Menu {
    private items;
    private selectedIndex;
    constructor(items: MenuItem[]);
    render(): string;
    moveUp(): void;
    moveDown(): void;
    getSelected(): MenuItem;
}
/**
 * Diff Renderer
 */
export declare class DiffRenderer {
    static render(oldText: string, newText: string): string;
}
//# sourceMappingURL=TerminalUI.d.ts.map