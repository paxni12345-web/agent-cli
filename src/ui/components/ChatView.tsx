/**
 * ChatView — renders conversation, tool activity, and streaming text
 */

import React from 'react';
import { Box, Text } from 'ink';
import { Message, ToolEvent } from '../types.js';

interface ChatViewProps {
  messages: Message[];
  toolEvents: ToolEvent[];
  streamingText?: string;
}

export const ChatView: React.FC<ChatViewProps> = ({ messages, toolEvents, streamingText }) => {
  const roleMeta: Record<string, { icon: string; color: 'cyan' | 'magenta' | 'gray'; label: string }> = {
    user: { icon: '❯', color: 'cyan', label: 'You' },
    assistant: { icon: '◆', color: 'magenta', label: 'Agent' },
    system: { icon: '●', color: 'gray', label: 'System' },
  };

  const summarize = (line: string): string => {
    if (line.length <= 72) return line;
    return line.slice(0, 69) + '…';
  };

  return (
    <Box flexDirection="column" paddingLeft={2} paddingRight={2} rowGap={1}>
      {messages.map((message) => {
        const meta = roleMeta[message.role] ?? roleMeta.system;
        return (
          <Box key={message.id} flexDirection="column">
            <Box gap={1}>
              <Text color={meta.color} bold>
                {meta.icon} {meta.label}
              </Text>
              <Text color="gray" dimColor>
                {message.timestamp.toLocaleTimeString('en-GB')}
              </Text>
            </Box>
            <Box paddingLeft={2} flexDirection="column">
              {message.content.split('\n').map((line, i) => (
                <Text key={i} color={message.role === 'system' ? 'gray' : 'white'} wrap="truncate">
                  {line || ' '}
                </Text>
              ))}
            </Box>
          </Box>
        );
      })}

      {toolEvents.length > 0 && (
        <Box flexDirection="column" paddingLeft={2}>
          {toolEvents.slice(-6).map((ev) => (
            <Box key={ev.id} gap={1}>
              <Text color={ev.status === 'running' ? 'yellow' : ev.status === 'failed' ? 'red' : 'green'}>
                {ev.status === 'running' ? '◌' : ev.status === 'failed' ? '✗' : '✓'}
              </Text>
              <Text color="gray">
                {ev.name}
                {ev.summary ? `(${summarize(ev.summary)})` : ''}
                {ev.durationMs !== undefined ? ` · ${ev.durationMs}ms` : ''}
              </Text>
            </Box>
            ))}
        </Box>
      )}

      {streamingText !== undefined && streamingText.length > 0 && (
        <Box paddingLeft={2}>
          <Text color="white">{streamingText}</Text>
        </Box>
      )}
    </Box>
  );
};
