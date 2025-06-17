import React from 'react'
import { Box, Text } from 'ink'

export interface MessageProps {
  role: 'user' | 'assistant'
  content: string
  timestamp?: Date
  toolCalls?: ToolCall[]
}

export interface ToolCall {
  id: string
  name: string
  status: 'running' | 'success' | 'error'
  title: string
  result?: string
}

export function Message({ role, content, timestamp, toolCalls }: MessageProps) {
  return (
    <Box flexDirection="column" marginY={1}>
      {/* Message Header */}
      <Box marginBottom={1}>
        <Text bold color={role === 'user' ? 'yellow' : 'cyan'}>
          {role === 'user' ? '> ' : '◍ '}
        </Text>
        <Text color={role === 'user' ? 'yellow' : 'cyan'}>
          {role === 'user' ? 'You' : 'OpenCode'}
        </Text>
        {timestamp && (
          <Text color="gray" dimColor>
            {' '}({timestamp.toLocaleTimeString()})
          </Text>
        )}
      </Box>

      {/* Message Content */}
      <Box marginLeft={2} marginBottom={1}>
        <Text>{content}</Text>
      </Box>

      {/* Tool Calls */}
      {toolCalls && toolCalls.length > 0 && (
        <Box flexDirection="column" marginLeft={2}>
          {toolCalls.map((tool) => (
            <ToolCallDisplay key={tool.id} tool={tool} />
          ))}
        </Box>
      )}
    </Box>
  )
}

function ToolCallDisplay({ tool }: { tool: ToolCall }) {
  const getStatusColor = () => {
    switch (tool.status) {
      case 'running': return 'yellow'
      case 'success': return 'green'
      case 'error': return 'red'
      default: return 'gray'
    }
  }

  const getStatusIcon = () => {
    switch (tool.status) {
      case 'running': return '◐'
      case 'success': return '✓'
      case 'error': return '✗'
      default: return '◯'
    }
  }

  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        <Text color={getStatusColor()}>
          {getStatusIcon()} {tool.name.padEnd(8)}
        </Text>
        <Text dimColor> {tool.title}</Text>
      </Box>
      
      {tool.result && tool.status === 'success' && (
        <Box marginLeft={2} marginTop={1}>
          <Text dimColor>{tool.result}</Text>
        </Box>
      )}
    </Box>
  )
} 