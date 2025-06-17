import { 
  Result, 
  ok, 
  err, 
  ErrorCode, 
  systemError,
  type OpenCodeError 
} from '@opencode/types'
import type { LLMProvider, ChatMessage, ToolCall } from '../chat/service.js'
import type { ToolDefinition } from '../tools/registry.js'

export interface AnthropicConfig {
  apiKey: string
  baseUrl?: string
  defaultModel?: string
  maxTokens?: number
  enableCache?: boolean
  cacheSystemPrompts?: boolean
  cacheToolDefinitions?: boolean
}

export class AnthropicProvider implements LLMProvider {
  name = 'anthropic'
  models = [
    'claude-sonnet-4-20250514',
    'claude-opus-4-20250514', 
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022', 
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307'
  ]

  private config: AnthropicConfig
  private baseUrl: string
  private systemPromptCache: Map<string, { content: string; timestamp: number }> = new Map()
  private readonly CACHE_TTL = parseInt(process.env.PROVIDER_CACHE_TTL_MINUTES || '5') * 60 * 1000

  constructor(config: AnthropicConfig) {
    this.config = {
      enableCache: true,
      cacheSystemPrompts: true,
      cacheToolDefinitions: true,
      ...config
    }
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com'
  }

  async chat(
    messages: ChatMessage[],
    options?: { model?: string; tools?: ToolDefinition[] }
  ): Promise<Result<ChatMessage, OpenCodeError>> {
    try {
      const selectedModel =
        options?.model || this.config.defaultModel || 'claude-sonnet-4-20250514'

      // Convert messages to Anthropic format
      const { system, messages: anthropicMessages } =
        this.convertMessagesToAnthropicFormat(messages)

      const requestBody: Record<string, any> = {
        model: selectedModel,
        max_tokens:
          this.config.maxTokens ||
          parseInt(process.env.ANTHROPIC_MAX_TOKENS || '4096'),
        messages: anthropicMessages,
        ...(system && { system }),
      }

      if (options?.tools && options.tools.length > 0) {
        requestBody.tools = this.convertToolsToAnthropicFormat(options.tools)
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01'
      }

      // Add prompt caching beta header if caching is enabled
      if (this.config.enableCache) {
        headers['anthropic-beta'] = 'prompt-caching-2024-07-31'
      }

      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorText = await response.text()
        return err(systemError(
          ErrorCode.LLM_API_ERROR,
          `Anthropic API error: ${response.status} ${response.statusText}`,
          new Error(errorText)
        ))
      }

      const data = (await response.json()) as {
        error?: { message: string; type?: string }
        content?: Array<{
          type: 'text' | 'tool_use'
          text?: string
          id?: string
          name?: string
          input?: Record<string, any>
        }>
        usage?: { input_tokens: number; output_tokens: number }
        stop_reason?: 'tool_use' | 'end_turn'
      }

      if (data.error) {
        return err(systemError(
          ErrorCode.LLM_API_ERROR,
          `Anthropic API error: ${data.error.message}`,
          new Error(JSON.stringify(data.error))
        ))
      }

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: '', // Will be populated below
        timestamp: new Date(),
      }

      const textParts: string[] = []
      const toolCalls: ToolCall[] = []

      if (data.content) {
        for (const part of data.content) {
          if (part.type === 'text' && part.text) {
            textParts.push(part.text)
          } else if (
            part.type === 'tool_use' &&
            part.id &&
            part.name &&
            part.input
          ) {
            toolCalls.push({
              id: part.id,
              name: part.name,
              input: part.input,
            })
          }
        }
      }

      assistantMessage.content =
        textParts.join('\n').trim() ||
        (toolCalls.length > 0 ? 'Using tools...' : 'No response content')
      if (toolCalls.length > 0) {
        assistantMessage.toolCalls = toolCalls
      }

      return ok(assistantMessage)
    } catch (error) {
      return err(systemError(
        ErrorCode.LLM_API_ERROR,
        'Failed to call Anthropic API',
        error as Error
      ))
    }
  }

  private convertMessagesToAnthropicFormat(messages: ChatMessage[]): {
    system?:
      | string
      | Array<{ type: string; text: string; cache_control?: { type: 'ephemeral' } }>
    messages: Array<{
      role: 'user' | 'assistant'
      content: any // Can be string or array of parts
    }>
  } {
    const result: {
      system?:
        | string
        | Array<{ type: string; text: string; cache_control?: { type: 'ephemeral' } }>
      messages: Array<{ role: 'user' | 'assistant'; content: any }>
    } = {
      messages: [],
    }

    const regularMessages = []

    for (const message of messages) {
      if (message.role === 'system') {
        result.system = message.content
      } else if (message.role === 'user') {
        regularMessages.push({
          role: message.role,
          content: message.content,
        })
      } else if (message.role === 'assistant') {
        // Convert assistant message with potential tool calls
        const content: any[] = []
        
        // Add text content if present
        if (message.content && message.content.trim()) {
          content.push({
            type: 'text',
            text: message.content,
          })
        }
        
        // Add tool calls if present
        if (message.toolCalls && message.toolCalls.length > 0) {
          for (const toolCall of message.toolCalls) {
            content.push({
              type: 'tool_use',
              id: toolCall.id,
              name: toolCall.name,
              input: toolCall.input,
            })
          }
        }
        
        regularMessages.push({
          role: message.role,
          content: content.length === 1 && content[0].type === 'text' 
            ? content[0].text 
            : content,
        })
      } else if (message.role === 'tool') {
        // Tool results are sent as user messages with tool_result content
        regularMessages.push({
          role: 'user' as const,
          content: [
            {
              type: 'tool_result',
              tool_use_id: message.toolCallId,
              content: message.content,
            },
          ],
        })
      }
    }

    result.messages = regularMessages
    return result
  }

  private convertToolsToAnthropicFormat(tools: ToolDefinition[]) {
    return tools.map(tool => {
      const properties: Record<string, any> = {}
      const required: string[] = []
      for (const param of tool.parameters) {
        properties[param.name] = {
          type: param.type,
          description: param.description,
        }
        if (param.required) {
          required.push(param.name)
        }
      }

      return {
        name: tool.name,
        description: tool.description,
        input_schema: {
          type: 'object',
          properties,
          ...(required.length > 0 && { required }),
        },
      }
    })
  }

  private getSystemPromptHash(messages: ChatMessage[]): string | null {
    const systemMessage = messages.find(m => m.role === 'system')
    if (!systemMessage) return null
    
    // Create a simple hash of the system prompt content
    // In production, you might want to use a proper hash function
    return btoa(systemMessage.content).slice(0, 32)
  }

  /**
   * Clear expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now()
    for (const [key, value] of this.systemPromptCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.systemPromptCache.delete(key)
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hits: number; ttl: number } {
    this.cleanupCache()
    return {
      size: this.systemPromptCache.size,
      hits: 0, // TODO: Track cache hits
      ttl: this.CACHE_TTL
    }
  }

  /**
   * Test the provider connection
   */
  async test(): Promise<Result<boolean, OpenCodeError>> {
    try {
      const testMessage: ChatMessage = {
        role: 'user',
        content: 'Hello, can you respond with just "OK"?'
      }

      const result = await this.chat([testMessage])
      return ok(result.success)
    } catch (error) {
      return err(systemError(
        ErrorCode.LLM_API_ERROR,
        'Provider connection test failed',
        error as Error
      ))
    }
  }
}

/**
 * Create Anthropic provider from environment variables
 */
export function createAnthropicProvider(): Result<AnthropicProvider, OpenCodeError> {
  const apiKey = process.env.ANTHROPIC_API_KEY || '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'
  
  if (!apiKey) {
    return err(systemError(
      ErrorCode.CONFIGURATION_ERROR,
      'ANTHROPIC_API_KEY environment variable is required'
    ))
  }

  const provider = new AnthropicProvider({
    apiKey,
    baseUrl: process.env.ANTHROPIC_BASE_URL,
    defaultModel: 'claude-3-5-sonnet-20241022',
    maxTokens: process.env.ANTHROPIC_MAX_TOKENS ? parseInt(process.env.ANTHROPIC_MAX_TOKENS) : undefined,
    enableCache: process.env.ANTHROPIC_ENABLE_CACHE !== 'false',
    cacheSystemPrompts: process.env.ANTHROPIC_CACHE_SYSTEM_PROMPTS !== 'false',
    cacheToolDefinitions: process.env.ANTHROPIC_CACHE_TOOLS !== 'false'
  })

  return ok(provider)
} 