"use strict";
/**
 * InputBox Component - Message Input
 * Beautiful input field like Claude Code
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InputBox = void 0;
const react_1 = __importStar(require("react"));
const ink_1 = require("ink");
const ink_text_input_1 = __importDefault(require("ink-text-input"));
const InputBox = ({ value, onChange, onSubmit, placeholder = 'Type your message...', disabled = false, }) => {
    const [history, setHistory] = (0, react_1.useState)([]);
    const [historyIndex, setHistoryIndex] = (0, react_1.useState)(-1);
    (0, ink_1.useInput)((input, key) => {
        // Enter - Submit
        if (key.return && !disabled) {
            if (value.trim()) {
                setHistory((prev) => [...prev, value]);
                setHistoryIndex(-1);
                onSubmit(value);
            }
        }
        // Up arrow - Previous history
        if (key.upArrow && history.length > 0) {
            const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
            setHistoryIndex(newIndex);
            onChange(history[history.length - 1 - newIndex]);
        }
        // Down arrow - Next history
        if (key.downArrow) {
            if (historyIndex > 0) {
                const newIndex = historyIndex - 1;
                setHistoryIndex(newIndex);
                onChange(history[history.length - 1 - newIndex]);
            }
            else if (historyIndex === 0) {
                setHistoryIndex(-1);
                onChange('');
            }
        }
    });
    return (react_1.default.createElement(ink_1.Box, { flexDirection: "column", borderStyle: "round", borderColor: disabled ? 'gray' : 'cyan', paddingX: 1, marginX: 2, marginBottom: 1 },
        react_1.default.createElement(ink_1.Box, { justifyContent: "space-between", marginBottom: 0 },
            react_1.default.createElement(ink_1.Text, { color: "cyan", bold: true },
                disabled ? '⏸  ' : '▶  ',
                "Message"),
            react_1.default.createElement(ink_1.Text, { color: "gray", dimColor: true }, disabled ? 'Please wait...' : 'Enter to send')),
        react_1.default.createElement(ink_1.Box, null,
            react_1.default.createElement(ink_1.Text, { color: "gray" }, "\u2502 "),
            disabled ? (react_1.default.createElement(ink_1.Text, { color: "gray", dimColor: true }, placeholder)) : (react_1.default.createElement(ink_text_input_1.default, { value: value, onChange: onChange, placeholder: placeholder, showCursor: !disabled }))),
        react_1.default.createElement(ink_1.Box, { marginTop: 0, gap: 2 },
            react_1.default.createElement(ink_1.Text, { color: "gray", dimColor: true }, "\uD83D\uDCA1 /help for commands"),
            react_1.default.createElement(ink_1.Text, { color: "gray", dimColor: true }, "\u2502"),
            react_1.default.createElement(ink_1.Text, { color: "gray", dimColor: true }, "\u2191\u2193 for history"),
            react_1.default.createElement(ink_1.Text, { color: "gray", dimColor: true }, "\u2502"),
            react_1.default.createElement(ink_1.Text, { color: "gray", dimColor: true }, "Ctrl+C to exit"))));
};
exports.InputBox = InputBox;
