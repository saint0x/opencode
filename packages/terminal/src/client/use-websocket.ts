import { useState, useEffect, useRef, useCallback } from 'react'
import { RealtimeEvent } from '@opencode/types'

const WEBSOCKET_URL = process.env.OPENCODE_WEBSOCKET_URL || 'ws://localhost:3000/ws'

export interface WebSocketOptions {
  sessionId: string
  onOpen?: () => void
  onClose?: () => void
  onError?: (error: Event) => void
  onMessage?: (event: RealtimeEvent) => void
}

export interface WebSocketApi {
  sendMessage: (message: any) => void
  isConnected: boolean
}

export function useWebSocket({
  sessionId,
  onOpen,
  onClose,
  onError,
  onMessage,
}: WebSocketOptions): WebSocketApi {
  const [isConnected, setIsConnected] = useState(false)
  const ws = useRef<WebSocket | null>(null)
  const callbacksRef = useRef({ onOpen, onClose, onError, onMessage })

  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = { onOpen, onClose, onError, onMessage }
  }, [onOpen, onClose, onError, onMessage])

  useEffect(() => {
    if (!sessionId) return

    // Only create connection if we don't already have one
    if (ws.current?.readyState === WebSocket.CONNECTING || ws.current?.readyState === WebSocket.OPEN) {
      return
    }

    try {
      const wsUrl = `${WEBSOCKET_URL}?sessionId=${sessionId}`
      const socket = new WebSocket(wsUrl)
      ws.current = socket

      socket.onopen = () => {
        setIsConnected(true)
        callbacksRef.current.onOpen?.()
      }

      socket.onclose = (event) => {
        setIsConnected(false)
        ws.current = null
        callbacksRef.current.onClose?.()
      }

      socket.onerror = (error) => {
        callbacksRef.current.onError?.(error)
      }

      socket.onmessage = (event) => {
        try {
          const parsed: RealtimeEvent = JSON.parse(event.data)
          callbacksRef.current.onMessage?.(parsed)
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e)
        }
      }
    } catch (error) {
      // Silently fail - connection will be retried
    }

    return () => {
      if (ws.current) {
        ws.current.close(1000) // Normal closure
        ws.current = null
      }
    }
  }, [sessionId]) // Only depend on sessionId, not the callbacks

  const sendMessage = useCallback((message: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message))
    } else {
      console.error('WebSocket is not connected.')
    }
  }, [])

  return { isConnected, sendMessage }
} 