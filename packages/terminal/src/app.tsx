import React, { useState, useCallback, useEffect } from 'react'
import { Layout, StatusBar } from './components/common/layout.js'
import { CompactHeader } from './components/common/banner.js'
import { ChatHistory } from './components/chat/history.js'
import { ChatInput } from './components/chat/input.js'
import { MessageProps } from './components/chat/message.js'

interface AppState {
  messages: MessageProps[]
  isLoading: boolean
  sessionId?: string
  status: string
}

export function App() {
  const [state, setState] = useState<AppState>({
    messages: [],
    isLoading: false,
    status: 'Ready'
  })

  const handleSendMessage = useCallback(async (content: string) => {
    // Add user message
    const userMessage: MessageProps = {
      role: 'user',
      content,
      timestamp: new Date()
    }

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true,
      status: 'Processing...'
    }))

    try {
      // TODO: Connect to core engine
      // For now, simulate response
      await new Promise(resolve => setTimeout(resolve, 1000))

      const assistantMessage: MessageProps = {
        role: 'assistant',
        content: `I received your message: "${content}". OpenCode v2 is being rebuilt - core functionality coming soon!`,
        timestamp: new Date(),
        toolCalls: [
          {
            id: '1',
            name: 'read',
            status: 'success',
            title: 'Reading project files',
            result: 'Found 25 TypeScript files'
          }
        ]
      }

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        isLoading: false,
        status: 'Ready'
      }))

    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        status: 'Error'
      }))
    }
  }, [])

  useEffect(() => {
    // Initialize session
    setState(prev => ({
      ...prev,
      sessionId: generateSessionId(),
      status: 'Connected'
    }))
  }, [])

  return (
    <Layout
      header={<CompactHeader />}
      footer={<StatusBar status={state.status} session={state.sessionId || undefined} />}
    >
      <ChatHistory 
        messages={state.messages} 
        isLoading={state.isLoading}
      />
      
      <ChatInput 
        onSubmit={handleSendMessage}
        disabled={state.isLoading}
        placeholder="Ask me to help with your code..."
      />
    </Layout>
  )
}

function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 15)
} 