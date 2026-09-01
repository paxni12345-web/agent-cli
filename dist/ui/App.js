"use strict";
/**
 * Main Application - Claude Code CLI Style
 * Beautiful terminal interface for Agent CLI
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.startCLI = void 0;
const react_1 = __importStar(require("react"));
const ink_1 = require("ink");
const Header_js_1 = require("./components/Header.js");
const ChatView_js_1 = require("./components/ChatView.js");
const InputBox_js_1 = require("./components/InputBox.js");
const StatusBar_js_1 = require("./components/StatusBar.js");
const Spinner_js_1 = require("./components/Spinner.js");
const App = ({ workingDirectory, model = 'claude-opus-4', mode = 'normal' }) => {
    const { exit } = (0, ink_1.useApp)();
    // State
    const [messages, setMessages] = (0, react_1.useState)([]);
    const [input, setInput] = (0, react_1.useState)('');
    const [status, setStatus] = (0, react_1.useState)({
        status: 'idle',
        model: model,
        mode: mode,
        workingDir: workingDirectory,
        tokensUsed: 0,
        tasksCompleted: 0,
    });
    const [showHelp, setShowHelp] = (0, react_1.useState)(false);
    // Add welcome message
    (0, react_1.useEffect)(() => {
        setMessages([
            {
                id: '1',
                role: 'system',
                content: `Welcome to Agent CLI! 🎉\n\nWorking directory: ${workingDirectory}\nModel: ${model}\nMode: ${mode}\n\nType your request or /help for commands.`,
                timestamp: new Date(),
            },
        ]);
    }, []);
    // Handle keyboard shortcuts
    (0, ink_1.useInput)((input, key) => {
        // Ctrl+C - Exit
        if (key.ctrl && input === 'c') {
            exit();
        }
        // Ctrl+L - Clear screen
        if (key.ctrl && input === 'l') {
            setMessages([]);
        }
        // F1 - Toggle help
        if (key.f1) {
            setShowHelp(!showHelp);
        }
    });
    // Handle message submission
    const handleSubmit = async (message) => {
        if (!message.trim())
            return;
        // Add user message
        const userMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: message,
            timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setStatus((prev) => ({ ...prev, status: 'thinking' }));
        // Handle commands
        if (message.startsWith('/')) {
            handleCommand(message);
            return;
        }
        // Simulate AI response (replace with actual agent call)
        setTimeout(() => {
            const aiMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `I received your message: "${message}"\n\nThis is a demo response. In production, this will be replaced with actual agent processing.`,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, aiMessage]);
            setStatus((prev) => ({
                ...prev,
                status: 'idle',
                tasksCompleted: prev.tasksCompleted + 1,
                tokensUsed: prev.tokensUsed + 100,
            }));
        }, 2000);
    };
    // Handle slash commands
    const handleCommand = (command) => {
        const cmd = command.toLowerCase();
        let response = '';
        if (cmd === '/help') {
            response = `Available Commands:

/help          - Show this help message
/clear         - Clear chat history
/status        - Show current status
/model <name>  - Switch model
/mode <mode>   - Switch mode (normal/fast/ultra)
/exit          - Exit application

Keyboard Shortcuts:
Ctrl+C         - Exit
Ctrl+L         - Clear screen
F1             - Toggle help
Tab            - Auto-complete
↑/↓            - Command history`;
        }
        else if (cmd === '/clear') {
            setMessages([]);
            return;
        }
        else if (cmd === '/status') {
            response = `Current Status:

Model:         ${status.model}
Mode:          ${status.mode}
Status:        ${status.status}
Working Dir:   ${status.workingDir}
Tokens Used:   ${status.tokensUsed}
Tasks Done:    ${status.tasksCompleted}`;
        }
        else if (cmd === '/exit') {
            exit();
            return;
        }
        else {
            response = `Unknown command: ${command}\nType /help for available commands.`;
        }
        const systemMessage = {
            id: Date.now().toString(),
            role: 'system',
            content: response,
            timestamp: new Date(),
        };
        setMessages((prev) => [...prev, systemMessage]);
        setStatus((prev) => ({ ...prev, status: 'idle' }));
    };
    return (react_1.default.createElement(ink_1.Box, { flexDirection: "column", height: "100%" },
        react_1.default.createElement(Header_js_1.Header, { status: status }),
        react_1.default.createElement(ink_1.Box, { flexGrow: 1, flexDirection: "column" },
            react_1.default.createElement(ChatView_js_1.ChatView, { messages: messages }),
            status.status === 'thinking' && (react_1.default.createElement(ink_1.Box, { paddingX: 2, paddingY: 1 },
                react_1.default.createElement(Spinner_js_1.Spinner, { text: "Thinking..." }))),
            status.status === 'executing' && (react_1.default.createElement(ink_1.Box, { paddingX: 2, paddingY: 1 },
                react_1.default.createElement(Spinner_js_1.Spinner, { text: "Executing...", type: "dots" })))),
        showHelp && (react_1.default.createElement(ink_1.Box, { borderStyle: "single", borderColor: "cyan", paddingX: 1, marginX: 2, marginBottom: 1 },
            react_1.default.createElement(ink_1.Text, { color: "cyan" }, "\uD83D\uDCA1 Press F1 to hide | Tab for autocomplete | \u2191\u2193 for history"))),
        react_1.default.createElement(InputBox_js_1.InputBox, { value: input, onChange: setInput, onSubmit: handleSubmit, placeholder: "Type your message...", disabled: status.status !== 'idle' }),
        react_1.default.createElement(StatusBar_js_1.StatusBar, { status: status })));
};
exports.default = App;
// Main render function
const startCLI = (options) => {
    const { waitUntilExit } = (0, ink_1.render)(react_1.default.createElement(App, { ...options }));
    return waitUntilExit();
};
exports.startCLI = startCLI;
