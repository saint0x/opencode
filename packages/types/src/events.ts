import { z } from 'zod'
import { Session, Message } from './sessions.js'
import { ToolExecution } from './tools.js'

export const BaseEvent = z.object({
  id: z.string(),
  timestamp: z.date(),
  type: z.string(),
})

export type BaseEvent = z.infer<typeof BaseEvent>

// Session Events
export const SessionUpdatedEvent = BaseEvent.extend({
  type: z.literal('session:updated'),
  data: z.object({
    session: Session,
  }),
})

export const SessionCreatedEvent = BaseEvent.extend({
  type: z.literal('session:created'),
  data: z.object({
    session: Session,
  }),
})

// Message Events  
export const MessageUpdatedEvent = BaseEvent.extend({
  type: z.literal('message:updated'),
  data: z.object({
    message: Message,
    sessionId: z.string(),
  }),
})

export const MessageCreatedEvent = BaseEvent.extend({
  type: z.literal('message:created'),
  data: z.object({
    message: Message,
    sessionId: z.string(),
  }),
})

// Tool Events
export const ToolStartedEvent = BaseEvent.extend({
  type: z.literal('tool:started'),
  data: z.object({
    execution: ToolExecution,
    sessionId: z.string(),
    messageId: z.string(),
  }),
})

export const ToolCompletedEvent = BaseEvent.extend({
  type: z.literal('tool:completed'),
  data: z.object({
    execution: ToolExecution,
    sessionId: z.string(),
    messageId: z.string(),
  }),
})

// Union of all events
export const AppEvent = z.union([
  SessionUpdatedEvent,
  SessionCreatedEvent,
  MessageUpdatedEvent,
  MessageCreatedEvent,
  ToolStartedEvent,
  ToolCompletedEvent,
])

export type AppEvent = z.infer<typeof AppEvent>

// WebSocket message wrapper
export const WebSocketMessage = z.object({
  type: z.enum(['event', 'ping', 'pong', 'error']),
  data: z.unknown(),
})

export type WebSocketMessage = z.infer<typeof WebSocketMessage> 