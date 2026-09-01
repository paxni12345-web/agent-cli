"use strict";
/**
 * StatusBar Component - Bottom Status Bar
 * Shows real-time stats like Claude Code
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusBar = void 0;
const react_1 = __importDefault(require("react"));
const ink_1 = require("ink");
const chalk_1 = __importDefault(require("chalk"));
const StatusBar = ({ status }) => {
    // Format large numbers with K/M suffix
    const formatNumber = (num) => {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    };
    // Calculate token usage percentage (assume 200K max)
    const tokenPercentage = Math.min((status.tokensUsed / 200000) * 100, 100);
    const tokenBarWidth = 20;
    const tokenFilled = Math.floor((tokenPercentage / 100) * tokenBarWidth);
    const tokenEmpty = tokenBarWidth - tokenFilled;
    // Token bar color based on usage
    const getTokenColor = () => {
        if (tokenPercentage > 80)
            return 'red';
        if (tokenPercentage > 50)
            return 'yellow';
        return 'green';
    };
    return (react_1.default.createElement(ink_1.Box, { borderStyle: "round", borderColor: "gray", paddingX: 1, marginX: 2, marginBottom: 1 },
        react_1.default.createElement(ink_1.Box, { justifyContent: "space-between", width: "100%" },
            react_1.default.createElement(ink_1.Box, { gap: 2 },
                react_1.default.createElement(ink_1.Text, { color: "green" },
                    "\u2713 Tasks: ",
                    status.tasksCompleted)),
            react_1.default.createElement(ink_1.Box, { gap: 1 },
                react_1.default.createElement(ink_1.Text, { color: "gray" }, "Tokens:"),
                react_1.default.createElement(ink_1.Text, { color: getTokenColor() },
                    "[",
                    chalk_1.default[getTokenColor()]('█'.repeat(tokenFilled)),
                    chalk_1.default.gray('░'.repeat(tokenEmpty)),
                    "]"),
                react_1.default.createElement(ink_1.Text, { color: getTokenColor() },
                    formatNumber(status.tokensUsed),
                    "/200K"),
                react_1.default.createElement(ink_1.Text, { color: "gray" },
                    "(",
                    tokenPercentage.toFixed(0),
                    "%)")),
            react_1.default.createElement(ink_1.Box, { gap: 1 },
                react_1.default.createElement(ink_1.Text, { color: "gray" }, "Model:"),
                react_1.default.createElement(ink_1.Text, { color: "cyan" }, status.model.split('-').pop()?.toUpperCase())))));
};
exports.StatusBar = StatusBar;
