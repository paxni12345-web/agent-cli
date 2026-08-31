/**
 * LogView Component - Tool Execution Logs
 * Shows real-time tool execution like Claude Code
 */

import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import { ToolExecution } from '../types.js';

interface LogViewProps {
  executions: ToolExecution[];
  maxItems?: number;
}

export const LogView: React.FC<LogViewProps> = ({
  executions,
  maxItems = 5,
}) => {
  const recentExecutions = executions.slice(-maxItems);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return { icon: '⚙', color: 'blue' };
      case 'completed':
        return { icon: '✓', color: 'green' };
      case 'failed':
        return { icon: '✗', color: 'red' };
      default:
        return { icon: '○', color: 'gray' };
    }
  };

  const getDuration = (execution: ToolExecution) => {
    if (!execution.endTime) return 'Running...';
    const duration = execution.endTime.getTime() - execution.startTime.getTime();
    return `${duration}ms`;
  };

  if (executions.length === 0) {
    return null;
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="blue"
      paddingX={1}
      marginX={2}
      marginY={1}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="blue">
          🔧 Tool Executions
        </Text>
      </Box>

      {/* Execution List */}
      {recentExecutions.map((execution) => {
        const statusInfo = getStatusIcon(execution.status);

        return (
          <Box key={execution.id} gap={1} marginBottom={1}>
            {/* Status Icon */}
            <Text color={statusInfo.color}>
              {statusInfo.icon}
            </Text>

            {/* Tool Name */}
            <Text color="white" bold>
              {execution.name}
            </Text>

            {/* Duration */}
            <Text color="gray">
              ({getDuration(execution)})
            </Text>

            {/* Output/Error */}
            {execution.status === 'completed' && execution.output && (
              <Text color="gray" dimColor>
                → {execution.output.slice(0, 50)}
                {execution.output.length > 50 ? '...' : ''}
              </Text>
            )}

            {execution.status === 'failed' && execution.error && (
              <Text color="red">
                → Error: {execution.error.slice(0, 50)}
                {execution.error.length > 50 ? '...' : ''}
              </Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
};
