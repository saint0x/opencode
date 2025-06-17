import React from 'react'
import { Box, Text } from 'ink'
import { Message, MessageProps } from './message.js'

interface ChatHistoryProps {
  messages: MessageProps[]
  isLoading?: boolean
}

export function ChatHistory({ messages, isLoading }: ChatHistoryProps) {
  return (
    <Box flexDirection="column" flexGrow={1}>
      {messages.length === 0 ? (
        <Box justifyContent="center" alignItems="center" flexGrow={1}>
          <Text color="gray" dimColor>
            Start a conversation by typing a message below...
          </Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          {messages.map((message, index) => (
            <Message key={index} {...message} />
          ))}
          
          {isLoading && (
            <Box marginLeft={2} marginY={1}>
              <Text color="yellow">◐ Thinking...</Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
} 