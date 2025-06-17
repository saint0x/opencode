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
import type { ToolDefinition } from '../tools/registry.js'
import { ExecutionQueue } from '../tools/execution-queue.js'
import { ContextManager } from '../sessions/context.js'
import { realtimeNotifier } from '../realtime/notifier.js'

export interface ToolCall {
  id: string
  name: string
  input: Record<string, any>
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp?: Date
  toolCalls?: ToolCall[]
  toolCallId?: string
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
  chat(
    messages: ChatMessage[],
    options?: { model?: string; tools?: ToolDefinition[] }
  ): Promise<Result<ChatMessage, OpenCodeError>>
}

export class ChatService {
  private providers: Map<string, LLMProvider> = new Map()
  private executionQueue: ExecutionQueue
  private contextManager: ContextManager

  constructor(
    private db: OpenCodeDatabase,
    private toolRegistry: import('../tools/registry.js').ToolRegistry
  ) {
    this.executionQueue = new ExecutionQueue(this.toolRegistry, {
      maxConcurrent: 3,
    })
    this.contextManager = new ContextManager({
      maxTokens: parseInt(process.env.LLM_MAX_CONTEXT_TOKENS || '4096'),
    })
  }

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

      if (!createResult.success) {
        return err(createResult.error)
      }

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
      // 1. Get session
      const sessionResult = await this.getSession(sessionId)
      if (!sessionResult.success) {
        return err(sessionResult.error)
      }
      const session = sessionResult.data

      // 2. Add user message to session and database
      const userMessage: ChatMessage = {
        role: 'user',
        content,
        timestamp: new Date(),
      }
      session.messages.push(userMessage)
      const addUserResult = this.db.addMessage({
        id: `msg_${Date.now()}`,
        session_id: sessionId,
        role: 'user',
        content,
        metadata: JSON.stringify({}),
      })
      if (!addUserResult.success) {
        return err(addUserResult.error)
      }

      // 3. Get LLM provider and tool definitions
      const providerName = provider || session.provider || 'anthropic'
      const llmProvider = this.providers.get(providerName)
      if (!llmProvider) {
        return err(
          systemError(ErrorCode.NOT_FOUND, `LLM provider not found: ${providerName}`)
        )
      }
      const allTools = this.toolRegistry.getToolDefinitions()
      const contextMessages = this.contextManager.buildContext(session.messages)

      // 4. Call LLM with tools
      const llmResult = await llmProvider.chat(contextMessages, {
        model: model || session.model,
        tools: allTools,
      })
      if (!llmResult.success) return llmResult

      // 5. Add assistant message to session and database
      const assistantMessage = llmResult.data
      session.messages.push(assistantMessage)
      const addAssistantResult = this.db.addMessage({
        id: `msg_${Date.now()}`,
        session_id: sessionId,
        role: 'assistant',
        content: assistantMessage.content,
        metadata: JSON.stringify({ toolCalls: assistantMessage.toolCalls || [] }),
      })
      if (!addAssistantResult.success) {
        return err(addAssistantResult.error)
      }
      realtimeNotifier.emit({
        type: 'message.created',
        payload: {
          sessionId,
          message: {
            ...assistantMessage,
            id: 'temp-id-fixme', // The DB doesn't return the ID, needs improvement
            timestamp: assistantMessage.timestamp!.toISOString(),
          },
        },
      })

      // 6. Check for tool calls and queue them for execution
      if (assistantMessage.toolCalls && assistantMessage.toolCalls.length > 0) {
        const executionPromises = assistantMessage.toolCalls.map(toolCall =>
          this.executionQueue.add(
            toolCall.name,
            toolCall.input,
            { workingDirectory: process.cwd(), sessionId: session.id },
            0 // priority
          )
        )

        const executionResults = await Promise.all(executionPromises)

        for (let i = 0; i < executionResults.length; i++) {
          const executionResult = executionResults[i]
          const toolCall = assistantMessage.toolCalls[i]
          const resultMessage: ChatMessage = {
            role: 'tool',
            toolCallId: toolCall.id,
            content: executionResult.success
              ? executionResult.data.output
              : `Error: ${executionResult.error.message}`,
          }
          session.messages.push(resultMessage)
          this.db.addMessage({
            id: `msg_${Date.now()}`,
            session_id: sessionId,
            role: 'assistant',
            content: resultMessage.content,
            metadata: JSON.stringify({
              toolCallId: resultMessage.toolCallId,
              isToolResult: true,
            }),
          })
        }

        // 7. Call LLM again with tool results
        const finalContext = this.contextManager.buildContext(session.messages)
        const finalResult = await llmProvider.chat(finalContext, {
          model: model || session.model,
          tools: allTools,
        })
        if (!finalResult.success) return finalResult

        const finalAssistantMessage = finalResult.data
        session.messages.push(finalAssistantMessage)
        this.db.addMessage({
          id: `msg_${Date.now()}`,
          session_id: sessionId,
          role: 'assistant',
          content: finalAssistantMessage.content,
          metadata: JSON.stringify({}),
        })
        realtimeNotifier.emit({
          type: 'message.created',
          payload: {
            sessionId,
            message: {
              ...finalAssistantMessage,
              id: 'temp-id-fixme2',
              timestamp: finalAssistantMessage.timestamp!.toISOString(),
            },
          },
        })

        return ok(finalAssistantMessage)
      }

      // 8. If no tool calls, just return the first assistant message
      return ok(assistantMessage)
    } catch (error) {
      return err(
        systemError(
          ErrorCode.INTERNAL_ERROR,
          'Failed to send message',
          error as Error
        )
      )
    }
  }

  /**
   * Get a chat session by ID
   */
  async getSession(sessionId: string): Promise<Result<ChatSession, OpenCodeError>> {
    try {
      // Get session from database
      const sessionResult = this.db.getSession(sessionId)
      if (!sessionResult.success) {
        return err(sessionResult.error)
      }

      const sessionRecord = sessionResult.data
      if (!sessionRecord) {
        return err(systemError(
          ErrorCode.SESSION_NOT_FOUND,
          `Session not found: ${sessionId}`
        ))
      }

      // Get messages for session
      const messagesResult = this.db.getSessionMessages(sessionId)
      if (!messagesResult.success) {
        return err(messagesResult.error)
      }

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
      if (!sessionsResult.success) {
        return err(sessionsResult.error)
      }

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