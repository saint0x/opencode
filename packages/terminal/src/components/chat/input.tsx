import React, { useState, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'

interface ChatInputProps {
  onSubmit: (message: string) => void
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({ onSubmit, disabled = false, placeholder = "Ask me to help with your code..." }: ChatInputProps) {
  const [input, setInput] = useState('')

  const handleSubmit = useCallback(() => {
    if (input.trim() && !disabled) {
      onSubmit(input.trim())
      setInput('')
    }
  }, [input, onSubmit, disabled])

  useInput((input, key) => {
    if (disabled) return

    if (key.return) {
      handleSubmit()
    } else if (key.backspace || key.delete) {
      setInput(prev => prev.slice(0, -1))
    } else if (key.ctrl && input === 'c') {
      process.exit(0)
    } else if (input.length === 1 && !key.ctrl && !key.meta) {
      setInput(prev => prev + input)
    }
  })

  return (
    <Box flexDirection="column">
      <Box key="input-separator">
        <Text color="gray">─────────────────────────────────────────────────────────</Text>
      </Box>
      
      <Box key="input-line" paddingY={1}>
        <Text bold color="green">{'> '}</Text>
        <Text>
          {input || (
            <Text color="gray" dimColor>{placeholder}</Text>
          )}
          {!disabled && <Text inverse> </Text>}
        </Text>
      </Box>

      {disabled && (
        <Box key="processing-message">
          <Text color="yellow" dimColor>Processing... Press Ctrl+C to cancel</Text>
        </Box>
      )}

      <Box key="help-text">
        <Text color="gray" dimColor>
          Press Enter to send • Ctrl+C to exit • Run with: code
        </Text>
      </Box>
    </Box>
  )
} 