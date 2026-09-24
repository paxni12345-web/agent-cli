import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

interface InputBoxProps { value: string; onChange: (value: string) => void; onSubmit: (value: string) => void; placeholder?: string; disabled?: boolean; }
const PURPLE = '#c084fc';
const SLASH_COMMANDS = [
  { name: '/help', description: 'แสดงรายการคำสั่งทั้งหมด' },
  { name: '/clear', description: 'ล้างหน้าประวัติแชต' },
  { name: '/reset', description: 'รีเซ็ตสถานะ agent และตัวนับ' },
  { name: '/status', description: 'ดูสถานะและจำนวนการเรียก tool' },
  { name: '/stats', description: 'ดูสถิติประสิทธิภาพ tool' },
  { name: '/tools', description: 'แสดง tools ที่ใช้งานได้' },
  { name: '/model', description: 'ดูโมเดลปัจจุบัน หรือเปลี่ยนโมเดล: /model <name>' },
  { name: '/exit', description: 'ออกจากโปรแกรม' },
];

export const InputBox: React.FC<InputBoxProps> = ({ value, onChange, onSubmit, placeholder = 'Type a message…', disabled = false }) => {
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const commandQuery = value.startsWith('/') ? value.split(/\s/, 1)[0].toLowerCase() : '';
  const commandHints = commandQuery
    ? SLASH_COMMANDS.filter(command => command.name.startsWith(commandQuery))
    : [];
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
      {commandHints.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="#a78bfa" bold>คำสั่งที่ใช้ได้</Text>
          {commandHints.map(command => (
            <Box key={command.name} gap={1}>
              <Text color={PURPLE} bold>{command.name}</Text>
              <Text color="#c4b5fd">{command.description}</Text>
            </Box>
          ))}
        </Box>
      )}
      <Box borderStyle="round" borderColor={disabled ? 'gray' : PURPLE} paddingX={1}>
        <Box marginRight={1}><Text color={disabled ? 'gray' : PURPLE} bold>{disabled ? '⏳' : '❯'}</Text></Box>
        {disabled ? <Text color="gray" dimColor>{placeholder}</Text> : <TextInput value={value} onChange={onChange} placeholder={placeholder} onSubmit={v => { if (v.trim()) { setHistory(prev => [...prev, v]); setHistoryIndex(-1); } onSubmit(v); }} />}
      </Box>
    </Box>
  );
};
