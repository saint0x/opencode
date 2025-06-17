import { z } from 'zod'

export const Session = z.object({
  id: z.string(),
  title: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
  parent_id: z.string().optional(),
  metadata: z.object({
    total_cost: z.number().default(0),
    message_count: z.number().default(0),
    provider_usage: z.record(z.number()).default({}),
  }),
})

export type Session = z.infer<typeof Session>

export const MessagePart = z.union([
  z.object({
    type: z.literal('text'),
    text: z.string(),
  }),
  z.object({
    type: z.literal('tool-invocation'),
    toolInvocation: z.object({
      toolCallId: z.string(),
      toolName: z.string(),
      args: z.unknown(),
      state: z.enum(['call', 'result']),
      result: z.unknown().optional(),
    }),
  }),
])

export type MessagePart = z.infer<typeof MessagePart>

export const TokenUsage = z.object({
  input: z.number().default(0),
  output: z.number().default(0),
  reasoning: z.number().default(0),
  cache: z.object({
    read: z.number().default(0),
    write: z.number().default(0),
  }).default({ read: 0, write: 0 }),
})

export type TokenUsage = z.infer<typeof TokenUsage>

export const Message = z.object({
  id: z.string(),
  session_id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.array(MessagePart),
  metadata: z.object({
    timestamp: z.date(),
    provider: z.string().optional(),
    model: z.string().optional(),
    cost: z.number().optional(),
    tokens: TokenUsage.optional(),
    tools_used: z.array(z.string()).optional(),
    error: z.unknown().optional(),
  }),
})

export type Message = z.infer<typeof Message>

export const ToolCallPropsSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['pending', 'running', 'success', 'error']),
  title: z.string(),
  result: z.string().optional(),
})

export type ToolCallProps = z.infer<typeof ToolCallPropsSchema>

export const MessagePropsSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.date(),
  toolCalls: z.array(ToolCallPropsSchema).optional(),
})

export type MessageProps = z.infer<typeof MessagePropsSchema> 