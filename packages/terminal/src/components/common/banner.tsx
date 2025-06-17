import React from 'react'
import { Box, Text } from 'ink'

export function Banner({ padding = '' }: { padding?: string }) {
  const logo = [
    ['█▀▀█ █▀▀█ █▀▀ █▀▀▄ ', '█▀▀ █▀▀█ █▀▀▄ █▀▀'],
    ['█░░█ █░░█ █▀▀ █░░█ ', '█░░ █░░█ █░░█ █▀▀'],
    ['▀▀▀▀ █▀▀▀ ▀▀▀ ▀  ▀ ', '▀▀▀ ▀▀▀▀ ▀▀▀  ▀▀▀'],
  ]

  return (
    <Box flexDirection="column">
      {logo.map((row, index) => (
        <Box key={index}>
          <Text>{padding}</Text>
          <Text color="gray">{row[0]}</Text>
          <Text color="white">{row[1]}</Text>
        </Box>
      ))}
    </Box>
  )
}

export function CompactHeader() {
  return (
    <Box flexDirection="column">
      <Box justifyContent="center" paddingY={1}>
        <Text bold color="cyan">◍ OpenCode</Text>
        <Text color="gray" dimColor> - AI Coding Assistant</Text>
      </Box>
      <Box>
        <Text color="gray">─────────────────────────────────────────────────────────</Text>
      </Box>
    </Box>
  )
} 