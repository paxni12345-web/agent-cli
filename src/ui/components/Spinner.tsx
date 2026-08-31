/**
 * Spinner Component - Loading Indicator
 * Beautiful animated spinner like Claude Code
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';

interface SpinnerProps {
  text?: string;
  type?: 'dots' | 'line' | 'arc' | 'bounce' | 'pulse';
  color?: 'cyan' | 'magenta' | 'yellow' | 'green';
}

export const Spinner: React.FC<SpinnerProps> = ({
  text = 'Loading...',
  type = 'dots',
  color = 'cyan',
}) => {
  const [frame, setFrame] = useState(0);

  // Spinner frames by type
  const frames = {
    dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
    line: ['—', '\\', '|', '/'],
    arc: ['◜', '◠', '◝', '◞', '◡', '◟'],
    bounce: ['⠁', '⠂', '⠄', '⠂'],
    pulse: ['●', '◉', '◎', '○', '◎', '◉'],
  };

  const currentFrames = frames[type];

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % currentFrames.length);
    }, 80);

    return () => clearInterval(interval);
  }, [currentFrames.length]);

  return (
    <Box gap={1}>
      <Text color={color}>
        {currentFrames[frame]}
      </Text>
      <Text color={color}>
        {text}
      </Text>
    </Box>
  );
};
