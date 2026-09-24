import React from 'react';
import { Box, Text } from 'ink';
import { Message, ToolEvent } from '../types.js';

interface ChatViewProps {
  messages: Message[];
  toolEvents: ToolEvent[];
}

export const ChatView: React.FC<ChatViewProps> = ({ messages, toolEvents }) => {
  const roleMeta: Record<string, { icon: string; color: string; label: string }> = {
    user: { icon: '❯', color: '#d8b4fe', label: 'You' },
    assistant: { icon: '◆', color: '#c084fc', label: 'IRIS' },
    system: { icon: '●', color: 'gray', label: 'System' },
  };

  return (
    <Box flexDirection="column" paddingLeft={2} paddingRight={2} rowGap={1}>
      {messages.map(message => {
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
                <Text key={i} color={message.role === 'system' ? 'gray' : 'white'} wrap="wrap">
                  {line || ' '}
                </Text>
              ))}
            </Box>
          </Box>
        );
      })}

      {toolEvents.length > 0 && (
        <Box flexDirection="column" paddingLeft={2}>
          {toolEvents.slice(-6).map(ev => (
            <Box key={ev.id} flexDirection="column">
              <Box gap={1}>
                <Text color={ev.status === 'running' ? '#c084fc' : ev.status === 'failed' ? 'red' : '#a78bfa'}>
                  {ev.status === 'running' ? '◌' : ev.status === 'failed' ? '✗' : '✓'}
                </Text>
                <Text color={ev.status === 'running' ? '#d8b4fe' : '#b8a8c7'}>
                  {ev.name}{ev.summary ? ` · ${summarize(ev.summary)}` : ''}
                  {ev.durationMs !== undefined ? ` · ${ev.durationMs}ms` : ''}
                  {ev.status === 'running' ? ' …' : ''}
                </Text>
              </Box>
              {ev.details ? <Text color={ev.status === 'failed' ? '#fda4af' : '#c4b5fd'}>   {ev.details}</Text> : null}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

function summarize(line: string): string {
  if (line.length <= 72) return line;
  return line.slice(0, 69) + '…';
}
