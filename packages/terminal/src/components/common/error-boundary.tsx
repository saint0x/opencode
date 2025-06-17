import React, { Component, ReactNode, ErrorInfo } from 'react'
import { Box, Text } from 'ink'
import { OpenCodeError, ErrorCode, createError, getUserMessage, getRecoverySuggestion } from '@opencode/types'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: OpenCodeError) => ReactNode
  onError?: (error: OpenCodeError, errorInfo: ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: OpenCodeError | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const openCodeError = createError(
      ErrorCode.INTERNAL_ERROR,
      error.message || 'An unexpected error occurred',
      { cause: error, recoverable: true }
    )

    return {
      hasError: true,
      error: openCodeError,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const openCodeError = this.state.error
    if (openCodeError && this.props.onError) {
      this.props.onError(openCodeError, errorInfo)
    }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error)
      }
      return <DefaultErrorDisplay error={this.state.error} />
    }

    return this.props.children
  }
}

function DefaultErrorDisplay({ error }: { error: OpenCodeError }) {
  const userMessage = getUserMessage(error)
  const suggestion = getRecoverySuggestion(error)

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text color="red" bold>⚠️ Error: {error.code}</Text>
      </Box>
      
      <Box marginBottom={1}>
        <Text>{userMessage}</Text>
      </Box>

      {suggestion && (
        <Box marginBottom={1}>
          <Text color="yellow">💡 Suggestion: {suggestion}</Text>
        </Box>
      )}

      <Box>
        <Text color="gray" dimColor>
          Press Ctrl+C to exit or fix the issue and try again
        </Text>
      </Box>
    </Box>
  )
}

// Tool-specific error boundary
export function ToolErrorBoundary({ children, toolName }: { children: ReactNode; toolName: string }) {
  const handleError = (error: OpenCodeError, errorInfo: ErrorInfo) => {
    console.error(`Tool ${toolName} failed:`, error)
    console.error('Error Info:', errorInfo)
  }

  const fallback = (error: OpenCodeError) => (
    <Box>
      <Text color="red">✗ {toolName} failed: {getUserMessage(error)}</Text>
    </Box>
  )

  return (
    <ErrorBoundary onError={handleError} fallback={fallback}>
      {children}
    </ErrorBoundary>
  )
}

// CLI command error boundary
export function CLIErrorBoundary({ children }: { children: ReactNode }) {
  const handleError = (error: OpenCodeError, errorInfo: ErrorInfo) => {
    console.error('CLI Command failed:', error)
    console.error('Stack trace:', errorInfo.componentStack)
  }

  return (
    <ErrorBoundary onError={handleError}>
      {children}
    </ErrorBoundary>
  )
} 