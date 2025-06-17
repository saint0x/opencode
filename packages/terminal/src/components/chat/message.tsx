import React from 'react'
import { Box, Text } from 'ink'

export interface MessageProps {
  role: 'user' | 'assistant'
  content: string
  timestamp?: Date | string
  toolCalls?: ToolCall[]
}

export interface ToolCall {
  id: string
  name: string
  status: 'pending' | 'running' | 'success' | 'error'
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
            {' '}({new Date(timestamp).toLocaleTimeString()})
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
  const getToolColor = () => {
    switch (tool.name) {
      case 'edit':
      case 'write': return 'green'
      case 'bash':
      case 'execute': return 'red'
      case 'read':
      case 'fetch': return 'cyan'
      case 'list':
      case 'glob':
      case 'grep': return 'blue'
      case 'todo':
      case 'todoread':
      case 'todowrite': return 'yellow'
      default: return 'blue'
    }
  }

  const getStatusIcon = () => {
    switch (tool.status) {
      case 'pending': return '◯'
      case 'running': return '◐'
      case 'success': return '|'
      case 'error': return '✗'
      default: return '◯'
    }
  }

  const getDisplayName = () => {
    switch (tool.name) {
      case 'edit': return 'Edit'
      case 'write': return 'Write'
      case 'read': return 'Read'
      case 'list': return 'List'
      case 'glob': return 'Glob'
      case 'grep': return 'Grep'
      case 'bash': return 'Bash'
      case 'execute': return 'Exec'
      case 'fetch': return 'Fetch'
      case 'todo': return 'Todo'
      case 'todoread': return 'Todo'
      case 'todowrite': return 'Todo'
      default: return tool.name.charAt(0).toUpperCase() + tool.name.slice(1)
    }
  }

  return (
    <Box>
      <Text color={tool.status === 'success' ? getToolColor() : 'gray'}>
        {getStatusIcon()}
      </Text>
      <Text dimColor> {getDisplayName().padEnd(7, ' ')}</Text>
      <Text> {tool.title}</Text>
    </Box>
  )
} 