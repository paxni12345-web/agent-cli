/**
 * InputBox Component - Message Input
 * Beautiful input field like Claude Code
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import chalk from 'chalk';

interface InputBoxProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const InputBox: React.FC<InputBoxProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = 'Type your message...',
  disabled = false,
}) => {
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useInput((input, key) => {
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
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        onChange('');
      }
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={disabled ? 'gray' : 'cyan'}
      paddingX={1}
      marginX={2}
      marginBottom={1}
    >
      {/* Input Label */}
      <Box justifyContent="space-between" marginBottom={0}>
        <Text color="cyan" bold>
          {disabled ? '⏸  ' : '▶  '}
          Message
        </Text>
        <Text color="gray" dimColor>
          {disabled ? 'Please wait...' : 'Enter to send'}
        </Text>
      </Box>

      {/* Input Field */}
      <Box>
        <Text color="gray">│ </Text>
        {disabled ? (
          <Text color="gray" dimColor>
            {placeholder}
          </Text>
        ) : (
          <TextInput
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            showCursor={!disabled}
          />
        )}
      </Box>

      {/* Hints */}
      <Box marginTop={0} gap={2}>
        <Text color="gray" dimColor>
          💡 /help for commands
        </Text>
        <Text color="gray" dimColor>
          │
        </Text>
        <Text color="gray" dimColor>
          ↑↓ for history
        </Text>
        <Text color="gray" dimColor>
          │
        </Text>
        <Text color="gray" dimColor>
          Ctrl+C to exit
        </Text>
      </Box>
    </Box>
  );
};
