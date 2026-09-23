import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

interface InputBoxProps { value: string; onChange: (value: string) => void; onSubmit: (value: string) => void; placeholder?: string; disabled?: boolean; }
const PURPLE = '#c084fc';

export const InputBox: React.FC<InputBoxProps> = ({ value, onChange, onSubmit, placeholder = 'Type a message…', disabled = false }) => {
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  useInput((_input, key) => {
    if (disabled) return;
    if (key.upArrow && history.length > 0) {
      const newIndex = Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(newIndex); onChange(history[history.length - 1 - newIndex]);
    }
    if (key.downArrow) {
      if (historyIndex > 0) { const newIndex = historyIndex - 1; setHistoryIndex(newIndex); onChange(history[history.length - 1 - newIndex]); }
      else if (historyIndex === 0) { setHistoryIndex(-1); onChange(''); }
    }
  });
  return (
    <Box flexDirection="column" paddingLeft={2} paddingRight={2} paddingBottom={1}>
      <Box borderStyle="round" borderColor={disabled ? 'gray' : PURPLE} paddingX={1}>
        <Box marginRight={1}><Text color={disabled ? 'gray' : PURPLE} bold>{disabled ? '⏳' : '❯'}</Text></Box>
        {disabled ? <Text color="gray" dimColor>{placeholder}</Text> : <TextInput value={value} onChange={onChange} placeholder={placeholder} onSubmit={v => { if (v.trim()) { setHistory(prev => [...prev, v]); setHistoryIndex(-1); } onSubmit(v); }} />}
      </Box>
    </Box>
  );
};
