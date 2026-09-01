"use strict";
/**
 * ChatView Component - Message Display
 * Beautiful message rendering like Claude Code
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatView = void 0;
const react_1 = __importDefault(require("react"));
const ink_1 = require("ink");
const ChatView = ({ messages }) => {
    const formatTime = (date) => {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        });
    };
    const getRoleIcon = (role) => {
        switch (role) {
            case 'user':
                return { icon: '👤', color: 'cyan', label: 'You' };
            case 'assistant':
                return { icon: '🤖', color: 'magenta', label: 'Agent' };
            case 'system':
                return { icon: '⚙', color: 'gray', label: 'System' };
            default:
                return { icon: '●', color: 'gray', label: 'Unknown' };
        }
    };
    return (react_1.default.createElement(ink_1.Box, { flexDirection: "column", paddingX: 2, paddingY: 1, flexGrow: 1, overflowY: "auto" }, messages.length === 0 ? (react_1.default.createElement(ink_1.Box, { justifyContent: "center", alignItems: "center", flexGrow: 1 },
        react_1.default.createElement(ink_1.Text, { color: "gray", italic: true }, "No messages yet. Start typing below..."))) : (messages.map((message) => {
        const roleInfo = getRoleIcon(message.role);
        return (react_1.default.createElement(ink_1.Box, { key: message.id, flexDirection: "column", marginBottom: 1, paddingY: 1, borderStyle: "single", borderColor: message.role === 'user' ? 'cyan' :
                message.role === 'assistant' ? 'magenta' :
                    'gray', paddingX: 1 },
            react_1.default.createElement(ink_1.Box, { justifyContent: "space-between", marginBottom: 1 },
                react_1.default.createElement(ink_1.Box, { gap: 1 },
                    react_1.default.createElement(ink_1.Text, null, roleInfo.icon),
                    react_1.default.createElement(ink_1.Text, { bold: true, color: roleInfo.color }, roleInfo.label)),
                react_1.default.createElement(ink_1.Text, { color: "gray", dimColor: true }, formatTime(message.timestamp))),
            react_1.default.createElement(ink_1.Box, { flexDirection: "column" }, message.content.split('\n').map((line, index) => (react_1.default.createElement(ink_1.Text, { key: index, color: "white" }, line || ' ')))),
            message.metadata && (react_1.default.createElement(ink_1.Box, { marginTop: 1, gap: 2 },
                message.metadata.tokensUsed && (react_1.default.createElement(ink_1.Text, { color: "gray", dimColor: true },
                    "\uD83D\uDD22 ",
                    message.metadata.tokensUsed,
                    " tokens")),
                message.metadata.duration && (react_1.default.createElement(ink_1.Text, { color: "gray", dimColor: true },
                    "\u23F1 ",
                    message.metadata.duration,
                    "ms"))))));
    }))));
};
exports.ChatView = ChatView;
