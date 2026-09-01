"use strict";
/**
 * Footer Component - Additional Info Panel
 * Shows helpful shortcuts and tips
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Footer = void 0;
const react_1 = __importDefault(require("react"));
const ink_1 = require("ink");
const Footer = ({ showTips = true }) => {
    const shortcuts = [
        { key: 'Enter', desc: 'Send message' },
        { key: '↑/↓', desc: 'History' },
        { key: 'Tab', desc: 'Autocomplete' },
        { key: 'Ctrl+L', desc: 'Clear' },
        { key: 'Ctrl+C', desc: 'Exit' },
        { key: 'F1', desc: 'Help' },
    ];
    if (!showTips)
        return null;
    return (react_1.default.createElement(ink_1.Box, { borderStyle: "round", borderColor: "gray", paddingX: 1, marginX: 2, marginBottom: 1 },
        react_1.default.createElement(ink_1.Box, { gap: 2 },
            react_1.default.createElement(ink_1.Text, { color: "gray", dimColor: true }, "\uD83D\uDCA1 Quick Tips:"),
            shortcuts.map((shortcut, index) => (react_1.default.createElement(react_1.default.Fragment, { key: index },
                index > 0 && (react_1.default.createElement(ink_1.Text, { color: "gray", dimColor: true }, "\u2502")),
                react_1.default.createElement(ink_1.Text, null,
                    react_1.default.createElement(ink_1.Text, { color: "cyan", bold: true }, shortcut.key),
                    react_1.default.createElement(ink_1.Text, { color: "gray", dimColor: true },
                        ' ',
                        shortcut.desc))))))));
};
exports.Footer = Footer;
