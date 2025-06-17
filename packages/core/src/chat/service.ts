import { 
  Result, 
  ok, 
  err, 
  ErrorCode, 
  systemError,
  type OpenCodeError,
  type MessageProps,
} from '@opencode/types'
import type { OpenCodeDatabase } from '../database/client'
import { getSystemPrompt, getDefaultSystemPrompt, type SystemPromptConfig } from '../prompts'
import type { ToolDefinition, ToolRegistry } from '../tools/registry'
import { ExecutionQueue } from '../tools/execution-queue'
import { ContextManager } from '../sessions/context'
import { realtimeNotifier } from '../realtime/notifier'

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

/**
 * Converts a ChatMessage to a MessageProps for UI display.
 */
function chatMessageToMessageProps(message: ChatMessage, id: string): MessageProps {
  return {
    id,
    role: message.role as 'user' | 'assistant',
    content: message.content,
    timestamp: message.timestamp || new Date(),
    toolCalls: message.toolCalls?.map(tc => ({
      id: tc.id,
      name: tc.name,
      title: `Running ${tc.name}...`,
      status: 'pending',
    }))
  }
}

export class ChatService {
  private providers: Map<string, LLMProvider> = new Map()
  private executionQueue: ExecutionQueue
  private contextManager: ContextManager

  constructor(
    private db: OpenCodeDatabase,
    private toolRegistry: ToolRegistry
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
    model?: string,
    sessionId?: string
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

      const finalSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Create session in database
      const createResult = this.db.createSession({
        id: finalSessionId,
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
        id: finalSessionId,
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
      // 1. Get or create session state
      let session: ChatSession
      const sessionResult = await this.getSession(sessionId)
      if (sessionResult.success && sessionResult.data) {
        session = sessionResult.data
      } else {
        // Create fresh session if not found
        const createResult = await this.createSession('New Session', undefined, provider, model, sessionId)
        if (!createResult.success) return createResult
        session = createResult.data
      }

      // 2. Add user message to session and database
      const userMessage: ChatMessage = {
        role: 'user',
        content,
        timestamp: new Date(),
      }
      session.messages.push(userMessage)
      
      const addUserResult = this.db.addMessage({
        id: `msg_user_${Date.now()}`,
        session_id: sessionId,
        role: 'user',
        content,
        metadata: JSON.stringify({}),
      })
      if (!addUserResult.success) {
        return err(addUserResult.error)
      }

      realtimeNotifier.emit({
        type: 'message.user.new',
        payload: chatMessageToMessageProps(userMessage, addUserResult.data.id),
      })

      return await this.processConversationTurn(session, provider, model)
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
   * Process a conversation turn, handling multiple tool calls if needed
   */
  private async processConversationTurn(
    session: ChatSession,
    provider?: string,
    model?: string
  ): Promise<Result<ChatMessage, OpenCodeError>> {
    const providerName = provider || session.provider || 'anthropic'
    const llmProvider = this.providers.get(providerName)
    if (!llmProvider) {
      return err(
        systemError(ErrorCode.NOT_FOUND, `LLM provider not found: ${providerName}`)
      )
    }

    // Keep calling LLM until we get a response without tool calls (conversation is complete)
    while (true) {
      const allTools = this.toolRegistry.getToolDefinitions()
      const contextMessages = this.contextManager.buildContext(session.messages)

      // Call LLM with current context
      const llmResult = await llmProvider.chat(contextMessages, {
        model: model || session.model,
        tools: allTools,
      })
      if (!llmResult.success) return llmResult

      const assistantMessage = llmResult.data
      session.messages.push(assistantMessage)
      
      // Store assistant message in database
      const addAssistantResult = this.db.addMessage({
        id: `msg_${Date.now()}`,
        session_id: session.id,
        role: 'assistant',
        content: assistantMessage.content,
        metadata: JSON.stringify({ toolCalls: assistantMessage.toolCalls || [] }),
      })
      if (!addAssistantResult.success) {
        return err(addAssistantResult.error)
      }
      
      realtimeNotifier.emit({
        type: 'message.assistant.new',
        payload: chatMessageToMessageProps(assistantMessage, addAssistantResult.data.id),
      })

      // If no tool calls, we're done - return the final response
      if (!assistantMessage.toolCalls || assistantMessage.toolCalls.length === 0) {
        return ok(assistantMessage)
      }

      // Execute tool calls and add results to session
      const executionPromises = assistantMessage.toolCalls.map(toolCall =>
        this.executionQueue.add(
          toolCall.name,
          toolCall.input,
          { workingDirectory: process.cwd(), sessionId: session.id },
          0 // priority
        )
      )

      const executionResults = await Promise.all(executionPromises)

      // Add tool results to session (in memory only for context)
      for (let i = 0; i < executionResults.length; i++) {
        const executionResult = executionResults[i]
        const toolCall = assistantMessage.toolCalls[i]
        const resultMessage: ChatMessage = {
          role: 'tool',
          toolCallId: toolCall.id,
          content: executionResult.success
            ? executionResult.data.output
            : `Error: ${executionResult.error.message}`,
          timestamp: new Date(),
        }
        session.messages.push(resultMessage)
      }

      // Continue the loop to get the next LLM response
      // The LLM will now have access to tool results and can either:
      // 1. Provide a final answer (no more tool calls)
      // 2. Make additional tool calls if needed
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

      const messages: ChatMessage[] = messagesResult.data.map(record => {
        const message: ChatMessage = {
          role: record.role as 'user' | 'assistant' | 'system' | 'tool',
          content: record.content,
          timestamp: new Date(record.created_at)
        }

        // Reconstruct tool calls and tool results from metadata
        try {
          const metadata = JSON.parse(record.metadata)
          if (metadata.toolCalls && Array.isArray(metadata.toolCalls)) {
            message.toolCalls = metadata.toolCalls
          }
          if (metadata.toolCallId) {
            message.toolCallId = metadata.toolCallId
          }
        } catch {
          // Ignore metadata parsing errors
        }

        return message
      })

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