/**
 * Main Application - Claude Code CLI Style
 * Beautiful terminal interface for Agent CLI
 */

import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import { Header } from './components/Header.js';
import { ChatView } from './components/ChatView.js';
import { InputBox } from './components/InputBox.js';
import { StatusBar } from './components/StatusBar.js';
import { Spinner } from './components/Spinner.js';
import { AgentStatus, Message } from './types.js';

interface AppProps {
  workingDirectory: string;
  model?: string;
  mode?: 'normal' | 'fast' | 'ultra';
}

const App: React.FC<AppProps> = ({
  workingDirectory,
  model = 'claude-opus-4',
  mode = 'normal'
}) => {
  const { exit } = useApp();

  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<AgentStatus>({
    status: 'idle',
    model: model,
    mode: mode,
    workingDir: workingDirectory,
    tokensUsed: 0,
    tasksCompleted: 0,
  });
  const [showHelp, setShowHelp] = useState(false);

  // Add welcome message
  useEffect(() => {
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
  useInput((input, key) => {
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
  const handleSubmit = async (message: string) => {
    if (!message.trim()) return;

    // Add user message
    const userMessage: Message = {
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
      const aiMessage: Message = {
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
  const handleCommand = (command: string) => {
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

    } else if (cmd === '/clear') {
      setMessages([]);
      return;

    } else if (cmd === '/status') {
      response = `Current Status:

Model:         ${status.model}
Mode:          ${status.mode}
Status:        ${status.status}
Working Dir:   ${status.workingDir}
Tokens Used:   ${status.tokensUsed}
Tasks Done:    ${status.tasksCompleted}`;

    } else if (cmd === '/exit') {
      exit();
      return;

    } else {
      response = `Unknown command: ${command}\nType /help for available commands.`;
    }

    const systemMessage: Message = {
      id: Date.now().toString(),
      role: 'system',
      content: response,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, systemMessage]);
    setStatus((prev) => ({ ...prev, status: 'idle' }));
  };

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Header status={status} />

      {/* Main Content */}
      <Box flexGrow={1} flexDirection="column">
        {/* Chat Messages */}
        <ChatView messages={messages} />

        {/* Loading Indicator */}
        {status.status === 'thinking' && (
          <Box paddingX={2} paddingY={1}>
            <Spinner text="Thinking..." />
          </Box>
        )}

        {status.status === 'executing' && (
          <Box paddingX={2} paddingY={1}>
            <Spinner text="Executing..." type="dots" />
          </Box>
        )}
      </Box>

      {/* Help Panel */}
      {showHelp && (
        <Box
          borderStyle="single"
          borderColor="cyan"
          paddingX={1}
          marginX={2}
          marginBottom={1}
        >
          <Text color="cyan">
            💡 Press F1 to hide | Tab for autocomplete | ↑↓ for history
          </Text>
        </Box>
      )}

      {/* Input Box */}
      <InputBox
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        placeholder="Type your message..."
        disabled={status.status !== 'idle'}
      />

      {/* Status Bar */}
      <StatusBar status={status} />
    </Box>
  );
};

export default App;

// Main render function
export const startCLI = (options: AppProps) => {
  const { waitUntilExit } = render(<App {...options} />);
  return waitUntilExit();
};
