/**
 * StatusBar Component - Bottom Status Bar
 * Shows real-time stats like Claude Code
 */

import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import { AgentStatus } from '../types.js';

interface StatusBarProps {
  status: AgentStatus;
}

export const StatusBar: React.FC<StatusBarProps> = ({ status }) => {
  // Format large numbers with K/M suffix
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  // Calculate token usage percentage (assume 200K max)
  const tokenPercentage = Math.min((status.tokensUsed / 200000) * 100, 100);
  const tokenBarWidth = 20;
  const tokenFilled = Math.floor((tokenPercentage / 100) * tokenBarWidth);
  const tokenEmpty = tokenBarWidth - tokenFilled;

  // Token bar color based on usage
  const getTokenColor = () => {
    if (tokenPercentage > 80) return 'red';
    if (tokenPercentage > 50) return 'yellow';
    return 'green';
  };

  return (
    <Box
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      marginX={2}
      marginBottom={1}
    >
      <Box justifyContent="space-between" width="100%">
        {/* Left: Tasks */}
        <Box gap={2}>
          <Text color="green">
            ✓ Tasks: {status.tasksCompleted}
          </Text>
        </Box>

        {/* Center: Token Usage */}
        <Box gap={1}>
          <Text color="gray">Tokens:</Text>
          <Text color={getTokenColor()}>
            [{chalk[getTokenColor()]('█'.repeat(tokenFilled))}
            {chalk.gray('░'.repeat(tokenEmpty))}]
          </Text>
          <Text color={getTokenColor()}>
            {formatNumber(status.tokensUsed)}/200K
          </Text>
          <Text color="gray">
            ({tokenPercentage.toFixed(0)}%)
          </Text>
        </Box>

        {/* Right: Model */}
        <Box gap={1}>
          <Text color="gray">Model:</Text>
          <Text color="cyan">
            {status.model.split('-').pop()?.toUpperCase()}
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
