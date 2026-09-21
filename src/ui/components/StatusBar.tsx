import React from 'react';
import { Box, Text } from 'ink';
import { AgentStatus, CONTEXT_WINDOW } from '../types.js';

interface StatusBarProps {
  status: AgentStatus;
}

export const StatusBar: React.FC<StatusBarProps> = ({ status }) => {
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const tokenPercentage = Math.min((status.tokensUsed / CONTEXT_WINDOW) * 100, 100);
  const barWidth = 18;
  const filled = Math.round((tokenPercentage / 100) * barWidth);
  const empty = barWidth - filled;

  const barColor = tokenPercentage > 80 ? 'red' : tokenPercentage > 50 ? 'yellow' : 'green';

  const contextLabel = `${Math.round(CONTEXT_WINDOW / 1000)}K`;

  return (
    <Box paddingLeft={2} paddingRight={2} paddingTop={0} paddingBottom={1}>
      <Box
        borderStyle="round"
        borderColor="gray"
        paddingX={1}
        justifyContent="space-between"
        width="100%"
      >
        <Text color="green">✓ {status.tasksCompleted} tasks</Text>
        <Text>
          <Text color="gray">tok </Text>
          <Text color={barColor}>
            {'█'.repeat(filled)}
            {'░'.repeat(empty)}
          </Text>
          <Text color={barColor}>
            {' '}
            {formatNumber(status.tokensUsed)}/{contextLabel}
          </Text>
        </Text>
        <Text color="gray">ctrl+c exit</Text>
      </Box>
    </Box>
  );
};
