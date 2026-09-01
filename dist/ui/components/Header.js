"use strict";
/**
 * Header Component - Claude Code Style
 * Beautiful header with gradient and status indicators
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Header = void 0;
const react_1 = __importDefault(require("react"));
const ink_1 = require("ink");
const chalk_1 = __importDefault(require("chalk"));
const Header = ({ status }) => {
    // Status indicator with colors
    const getStatusIndicator = () => {
        switch (status.status) {
            case 'thinking':
                return { icon: '◉', color: 'yellow', text: 'Thinking' };
            case 'executing':
                return { icon: '⚙', color: 'blue', text: 'Executing' };
            case 'completed':
                return { icon: '✓', color: 'green', text: 'Done' };
            case 'error':
                return { icon: '✗', color: 'red', text: 'Error' };
            default:
                return { icon: '○', color: 'gray', text: 'Ready' };
        }
    };
    const statusInfo = getStatusIndicator();
    // Mode badge with colors
    const getModeStyle = () => {
        switch (status.mode) {
            case 'ultra':
                return { bg: chalk_1.default.bgMagenta, fg: chalk_1.default.white, label: '⚡ ULTRA' };
            case 'fast':
                return { bg: chalk_1.default.bgCyan, fg: chalk_1.default.black, label: '🚀 FAST' };
            default:
                return { bg: chalk_1.default.bgGray, fg: chalk_1.default.white, label: '● NORMAL' };
        }
    };
    const modeStyle = getModeStyle();
    return (react_1.default.createElement(ink_1.Box, { flexDirection: "column", borderStyle: "round", borderColor: "cyan", paddingX: 1, marginBottom: 1 },
        react_1.default.createElement(ink_1.Box, { justifyContent: "space-between", width: "100%" },
            react_1.default.createElement(ink_1.Box, { gap: 1 },
                react_1.default.createElement(ink_1.Text, { bold: true, color: "cyan" }, chalk_1.default.cyan('╔═══╗')),
                react_1.default.createElement(ink_1.Text, { bold: true, color: "cyanBright" }, "Agent CLI"),
                react_1.default.createElement(ink_1.Text, { color: "gray" }, "\u2502 v0.1.0")),
            react_1.default.createElement(ink_1.Box, { gap: 1 },
                react_1.default.createElement(ink_1.Text, { color: statusInfo.color }, statusInfo.icon),
                react_1.default.createElement(ink_1.Text, { color: statusInfo.color }, statusInfo.text))),
        react_1.default.createElement(ink_1.Box, { justifyContent: "space-between", width: "100%", marginTop: 1 },
            react_1.default.createElement(ink_1.Box, { gap: 1 },
                react_1.default.createElement(ink_1.Text, { color: "gray" }, "Model:"),
                react_1.default.createElement(ink_1.Text, { bold: true, color: "white" }, status.model)),
            react_1.default.createElement(ink_1.Box, { gap: 1 },
                react_1.default.createElement(ink_1.Text, { color: "gray" }, "\uD83D\uDCC1"),
                react_1.default.createElement(ink_1.Text, { color: "gray" }, status.workingDir.length > 30
                    ? '...' + status.workingDir.slice(-27)
                    : status.workingDir)),
            react_1.default.createElement(ink_1.Text, null, modeStyle.bg(modeStyle.fg(` ${modeStyle.label} `))))));
};
exports.Header = Header;
