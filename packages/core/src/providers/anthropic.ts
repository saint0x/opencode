import { 
  Result, 
  ok, 
  err, 
  ErrorCode, 
  systemError,
  type OpenCodeError 
} from '@opencode/types'
import type { LLMProvider, ChatMessage } from '../chat/service.js'

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

  async chat(messages: ChatMessage[], model?: string): Promise<Result<ChatMessage, OpenCodeError>> {
    try {
      const selectedModel = model || this.config.defaultModel || 'claude-3-5-sonnet-20241022'

      // Check local cache for identical system prompt
      const systemPromptHash = this.getSystemPromptHash(messages)
      if (systemPromptHash && this.config.cacheSystemPrompts) {
        const cached = this.systemPromptCache.get(systemPromptHash)
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
          // Use cached system prompt indicator for Anthropic's cache
        }
      }

      // Convert messages to Anthropic format with caching
      const anthropicMessages = this.convertMessagesWithCache(messages)
      
      const requestBody = {
        model: selectedModel,
        max_tokens: this.config.maxTokens || parseInt(process.env.ANTHROPIC_MAX_TOKENS || '4096'),
        messages: anthropicMessages.messages,
        ...(anthropicMessages.system && { system: anthropicMessages.system })
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

      const data = await response.json()
      
      if (data.error) {
        return err(systemError(
          ErrorCode.LLM_API_ERROR,
          `Anthropic API error: ${data.error.message}`,
          new Error(JSON.stringify(data.error))
        ))
      }

      // Extract content from response
      const content = data.content?.[0]?.text || data.content || 'No response content'
      
      // Cache system prompt if successful and caching is enabled
      if (systemPromptHash && this.config.cacheSystemPrompts) {
        const systemMessage = messages.find(m => m.role === 'system')
        if (systemMessage) {
          this.systemPromptCache.set(systemPromptHash, {
            content: systemMessage.content,
            timestamp: Date.now()
          })
        }
      }
      
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content,
        timestamp: new Date()
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

  private convertMessagesWithCache(messages: ChatMessage[]): {
    system?: string | Array<{ type: string, text: string, cache_control?: { type: string } }>
    messages: Array<{ role: 'user' | 'assistant', content: string }>
  } {
    const result: {
      system?: string | Array<{ type: string, text: string, cache_control?: { type: string } }>
      messages: Array<{ role: 'user' | 'assistant', content: string }>
    } = {
      messages: []
    }

    for (const message of messages) {
      if (message.role === 'system') {
        // For caching, use the array format with cache_control
        if (this.config.enableCache && this.config.cacheSystemPrompts) {
          result.system = [{
            type: 'text',
            text: message.content,
            cache_control: { type: 'ephemeral' }
          }]
        } else {
          // Use simple string format when caching is disabled
          result.system = message.content
        }
      } else if (message.role === 'user' || message.role === 'assistant') {
        result.messages.push({
          role: message.role,
          content: message.content
        })
      }
    }

    return result
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
  const apiKey = process.env.ANTHROPIC_API_KEY
  
  if (!apiKey) {
    return err(systemError(
      ErrorCode.CONFIGURATION_ERROR,
      'ANTHROPIC_API_KEY environment variable is required'
    ))
  }

  const provider = new AnthropicProvider({
    apiKey,
    baseUrl: process.env.ANTHROPIC_BASE_URL,
    defaultModel: process.env.ANTHROPIC_DEFAULT_MODEL,
    maxTokens: process.env.ANTHROPIC_MAX_TOKENS ? parseInt(process.env.ANTHROPIC_MAX_TOKENS) : undefined,
    enableCache: process.env.ANTHROPIC_ENABLE_CACHE !== 'false',
    cacheSystemPrompts: process.env.ANTHROPIC_CACHE_SYSTEM_PROMPTS !== 'false',
    cacheToolDefinitions: process.env.ANTHROPIC_CACHE_TOOLS !== 'false'
  })

  return ok(provider)
} 