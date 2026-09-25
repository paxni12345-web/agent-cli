import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

interface InputBoxProps { value: string; onChange: (value: string) => void; onSubmit: (value: string) => void; placeholder?: string; disabled?: boolean; welcome?: boolean; secure?: boolean; }
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
const MAX_VISIBLE = 6;

export const InputBox: React.FC<InputBoxProps> = ({ value, onChange, onSubmit, placeholder = 'Type a message…', disabled = false, welcome = false, secure = false }) => {
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  // Command menu opens while the input is a single "/word" token and closes
  // once args are typed or Esc is pressed.
  const isSlashToken = !secure && value.startsWith('/') && !/\s/.test(value.trimEnd()) && value.trimEnd() === value;
  const menuOpen = !disabled && !secure && !dismissed && isSlashToken;
  const commandQuery = menuOpen ? value.toLowerCase() : '';
  const commandHints = commandQuery
    ? SLASH_COMMANDS.filter(command => command.name.startsWith(commandQuery))
    : [];
  const menuActive = menuOpen && commandHints.length > 0;
  const isExactCommand = commandHints.some(command => command.name === commandQuery);

  const handleInputChange = (next: string) => {
    setSelectedIndex(0);
    setDismissed(false);
    onChange(next);
  };

  const completeSelected = () => {
    const command = commandHints[selectedIndex];
    if (!command) return;
    // Trailing space fills the command and closes the menu so args can follow.
    handleInputChange(command.name + ' ');
  };

  useInput((_input, key) => {
    if (disabled) return;
    if (secure) {
      if (key.return) {
        // Empty Enter is allowed — callers decide how to handle skips.
        onSubmit(value);
        return;
      }
      if (key.backspace || key.delete) {
        onChange(value.slice(0, -1));
        return;
      }
      if (_input && !key.ctrl && !key.meta && _input.length === 1) onChange(value + _input);
      return;
    }
    if (menuActive && key.tab) {
      completeSelected();
      return;
    }
    if (menuActive && key.escape) {
      setDismissed(true);
      return;
    }
    if (menuActive && (key.upArrow || key.downArrow)) {
      const dir = key.upArrow ? -1 : 1;
      setSelectedIndex(prev => (prev + dir + commandHints.length) % commandHints.length);
      return;
    }
    if (key.upArrow && history.length > 0) {
      const newIndex = Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(newIndex); onChange(history[history.length - 1 - newIndex]);
    }
    if (key.downArrow) {
      if (historyIndex > 0) { const newIndex = historyIndex - 1; setHistoryIndex(newIndex); onChange(history[history.length - 1 - newIndex]); }
      else if (historyIndex === 0) { setHistoryIndex(-1); onChange(''); }
    }
  });

  const submitValue = (raw: string) => {
    // Partial command + Enter completes the highlighted suggestion first;
    // an exact command (or a closed menu) submits as usual.
    if (menuActive && !isExactCommand) {
      completeSelected();
      return;
    }
    if (raw.trim()) { setHistory(prev => [...prev, raw]); setHistoryIndex(-1); }
    onSubmit(raw);
  };

  const windowStart =
    selectedIndex < MAX_VISIBLE
      ? 0
      : Math.min(selectedIndex - MAX_VISIBLE + 1, Math.max(0, commandHints.length - MAX_VISIBLE));
  const visibleCommands = commandHints.slice(windowStart, windowStart + MAX_VISIBLE);

  return (
    <Box flexDirection="column" paddingLeft={welcome ? 0 : 2} paddingRight={welcome ? 0 : 2} paddingBottom={1}>
      <Box borderStyle={welcome ? 'single' : 'round'} borderColor={disabled ? 'gray' : PURPLE} paddingX={welcome ? 2 : 1} paddingY={welcome ? 1 : 0}>
        <Box marginRight={1}><Text color={disabled ? 'gray' : PURPLE} bold>{disabled ? '⏳' : '❯'}</Text></Box>
        {disabled ? <Text color="gray" dimColor>{placeholder}</Text> : secure ? <Text color={value ? '#e9d5ff' : '#756783'}>{value ? '•'.repeat(value.length) : placeholder}<Text color={PURPLE}>▍</Text></Text> : <TextInput value={value} onChange={handleInputChange} placeholder={placeholder} onSubmit={submitValue} />}
      </Box>
      {menuActive && (
        <Box flexDirection="column" borderStyle="round" borderColor="#6d5a7e" paddingX={1} marginTop={1}>
          {visibleCommands.map((command, index) => {
            const absoluteIndex = windowStart + index;
            const selected = absoluteIndex === selectedIndex;
            return (
              <Box key={command.name} gap={1}>
                <Text color={selected ? '#e9d5ff' : PURPLE} bold={selected}>{selected ? '❯' : ' '} {command.name}</Text>
                <Text color="#c4b5fd" dimColor={!selected}>{command.description}</Text>
              </Box>
            );
          })}
          {commandHints.length > visibleCommands.length && (
            <Text color="#8b7a9e" dimColor>…และอีก {commandHints.length - visibleCommands.length} คำสั่ง</Text>
          )}
          <Text color="#8b7a9e" dimColor>↑/↓ เลือก · Tab/Enter เติมให้ · Esc ปิด</Text>
        </Box>
      )}
    </Box>
  );
};
