import { z } from 'zod'
import { Session, Message, MessagePropsSchema } from './sessions'
import { ToolExecution } from './tools'

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

export const MessageUserNewEvent = z.object({
  type: z.literal('message.user.new'),
  payload: MessagePropsSchema
})

export const MessageAssistantNewEvent = z.object({
  type: z.literal('message.assistant.new'),
  payload: MessagePropsSchema
})

export const ToolStatusEvent = z.object({
  type: z.literal('tool.status'),
  payload: z.object({
    toolCallId: z.string(),
    status: z.string(),
    message: z.string().optional(),
  })
})

export const RealtimeEventSchema = z.union([
  MessageUserNewEvent,
  MessageAssistantNewEvent,
  ToolStatusEvent
  // Add other events here as they are implemented
])

export type RealtimeEvent = z.infer<typeof RealtimeEventSchema> 