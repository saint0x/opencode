import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { HTTPException } from 'hono/http-exception'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'http'

import { createDatabase, OpenCodeDatabase } from '../database/client.js'
import { ChatService } from '../chat/service.js'
import { createAnthropicProvider } from '../providers/anthropic.js'
import { SystemPromptService } from '../prompts/service.js'
import { initializeTools } from '../tools/init.js'
import { realtimeNotifier } from '../realtime/notifier.js'
import type { RealtimeEvent } from '@opencode/types'

export class OpenCodeServer {
  private app: Hono
  private db: OpenCodeDatabase
  private chatService: ChatService
  private promptService: SystemPromptService
  private wss: WebSocketServer
  private subscriptions: Map<string, Set<WebSocket>> = new Map()

  constructor(private port: number) {
    // ...
  }

  start() {
    const server = serve(
      {
        fetch: this.app.fetch,
        port: this.port,
      },
      (info: any) => {
        console.log(`🚀 Server listening on http://localhost:${info.port}`)
        this.setupWebSocketServer(info.server)
      }
    )
  }

  private setupWebSocketServer(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' })
    console.log('🔌 WebSocket server initialized at /ws')

    this.wss.on('connection', (ws, req) => {
      const url = new URL(req.url!, `http://${req.headers.host}`)
      const sessionId = url.searchParams.get('sessionId')

      if (!sessionId) {
        console.warn('WebSocket connection attempt without sessionId. Closing.')
        ws.close(1008, 'Session ID is required')
        return
      }

      this.subscribe(sessionId, ws)

      ws.on('message', message => {
        console.log(`Received ws message for ${sessionId}: ${message}`)
        // Handle incoming messages from client if needed in the future
      })

      ws.on('close', () => {
        this.unsubscribe(sessionId, ws)
      })

      ws.on('error', error => {
        console.error(`WebSocket error for session ${sessionId}:`, error)
        this.unsubscribe(sessionId, ws)
      })
    })

    // Listen to our global notifier and broadcast events
    realtimeNotifier.on('event', this.handleRealtimeEvent.bind(this))
  }

  private subscribe(sessionId: string, ws: WebSocket) {
    if (!this.subscriptions.has(sessionId)) {
      this.subscriptions.set(sessionId, new Set())
    }
    this.subscriptions.get(sessionId)!.add(ws)
    console.log(`Client subscribed to session ${sessionId}`)
  }

  private unsubscribe(sessionId: string, ws: WebSocket) {
    const sessionSockets = this.subscriptions.get(sessionId)
    if (sessionSockets) {
      sessionSockets.delete(ws)
      if (sessionSockets.size === 0) {
        this.subscriptions.delete(sessionId)
      }
    }
    console.log(`Client unsubscribed from session ${sessionId}`)
  }

  private handleRealtimeEvent(event: RealtimeEvent) {
    const sessionId = (event.payload as any).sessionId
    if (sessionId && this.subscriptions.has(sessionId)) {
      const payload = JSON.stringify(event)
      this.subscriptions.get(sessionId)!.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload)
        }
      })
    }
  }

  private setupRoutes() {
    // ... (existing routes)
  }

  // ... (rest of the class)
} 