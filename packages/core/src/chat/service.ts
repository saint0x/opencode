import { 
  Result, 
  ok, 
  err, 
  ErrorCode, 
  systemError,
  type OpenCodeError 
} from '@opencode/types'
import type { OpenCodeDatabase } from '../database/client.js'
import { getSystemPrompt, getDefaultSystemPrompt, type SystemPromptConfig } from '../prompts/index.js'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: Date
}

export interface ChatSession {
  id: string
  title: string
  systemPrompt: SystemPromptConfig
  messages: ChatMessage[]
  provider?: string
  model?: string
}

export interface LLMProvider {
  name: string
  models: string[]
  chat(messages: ChatMessage[], model?: string): Promise<Result<ChatMessage, OpenCodeError>>
}

export class ChatService {
  private providers: Map<string, LLMProvider> = new Map()

  constructor(private db: OpenCodeDatabase) {}

  /**
   * Register an LLM provider
   */
  registerProvider(provider: LLMProvider): void {
    this.providers.set(provider.name, provider)
  }

  /**
   * Get a registered provider by name
   */
  getProvider(name: string): LLMProvider | undefined {
    return this.providers.get(name)
  }

  /**
   * Get all registered providers
   */
  getProviders(): LLMProvider[] {
    return Array.from(this.providers.values())
  }

  /**
   * Create a new chat session with optional system prompt
   */
  async createSession(
    title: string,
    systemPromptId?: string,
    provider?: string,
    model?: string
  ): Promise<Result<ChatSession, OpenCodeError>> {
    try {
      // Get system prompt (default if none specified)
      const systemPrompt = systemPromptId 
        ? getSystemPrompt(systemPromptId) 
        : getDefaultSystemPrompt()

      if (!systemPrompt) {
        return err(systemError(
          ErrorCode.NOT_FOUND,
          `System prompt not found: ${systemPromptId}`
        ))
      }

      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Create session in database
      const createResult = this.db.createSession({
        id: sessionId,
        title,
        provider,
        model,
        system_prompt: systemPrompt.content,
        metadata: JSON.stringify({
          system_prompt_id: systemPrompt.id,
          created_with_prompt: systemPrompt.name
        }),
        status: 'active'
      })

      if (!createResult.success) return createResult

      const session: ChatSession = {
        id: sessionId,
        title,
        systemPrompt,
        messages: [
          {
            role: 'system',
            content: systemPrompt.content,
            timestamp: new Date()
          }
        ],
        provider,
        model
      }

      return ok(session)
    } catch (error) {
      return err(systemError(
        ErrorCode.INTERNAL_ERROR,
        'Failed to create chat session',
        error as Error
      ))
    }
  }

  /**
   * Send a message to a chat session
   */
  async sendMessage(
    sessionId: string,
    content: string,
    provider?: string,
    model?: string
  ): Promise<Result<ChatMessage, OpenCodeError>> {
    try {
      // Get session
      const sessionResult = await this.getSession(sessionId)
      if (!sessionResult.success) return sessionResult

      const session = sessionResult.data

      // Add user message
      const userMessage: ChatMessage = {
        role: 'user',
        content,
        timestamp: new Date()
      }

      // Store user message in database
      const userMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const addUserResult = this.db.addMessage({
        id: userMessageId,
        session_id: sessionId,
        role: 'user',
        content,
        metadata: JSON.stringify({})
      })

      if (!addUserResult.success) return addUserResult

      session.messages.push(userMessage)

      // Get LLM provider
      const providerName = provider || session.provider || 'anthropic'
      const llmProvider = this.providers.get(providerName)
      
      if (!llmProvider) {
        return err(systemError(
          ErrorCode.NOT_FOUND,
          `LLM provider not found: ${providerName}`
        ))
      }

      // Call LLM
      const llmResult = await llmProvider.chat(session.messages, model || session.model)
      if (!llmResult.success) return llmResult

      const assistantMessage = llmResult.data

      // Store assistant message in database
      const assistantMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const addAssistantResult = this.db.addMessage({
        id: assistantMessageId,
        session_id: sessionId,
        role: 'assistant',
        content: assistantMessage.content,
        provider: providerName,
        model: model || session.model,
        metadata: JSON.stringify({})
      })

      if (!addAssistantResult.success) return addAssistantResult

      return ok(assistantMessage)
    } catch (error) {
      return err(systemError(
        ErrorCode.INTERNAL_ERROR,
        'Failed to send message',
        error as Error
      ))
    }
  }

  /**
   * Get a chat session by ID
   */
  async getSession(sessionId: string): Promise<Result<ChatSession, OpenCodeError>> {
    try {
      // Get session from database
      const sessionResult = this.db.getSession(sessionId)
      if (!sessionResult.success) return sessionResult

      const sessionRecord = sessionResult.data
      if (!sessionRecord) {
        return err(systemError(
          ErrorCode.SESSION_NOT_FOUND,
          `Session not found: ${sessionId}`
        ))
      }

      // Get messages for session
      const messagesResult = this.db.getSessionMessages(sessionId)
      if (!messagesResult.success) return messagesResult

      // Get system prompt from session metadata
      let systemPrompt = getDefaultSystemPrompt()
      try {
        const metadata = JSON.parse(sessionRecord.metadata)
        if (metadata.system_prompt_id) {
          const prompt = getSystemPrompt(metadata.system_prompt_id)
          if (prompt) systemPrompt = prompt
        }
      } catch {
        // Use default if metadata parsing fails
      }

      const messages: ChatMessage[] = messagesResult.data.map(record => ({
        role: record.role as 'user' | 'assistant' | 'system',
        content: record.content,
        timestamp: new Date(record.created_at)
      }))

      // Ensure system message is first
      if (messages.length === 0 || messages[0].role !== 'system') {
        messages.unshift({
          role: 'system',
          content: sessionRecord.system_prompt || systemPrompt.content,
          timestamp: new Date(sessionRecord.created_at)
        })
      }

      const session: ChatSession = {
        id: sessionRecord.id,
        title: sessionRecord.title,
        systemPrompt,
        messages,
        provider: sessionRecord.provider || undefined,
        model: sessionRecord.model || undefined
      }

      return ok(session)
    } catch (error) {
      return err(systemError(
        ErrorCode.INTERNAL_ERROR,
        'Failed to get session',
        error as Error
      ))
    }
  }

  /**
   * Update system prompt for a session
   */
  async updateSessionSystemPrompt(
    sessionId: string,
    systemPromptId: string
  ): Promise<Result<void, OpenCodeError>> {
    try {
      const systemPrompt = getSystemPrompt(systemPromptId)
      if (!systemPrompt) {
        return err(systemError(
          ErrorCode.NOT_FOUND,
          `System prompt not found: ${systemPromptId}`
        ))
      }

      // Update session in database
      const updateResult = this.db.updateSession(sessionId, {
        system_prompt: systemPrompt.content,
        metadata: JSON.stringify({
          system_prompt_id: systemPrompt.id,
          system_prompt_name: systemPrompt.name
        })
      })

      return updateResult
    } catch (error) {
      return err(systemError(
        ErrorCode.INTERNAL_ERROR,
        'Failed to update session system prompt',
        error as Error
      ))
    }
  }

  /**
   * List all chat sessions
   */
  async listSessions(limit = 50, offset = 0): Promise<Result<ChatSession[], OpenCodeError>> {
    try {
      const sessionsResult = this.db.listSessions(limit, offset)
      if (!sessionsResult.success) return sessionsResult

      const sessions: ChatSession[] = []

      for (const record of sessionsResult.data) {
        // Get system prompt from metadata
        let systemPrompt = getDefaultSystemPrompt()
        try {
          const metadata = JSON.parse(record.metadata)
          if (metadata.system_prompt_id) {
            const prompt = getSystemPrompt(metadata.system_prompt_id)
            if (prompt) systemPrompt = prompt
          }
        } catch {
          // Use default if metadata parsing fails
        }

        sessions.push({
          id: record.id,
          title: record.title,
          systemPrompt,
          messages: [], // Empty for list view - load separately if needed
          provider: record.provider || undefined,
          model: record.model || undefined
        })
      }

      return ok(sessions)
    } catch (error) {
      return err(systemError(
        ErrorCode.INTERNAL_ERROR,
        'Failed to list sessions',
        error as Error
      ))
    }
  }
} 