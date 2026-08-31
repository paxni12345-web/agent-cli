/**
 * ChatView Component - Message Display
 * Beautiful message rendering like Claude Code
 */

import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import { Message } from '../types.js';

interface ChatViewProps {
  messages: Message[];
}

export const ChatView: React.FC<ChatViewProps> = ({ messages }) => {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'user':
        return { icon: '👤', color: 'cyan', label: 'You' };
      case 'assistant':
        return { icon: '🤖', color: 'magenta', label: 'Agent' };
      case 'system':
        return { icon: '⚙', color: 'gray', label: 'System' };
      default:
        return { icon: '●', color: 'gray', label: 'Unknown' };
    }
  };

  return (
    <Box
      flexDirection="column"
      paddingX={2}
      paddingY={1}
      flexGrow={1}
      overflowY="auto"
    >
      {messages.length === 0 ? (
        <Box justifyContent="center" alignItems="center" flexGrow={1}>
          <Text color="gray" italic>
            No messages yet. Start typing below...
          </Text>
        </Box>
      ) : (
        messages.map((message) => {
          const roleInfo = getRoleIcon(message.role);

          return (
            <Box
              key={message.id}
              flexDirection="column"
              marginBottom={1}
              paddingY={1}
              borderStyle="single"
              borderColor={
                message.role === 'user' ? 'cyan' :
                message.role === 'assistant' ? 'magenta' :
                'gray'
              }
              paddingX={1}
            >
              {/* Message Header */}
              <Box justifyContent="space-between" marginBottom={1}>
                {/* Left: Role */}
                <Box gap={1}>
                  <Text>{roleInfo.icon}</Text>
                  <Text bold color={roleInfo.color}>
                    {roleInfo.label}
                  </Text>
                </Box>

                {/* Right: Timestamp */}
                <Text color="gray" dimColor>
                  {formatTime(message.timestamp)}
                </Text>
              </Box>

              {/* Message Content */}
              <Box flexDirection="column">
                {message.content.split('\n').map((line, index) => (
                  <Text key={index} color="white">
                    {line || ' '}
                  </Text>
                ))}
              </Box>

              {/* Metadata (if exists) */}
              {message.metadata && (
                <Box marginTop={1} gap={2}>
                  {message.metadata.tokensUsed && (
                    <Text color="gray" dimColor>
                      🔢 {message.metadata.tokensUsed} tokens
                    </Text>
                  )}
                  {message.metadata.duration && (
                    <Text color="gray" dimColor>
                      ⏱ {message.metadata.duration}ms
                    </Text>
                  )}
                </Box>
              )}
            </Box>
          );
        })
      )}
    </Box>
  );
};
