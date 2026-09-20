/**
 * InputBox — input field with history navigation (↑/↓)
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

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
  placeholder = 'Type a message…',
  disabled = false,
}) => {
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useInput((_input, key) => {
    if (disabled) return;

    // Enter submits via TextInput; handle history navigation here
    if (key.upArrow && history.length > 0) {
      const newIndex = Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(newIndex);
      onChange(history[history.length - 1 - newIndex]);
    }

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

  const pushHistory = (submitted: string) => {
    setHistory((prev) => [...prev, submitted]);
    setHistoryIndex(-1);
  };

  return (
    <Box flexDirection="column" paddingLeft={2} paddingRight={2} paddingBottom={1}>
      <Box borderStyle="round" borderColor={disabled ? 'gray' : 'cyan'} paddingX={1}>
        <Box marginRight={1}>
          <Text color={disabled ? 'gray' : 'cyan'} bold>
            {disabled ? '⏳' : '❯'}
          </Text>
        </Box>
        {disabled ? (
          <Text color="gray" dimColor>
            {placeholder}
          </Text>
        ) : (
          <TextInput
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            onSubmit={(v) => {
              if (v.trim()) pushHistory(v);
              onSubmit(v);
            }}
          />
        )}
      </Box>
    </Box>
  );
};
