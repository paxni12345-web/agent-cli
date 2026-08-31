/**
 * Header Component - Claude Code Style
 * Beautiful header with gradient and status indicators
 */

import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import { AgentStatus } from '../types.js';

interface HeaderProps {
  status: AgentStatus;
}

export const Header: React.FC<HeaderProps> = ({ status }) => {
  // Status indicator with colors
  const getStatusIndicator = () => {
    switch (status.status) {
      case 'thinking':
        return { icon: '◉', color: 'yellow', text: 'Thinking' };
      case 'executing':
        return { icon: '⚙', color: 'blue', text: 'Executing' };
      case 'completed':
        return { icon: '✓', color: 'green', text: 'Done' };
      case 'error':
        return { icon: '✗', color: 'red', text: 'Error' };
      default:
        return { icon: '○', color: 'gray', text: 'Ready' };
    }
  };

  const statusInfo = getStatusIndicator();

  // Mode badge with colors
  const getModeStyle = () => {
    switch (status.mode) {
      case 'ultra':
        return { bg: chalk.bgMagenta, fg: chalk.white, label: '⚡ ULTRA' };
      case 'fast':
        return { bg: chalk.bgCyan, fg: chalk.black, label: '🚀 FAST' };
      default:
        return { bg: chalk.bgGray, fg: chalk.white, label: '● NORMAL' };
    }
  };

  const modeStyle = getModeStyle();

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      marginBottom={1}
    >
      {/* Top Bar - Logo and Status */}
      <Box justifyContent="space-between" width="100%">
        {/* Left: Logo */}
        <Box gap={1}>
          <Text bold color="cyan">
            {chalk.cyan('╔═══╗')}
          </Text>
          <Text bold color="cyanBright">
            Agent CLI
          </Text>
          <Text color="gray">
            │ v0.1.0
          </Text>
        </Box>

        {/* Right: Status */}
        <Box gap={1}>
          <Text color={statusInfo.color}>
            {statusInfo.icon}
          </Text>
          <Text color={statusInfo.color}>
            {statusInfo.text}
          </Text>
        </Box>
      </Box>

      {/* Bottom Bar - Model and Mode */}
      <Box justifyContent="space-between" width="100%" marginTop={1}>
        {/* Left: Model Info */}
        <Box gap={1}>
          <Text color="gray">Model:</Text>
          <Text bold color="white">
            {status.model}
          </Text>
        </Box>

        {/* Center: Working Directory */}
        <Box gap={1}>
          <Text color="gray">📁</Text>
          <Text color="gray">
            {status.workingDir.length > 30
              ? '...' + status.workingDir.slice(-27)
              : status.workingDir
            }
          </Text>
        </Box>

        {/* Right: Mode Badge */}
        <Text>
          {modeStyle.bg(modeStyle.fg(` ${modeStyle.label} `))}
        </Text>
      </Box>
    </Box>
  );
};
