import React from 'react';
import { Box, Text } from 'ink';

interface HeaderProps {
  provider: string;
  model: string;
  baseUrl?: string;
  mode: string;
  workingDir: string;
  status: AgentStatusLike;
}

export interface AgentStatusLike {
  status: 'idle' | 'thinking' | 'executing';
}

export const Header: React.FC<HeaderProps> = ({ provider, model, baseUrl, mode, workingDir, status }) => {
  const statusInfo = (() => {
    switch (status.status) {
      case 'thinking':
        return { icon: '◉', color: '#d8b4fe' as const, text: 'Thinking' };
      case 'executing':
        return { icon: '⚙', color: '#c4b5fd' as const, text: 'Working' };
      default:
        return { icon: '○', color: '#a7f3d0' as const, text: 'Ready' };
    }
  })();

  const shortDir = workingDir.length > 32 ? '…' + workingDir.slice(-31) : workingDir;

  return (
    <Box flexDirection="column" paddingLeft={2} paddingTop={1} paddingBottom={1}>
      <Text color="#c084fc" bold>{`██╗██████╗ ██╗███████╗`}</Text>
      <Text color="#c084fc" bold>{`██║██╔══██╗██║██╔════╝`}</Text>
      <Text color="#c084fc" bold>{`██║██████╔╝██║███████╗`}</Text>
      <Text color="#c084fc" bold>{`██║██╔══██╗██║╚════██║`}</Text>
      <Text color="#c084fc" bold>{`██║██║  ██║██║███████║`}</Text>
      <Text color="#c084fc" bold>{`╚═╝╚═╝  ╚═╝╚═╝╚══════╝`}</Text>
      <Box gap={1} marginTop={1}>
        <Text bold color="#e9d5ff">IRIS</Text>
        <Text color="gray">· Agent CLI</Text>
        <Text color={statusInfo.color}>{statusInfo.icon} {statusInfo.text}</Text>
      </Box>
      <Box gap={1}>
        <Text color="#c4b5fd">{provider}</Text>
        <Text color="#f5d0fe" bold>{model}</Text>
        {baseUrl ? <Text color="#a78bfa">via {baseUrl}</Text> : null}
        <Text color="#d8b4fe">{mode} mode</Text>
      </Box>
      <Text color="#a78bfa">{shortDir}</Text>
    </Box>
  );
};
