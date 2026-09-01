/**
 * LogView Component - Tool Execution Logs
 * Shows real-time tool execution like Claude Code
 */
import React from 'react';
import { ToolExecution } from '../types.js';
interface LogViewProps {
    executions: ToolExecution[];
    maxItems?: number;
}
export declare const LogView: React.FC<LogViewProps>;
export {};
//# sourceMappingURL=LogView.d.ts.map