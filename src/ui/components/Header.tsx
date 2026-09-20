/**
 * Header Component — compact branded banner
 */

import React from 'react';
import { Box, Text } from 'ink';

interface HeaderProps {
  model: string;
  mode: string;
  workingDir: string;
  status: AgentStatusLike;
}

export interface AgentStatusLike {
  status: 'idle' | 'thinking' | 'executing';
}

export const Header: React.FC<HeaderProps> = ({ model, mode, workingDir, status }) => {
  const statusInfo = (() => {
    switch (status.status) {
      case 'thinking':
        return { icon: '◉', color: 'yellow' as const, text: 'Thinking' };
      case 'executing':
        return { icon: '⚙', color: 'blue' as const, text: 'Working' };
      default:
        return { icon: '○', color: 'green' as const, text: 'Ready' };
    }
  })();

  const shortDir =
    workingDir.length > 32 ? '…' + workingDir.slice(-31) : workingDir;

  return (
    <Box flexDirection="column" paddingLeft={2} paddingTop={1} paddingBottom={1}>
      <Box gap={1}>
        <Text bold color="cyan">
          ◆ AGENT
        </Text>
        <Text color="gray">v0.2.0</Text>
        <Text color="gray">│</Text>
        <Text color={statusInfo.color}>
          {statusInfo.icon} {statusInfo.text}
        </Text>
      </Box>
      <Box gap={1}>
        <Text color="gray">model:</Text>
        <Text color="white">{model}</Text>
        <Text color="gray">│</Text>
        <Text color="magenta">{mode}</Text>
        <Text color="gray">│</Text>
        <Text color="gray">{shortDir}</Text>
      </Box>
    </Box>
  );
};
