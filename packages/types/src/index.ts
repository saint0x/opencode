// Shared type definitions for OpenCode v2
export * from './sessions.js'
export * from './tools.js'
export * from './providers.js'
export * from './events.js'

// Error handling system
export * from './result.js'
export * from './errors.js'

export interface MessageProps {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  sessionId?: string
  toolCalls?: Array<{
    id: string
    name: string
    title: string
    status: 'pending' | 'running' | 'success' | 'error'
    result?: string
  }>
} 