import { z } from 'zod'
import { TokenUsage } from './sessions.js'

export const ModelCapabilities = z.object({
  name: z.string(),
  attachment: z.boolean().default(false),
  reasoning: z.boolean().default(false), 
  temperature: z.boolean().default(true),
  streaming: z.boolean().default(true),
  function_calling: z.boolean().default(true),
})

export type ModelCapabilities = z.infer<typeof ModelCapabilities>

export const ModelCost = z.object({
  input: z.number(),
  output: z.number(),
  inputCached: z.number().default(0),
  outputCached: z.number().default(0),
})

export type ModelCost = z.infer<typeof ModelCost>

export const ModelLimits = z.object({
  context: z.number(),
  output: z.number().optional(),
})

export type ModelLimits = z.infer<typeof ModelLimits>

export const ModelInfo = z.object({
  id: z.string(),
  name: z.string(),
  capabilities: ModelCapabilities,
  cost: ModelCost,
  limits: ModelLimits,
})

export type ModelInfo = z.infer<typeof ModelInfo>

export const ProviderCredentials = z.union([
  z.object({
    type: z.literal('api'),
    key: z.string(),
  }),
  z.object({
    type: z.literal('oauth'),
    accessToken: z.string(),
    refreshToken: z.string().optional(),
    expiresAt: z.date().optional(),
  }),
])

export type ProviderCredentials = z.infer<typeof ProviderCredentials>

export const ProviderConfig = z.object({
  id: z.string(),
  name: z.string(),
  baseUrl: z.string().optional(),
  models: z.array(ModelInfo),
  credentials: ProviderCredentials.optional(),
})

export type ProviderConfig = z.infer<typeof ProviderConfig>

export const UsageMetrics = z.object({
  cost: z.number(),
  tokens: TokenUsage,
  requests: z.number().default(1),
  timestamp: z.date(),
})

export type UsageMetrics = z.infer<typeof UsageMetrics> 