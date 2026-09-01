"use strict";
/**
 * LogView Component - Tool Execution Logs
 * Shows real-time tool execution like Claude Code
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogView = void 0;
const react_1 = __importDefault(require("react"));
const ink_1 = require("ink");
const LogView = ({ executions, maxItems = 5, }) => {
    const recentExecutions = executions.slice(-maxItems);
    const getStatusIcon = (status) => {
        switch (status) {
            case 'running':
                return { icon: '⚙', color: 'blue' };
            case 'completed':
                return { icon: '✓', color: 'green' };
            case 'failed':
                return { icon: '✗', color: 'red' };
            default:
                return { icon: '○', color: 'gray' };
        }
    };
    const getDuration = (execution) => {
        if (!execution.endTime)
            return 'Running...';
        const duration = execution.endTime.getTime() - execution.startTime.getTime();
        return `${duration}ms`;
    };
    if (executions.length === 0) {
        return null;
    }
    return (react_1.default.createElement(ink_1.Box, { flexDirection: "column", borderStyle: "single", borderColor: "blue", paddingX: 1, marginX: 2, marginY: 1 },
        react_1.default.createElement(ink_1.Box, { marginBottom: 1 },
            react_1.default.createElement(ink_1.Text, { bold: true, color: "blue" }, "\uD83D\uDD27 Tool Executions")),
        recentExecutions.map((execution) => {
            const statusInfo = getStatusIcon(execution.status);
            return (react_1.default.createElement(ink_1.Box, { key: execution.id, gap: 1, marginBottom: 1 },
                react_1.default.createElement(ink_1.Text, { color: statusInfo.color }, statusInfo.icon),
                react_1.default.createElement(ink_1.Text, { color: "white", bold: true }, execution.name),
                react_1.default.createElement(ink_1.Text, { color: "gray" },
                    "(",
                    getDuration(execution),
                    ")"),
                execution.status === 'completed' && execution.output && (react_1.default.createElement(ink_1.Text, { color: "gray", dimColor: true },
                    "\u2192 ",
                    execution.output.slice(0, 50),
                    execution.output.length > 50 ? '...' : '')),
                execution.status === 'failed' && execution.error && (react_1.default.createElement(ink_1.Text, { color: "red" },
                    "\u2192 Error: ",
                    execution.error.slice(0, 50),
                    execution.error.length > 50 ? '...' : ''))));
        })));
};
exports.LogView = LogView;
