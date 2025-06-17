import React, { useState, useEffect } from 'react'
import { Box, Text } from 'ink'
import { Banner } from '../common/banner.js'
import { ToolCall } from '../chat/message.js'

interface RunModeProps {
  message: string
  sessionId?: string
  share?: boolean
}

interface ToolEvent {
  tool: string
  title: string
  color: string
}

const TOOL_COLORS: Record<string, [string, string]> = {
  read: ['Read', 'cyan'],
  write: ['Write', 'green'],
  edit: ['Edit', 'green'],
  bash: ['Bash', 'red'],
  grep: ['Grep', 'blue'],
  glob: ['Glob', 'blue'],
  list: ['List', 'blue'],
  todo: ['Todo', 'yellow'],
}

export function RunMode({ message, sessionId, share }: RunModeProps) {
  const [events, setEvents] = useState<ToolEvent[]>([])
  const [isComplete, setIsComplete] = useState(false)
  const [response, setResponse] = useState('')

  useEffect(() => {
    simulateExecution()
  }, [])

  const simulateExecution = async () => {
    // Show banner and initial message
    await new Promise(resolve => setTimeout(resolve, 100))

    // Simulate tool execution events
    const toolSequence = [
      { tool: 'read', title: 'Reading project files', delay: 500 },
      { tool: 'grep', title: 'Searching for patterns', delay: 800 },
      { tool: 'edit', title: 'Updating configuration', delay: 1200 },
      { tool: 'write', title: 'Creating new file', delay: 600 },
    ]

    for (const { tool, title, delay } of toolSequence) {
      await new Promise(resolve => setTimeout(resolve, delay))
      
      const [toolName, color] = TOOL_COLORS[tool] || [tool, 'white']
      setEvents(prev => [...prev, { tool: toolName, title, color }])
    }

    // Show final response
    await new Promise(resolve => setTimeout(resolve, 800))
    setResponse(`I've analyzed your request: "${message}"\n\nI found and updated the relevant files. The changes have been applied successfully.`)
    setIsComplete(true)
  }

  const sessionDisplay = sessionId ? sessionId.slice(-8) : 'new'
  const shareUrl = share ? `https://opencode.ai/s/${sessionDisplay}` : null

  return (
    <Box flexDirection="column">
      {/* Banner */}
      <Box marginBottom={1}>
        <Banner />
      </Box>

      {/* User message */}
      <Box marginBottom={1}>
        <Text bold color="white">{'> '}</Text>
        <Text>{message}</Text>
      </Box>

      {/* Share URL */}
      {shareUrl && (
        <Box marginBottom={1}>
          <Text bold color="blue">{'~  '}</Text>
          <Text color="blue">{shareUrl}</Text>
        </Box>
      )}

      {/* Provider info */}
      <Box marginBottom={1}>
        <Text bold color="white">{'@ '}</Text>
        <Text color="gray">anthropic/claude-3.5-sonnet</Text>
      </Box>

      {/* Tool execution events */}
      <Box flexDirection="column" marginBottom={1}>
        {events.map((event, index) => (
          <Box key={index}>
            <Text color={event.color}>{'|'}</Text>
            <Text color="gray" dimColor>{` ${event.tool.padEnd(7, ' ')}`}</Text>
            <Text> {event.title}</Text>
          </Box>
        ))}
      </Box>

      {/* Final response */}
      {isComplete && response && (
        <Box>
          <Text>{response}</Text>
        </Box>
      )}
    </Box>
  )
} 