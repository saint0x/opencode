import React, { useState, useCallback, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Layout, StatusBar } from './components/common/layout.js'
import { CompactHeader } from './components/common/banner.js'
import { ChatHistory } from './components/chat/history.js'
import { ChatInput } from './components/chat/input.js'
import { MessageProps } from './components/chat/message.js'
import { useWebSocket } from './client/use-websocket.js'
import type { RealtimeEvent } from '@opencode/types'

// Simple in-memory session management for the client
let currentSessionId = uuidv4()

interface AppState {
  messages: MessageProps[]
  isLoading: boolean
  status: string
}

export function App() {
  const [state, setState] = useState<AppState>({
    messages: [],
    isLoading: false,
    status: 'Connecting...',
  })

  const handleRealtimeEvent = useCallback((event: RealtimeEvent) => {
    switch (event.type) {
      case 'message.user.new':
      case 'message.assistant.new':
        setState(prev => ({
          ...prev,
          messages: [...prev.messages, event.payload],
          isLoading: event.type === 'message.user.new',
          status: event.type === 'message.user.new' ? 'Assistant is thinking...' : 'Ready',
        }))
        break
      case 'tool.status':
        // TODO: Implement a more sophisticated tool status display
        setState(prev => ({ ...prev, status: `Tool status: ${event.payload.status}` }))
        break
    }
  }, [])

  const { isConnected, sendMessage } = useWebSocket({
    sessionId: currentSessionId,
    onOpen: () => {
      setState(prev => ({ ...prev, status: 'Connected' }))
    },
    onClose: () => {
      setState(prev => ({ ...prev, status: 'Disconnected' }))
    },
    onError: (error) => {
      setState(prev => ({ ...prev, status: 'Connection failed' }))
    },
    onMessage: handleRealtimeEvent,
  })

  const handleSendMessage = useCallback(
    (content: string) => {
      if (!isConnected) {
        return
      }
      
      // Set loading state immediately for better UX
      setState(prev => ({
        ...prev,
        isLoading: true,
        status: 'Assistant is thinking...'
      }))
      
      // Send message via WebSocket
      sendMessage({
        type: 'chat.message.send',
        payload: {
          sessionId: currentSessionId,
          content,
        },
      })
    },
    [isConnected, sendMessage]
  )

  return (
    <Layout
      header={<CompactHeader />}
      footer={<StatusBar status={state.status} session={currentSessionId} />}
    >
      <ChatHistory messages={state.messages} isLoading={state.isLoading} />
      <ChatInput
        onSubmit={handleSendMessage}
        disabled={!isConnected || state.isLoading}
        placeholder={
          isConnected ? 'Ask me to help with your code...' : 'Connecting...'
        }
      />
    </Layout>
  )
} 