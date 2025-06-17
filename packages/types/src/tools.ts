import { z } from 'zod'

export const ToolContext = z.object({
  sessionID: z.string(),
  messageID: z.string(),
  abort: z.any(), // AbortSignal
})

export type ToolContext = z.infer<typeof ToolContext>

export const ToolMetadata = z.object({
  title: z.string(),
  preview: z.string().optional(),
  error: z.boolean().optional(),
  message: z.string().optional(),
  time: z.object({
    start: z.number(),
    end: z.number(),
  }).optional(),
}).catchall(z.unknown())

export type ToolMetadata = z.infer<typeof ToolMetadata>

export const ToolResult = z.object({
  output: z.string(),
  metadata: ToolMetadata,
})

export type ToolResult = z.infer<typeof ToolResult>

export const ToolExecution = z.object({
  id: z.string(),
  message_id: z.string(),
  tool_name: z.string(),
  parameters: z.record(z.unknown()),
  result: z.object({
    output: z.string(),
    metadata: z.record(z.unknown()),
    error: z.string().optional(),
  }),
  timing: z.object({
    started_at: z.date(),
    completed_at: z.date(),
    duration_ms: z.number(),
  }),
})

export type ToolExecution = z.infer<typeof ToolExecution>

// Tool operation result pattern (renamed to avoid conflict with main Result type)
export type ToolOperationResult<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E } 