/**
 * Footer Component - Additional Info Panel
 * Shows helpful shortcuts and tips
 */

import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';

interface FooterProps {
  showTips?: boolean;
}

export const Footer: React.FC<FooterProps> = ({ showTips = true }) => {
  const shortcuts = [
    { key: 'Enter', desc: 'Send message' },
    { key: '↑/↓', desc: 'History' },
    { key: 'Tab', desc: 'Autocomplete' },
    { key: 'Ctrl+L', desc: 'Clear' },
    { key: 'Ctrl+C', desc: 'Exit' },
    { key: 'F1', desc: 'Help' },
  ];

  if (!showTips) return null;

  return (
    <Box
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      marginX={2}
      marginBottom={1}
    >
      <Box gap={2}>
        <Text color="gray" dimColor>
          💡 Quick Tips:
        </Text>
        {shortcuts.map((shortcut, index) => (
          <React.Fragment key={index}>
            {index > 0 && (
              <Text color="gray" dimColor>
                │
              </Text>
            )}
            <Text>
              <Text color="cyan" bold>
                {shortcut.key}
              </Text>
              <Text color="gray" dimColor>
                {' '}
                {shortcut.desc}
              </Text>
            </Text>
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );
};
