import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { HTTPException } from 'hono/http-exception'
import { 
  Result, 
  ok, 
  err, 
  ErrorCode, 
  systemError,
  isOk,
  type OpenCodeError 
} from '@opencode/types'
import { OpenCodeDatabase, createDatabase, type DatabaseConfig } from '../database/client.js'
import { ChatService, type ChatMessage, type LLMProvider } from '../chat/service.js'
import { 
  getAllSystemPrompts, 
  getSystemPrompt, 
  getSystemPromptsByCategory,
  createCustomSystemPrompt,
  type SystemPromptConfig 
} from '../prompts/index.js'
import { systemPromptCache } from '../prompts/cache.js'

export interface ServerConfig {
  port: number
  database: DatabaseConfig
  cors?: {
    origin?: string | string[]
    allowMethods?: string[]
  }
}

export class OpenCodeServer {
  private app: Hono
  private db: OpenCodeDatabase
  private chatService: ChatService
  private config: ServerConfig

  constructor(config: ServerConfig) {
    this.config = config
    this.app = new Hono()
    
    // Initialize database
    const dbResult = createDatabase(config.database)
    if (!isOk(dbResult)) {
      throw new Error(`Failed to create database: ${dbResult.error.message}`)
    }
    this.db = dbResult.data
    
    // Initialize chat service
    this.chatService = new ChatService(this.db)
    
    this.setupMiddleware()
    this.setupRoutes()
  }

  private setupMiddleware() {
    // CORS
    this.app.use('*', cors({
      origin: this.config.cors?.origin || '*',
      allowMethods: this.config.cors?.allowMethods || ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization']
    }))

    // Logging (if enabled)
    if (process.env.ENABLE_REQUEST_LOGGING !== 'false') {
      this.app.use('*', logger())
    }

    // Pretty JSON (if enabled)
    if (process.env.ENABLE_PRETTY_JSON !== 'false') {
      this.app.use('*', prettyJSON())
    }

    // Error handling
    this.app.onError((err, c) => {
      if (err instanceof HTTPException) {
        return err.getResponse()
      }
      
      console.error('Server error:', err)
      return c.json({ 
        error: 'Internal server error',
        message: err.message 
      }, 500)
    })
  }

  private setupRoutes() {
    // Health check
    this.app.get('/health', async (c) => {
      const healthResult = this.db.healthCheck()
      if (!isOk(healthResult)) {
        return c.json({ status: 'unhealthy', error: healthResult.error.message }, 500)
      }
      
      return c.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        database: healthResult.data
      })
    })

    // System Prompts API
    this.setupSystemPromptRoutes()
    
    // Chat API
    this.setupChatRoutes()
    
    // Sessions API
    this.setupSessionRoutes()
    
    // Tools API
    this.setupToolRoutes()
    
    // Provider stats API
    this.setupProviderRoutes()
  }

  private setupSystemPromptRoutes() {
    const prompts = this.app.basePath('/api/prompts')

    // Get all system prompts
    prompts.get('/', (c) => {
      const prompts = getAllSystemPrompts()
      return c.json({ prompts })
    })

    // Get system prompt by ID
    prompts.get('/:id', (c) => {
      const id = c.req.param('id')
      const prompt = getSystemPrompt(id)
      
      if (!prompt) {
        return c.json({ error: 'System prompt not found' }, 404)
      }
      
      return c.json({ prompt })
    })

    // Get system prompts by category
    prompts.get('/category/:category', (c) => {
      const category = c.req.param('category') as SystemPromptConfig['category']
      const prompts = getSystemPromptsByCategory(category)
      return c.json({ prompts })
    })

    // Create custom system prompt
    prompts.post('/custom', async (c) => {
      try {
        const body = await c.req.json()
        const { name, description, content, category = 'coding' } = body
        
        if (!name || !description || !content) {
          return c.json({ 
            error: 'Missing required fields: name, description, content' 
          }, 400)
        }
        
        const prompt = createCustomSystemPrompt(name, description, content, category)
        return c.json({ prompt }, 201)
      } catch (error) {
        return c.json({ error: 'Invalid JSON body' }, 400)
      }
    })

    // Get prompt cache statistics
    prompts.get('/cache/stats', (c) => {
      const stats = systemPromptCache.getStats()
      return c.json({ cache: stats })
    })

    // Clear prompt cache
    prompts.delete('/cache', (c) => {
      systemPromptCache.clear()
      return c.json({ success: true, message: 'Cache cleared' })
    })

    // Cleanup expired cache entries
    prompts.post('/cache/cleanup', (c) => {
      const removed = systemPromptCache.cleanup()
      return c.json({ success: true, removed })
    })
  }

  private setupChatRoutes() {
    const chat = this.app.basePath('/api/chat')

    // Send message to a session
    chat.post('/sessions/:sessionId/messages', async (c) => {
      try {
        const sessionId = c.req.param('sessionId')
        const body = await c.req.json()
        const { content, provider, model } = body
        
        if (!content) {
          return c.json({ error: 'Message content is required' }, 400)
        }
        
        const result = await this.chatService.sendMessage(sessionId, content, provider, model)
        
        if (!isOk(result)) {
          return this.handleServiceError(result.error, c)
        }
        
        return c.json({ message: result.data })
      } catch (error) {
        return c.json({ error: 'Invalid JSON body' }, 400)
      }
    })

    // Get chat session messages
    chat.get('/sessions/:sessionId/messages', async (c) => {
      const sessionId = c.req.param('sessionId')
      
      const result = await this.chatService.getSession(sessionId)
      if (!isOk(result)) {
        return this.handleServiceError(result.error, c)
      }
      
      return c.json({ messages: result.data.messages })
    })

    // Update session system prompt
    chat.put('/sessions/:sessionId/prompt', async (c) => {
      try {
        const sessionId = c.req.param('sessionId')
        const body = await c.req.json()
        const { systemPromptId } = body
        
        if (!systemPromptId) {
          return c.json({ error: 'systemPromptId is required' }, 400)
        }
        
        const result = await this.chatService.updateSessionSystemPrompt(sessionId, systemPromptId)
        
        if (!isOk(result)) {
          return this.handleServiceError(result.error, c)
        }
        
        return c.json({ success: true })
      } catch (error) {
        return c.json({ error: 'Invalid JSON body' }, 400)
      }
    })
  }

  private setupSessionRoutes() {
    const sessions = this.app.basePath('/api/sessions')

    // Create new session
    sessions.post('/', async (c) => {
      try {
        const body = await c.req.json()
        const { title, systemPromptId, provider, model } = body
        
        if (!title) {
          return c.json({ error: 'Session title is required' }, 400)
        }
        
        const result = await this.chatService.createSession(title, systemPromptId, provider, model)
        
        if (!isOk(result)) {
          return this.handleServiceError(result.error, c)
        }
        
        return c.json({ session: result.data }, 201)
      } catch (error) {
        return c.json({ error: 'Invalid JSON body' }, 400)
      }
    })

    // List sessions
    sessions.get('/', async (c) => {
      const limit = parseInt(c.req.query('limit') || '50')
      const offset = parseInt(c.req.query('offset') || '0')
      
      const result = await this.chatService.listSessions(limit, offset)
      
      if (!isOk(result)) {
        return this.handleServiceError(result.error, c)
      }
      
      return c.json({ sessions: result.data })
    })

    // Get session by ID
    sessions.get('/:sessionId', async (c) => {
      const sessionId = c.req.param('sessionId')
      
      const result = await this.chatService.getSession(sessionId)
      
      if (!isOk(result)) {
        return this.handleServiceError(result.error, c)
      }
      
      return c.json({ session: result.data })
    })

    // Delete session
    sessions.delete('/:sessionId', async (c) => {
      const sessionId = c.req.param('sessionId')
      
      const result = this.db.deleteSession(sessionId)
      
      if (!isOk(result)) {
        return this.handleServiceError(result.error, c)
      }
      
      return c.json({ success: true })
    })
  }

  private setupToolRoutes() {
    const tools = this.app.basePath('/api/tools')

    // List available tools
    tools.get('/', (c) => {
      // TODO: Implement tool registry when tools are integrated
      return c.json({ 
        tools: [
          { name: 'read', description: 'Read file contents' },
          { name: 'write', description: 'Write to a file' },
          { name: 'edit', description: 'Edit file contents' },
          { name: 'grep', description: 'Search for patterns in files' },
          { name: 'bash', description: 'Execute shell commands' },
          { name: 'ls', description: 'List directory contents' },
        ]
      })
    })

    // Execute a tool
    tools.post('/execute', async (c) => {
      try {
        const body = await c.req.json()
        const { tool, parameters, sessionId } = body
        
        if (!tool || !parameters) {
          return c.json({ 
            error: 'Missing required fields: tool, parameters' 
          }, 400)
        }
        
        // TODO: Implement actual tool execution when tools are integrated
        // For now, return a mock response
        const mockResult = {
          tool,
          parameters,
          output: `Mock output for ${tool} with parameters: ${JSON.stringify(parameters)}`,
          success: true,
          timestamp: new Date().toISOString()
        }

        // If sessionId provided, we could log this to the database
        if (sessionId) {
          // TODO: Store tool execution in database
        }
        
        return c.json({ result: mockResult })
      } catch (error) {
        return c.json({ error: 'Invalid JSON body' }, 400)
      }
    })

    // Get tool execution history for a session
    tools.get('/sessions/:sessionId/executions', async (c) => {
      const sessionId = c.req.param('sessionId')
      
      // TODO: Implement when tool execution tracking is added to database
      return c.json({ executions: [] })
    })
  }

  private setupProviderRoutes() {
    const providers = this.app.basePath('/api/providers')

    // List registered providers
    providers.get('/', (c) => {
      const providerList = this.chatService.getProviders().map(p => ({
        name: p.name,
        models: p.models
      }))
      
      return c.json({ providers: providerList })
    })

    // Get provider statistics including cache stats
    providers.get('/:name/stats', (c) => {
      const providerName = c.req.param('name')
      const provider = this.chatService.getProvider(providerName)
      
      if (!provider) {
        return c.json({ error: 'Provider not found' }, 404)
      }

      const stats: any = {
        name: provider.name,
        models: provider.models
      }

      // Add cache stats if the provider supports it (Anthropic)
      if ('getCacheStats' in provider && typeof provider.getCacheStats === 'function') {
        stats.cache = (provider as any).getCacheStats()
      }

      return c.json({ stats })
    })

    // Test provider connection
    providers.post('/:name/test', async (c) => {
      const providerName = c.req.param('name')
      const provider = this.chatService.getProvider(providerName)
      
      if (!provider) {
        return c.json({ error: 'Provider not found' }, 404)
      }

      // Test if the provider has a test method (Anthropic)
      if ('test' in provider && typeof provider.test === 'function') {
        const testResult = await (provider as any).test()
        if (!testResult.success) {
          return this.handleServiceError(testResult.error, c)
        }
        return c.json({ status: 'healthy', tested: true })
      }

      return c.json({ status: 'unknown', tested: false })
    })
  }

  private handleServiceError(error: OpenCodeError, c: any) {
    switch (error.code) {
      case ErrorCode.SESSION_NOT_FOUND:
      case ErrorCode.NOT_FOUND:
        return c.json({ error: error.message }, 404)
      case ErrorCode.DATABASE_QUERY:
      case ErrorCode.DATABASE_CONNECTION:
        return c.json({ error: 'Database error', details: error.message }, 500)
      default:
        return c.json({ error: error.message }, 400)
    }
  }

  /**
   * Register an LLM provider with the chat service
   */
  registerProvider(provider: LLMProvider): void {
    this.chatService.registerProvider(provider)
  }

  /**
   * Get a registered provider by name (for accessing provider-specific features like cache stats)
   */
  getProvider(name: string): LLMProvider | undefined {
    return this.chatService.getProvider(name)
  }

  /**
   * Initialize the database schema
   */
  async initialize(): Promise<Result<void, OpenCodeError>> {
    return await this.db.initialize()
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    // Initialize database
    const initResult = await this.initialize()
    if (!isOk(initResult)) {
      throw new Error(`Failed to initialize database: ${initResult.error.message}`)
    }

    const env = process.env.NODE_ENV || 'development'
    console.log(`🚀 OpenCode server starting (${env})`)
    console.log(`📡 Port: ${this.config.port}`)
    console.log(`📊 Database: ${this.config.database.path}`)
    console.log(`💾 Cache enabled: ${process.env.ANTHROPIC_ENABLE_CACHE !== 'false'}`)
    console.log(`🌐 Health check: http://localhost:${this.config.port}/health`)
    console.log(`📚 API docs: http://localhost:${this.config.port}/api/prompts`)
    
    if (env === 'development') {
      console.log(`⚙️  CORS origins: ${this.config.cors?.origin}`)
    }
    
    // Start server
    const server = await Bun.serve({
      port: this.config.port,
      fetch: this.app.fetch.bind(this.app)
    })

    console.log(`✅ OpenCode server running on http://localhost:${server.port}`)
  }

  /**
   * Stop the server and cleanup resources
   */
  async stop(): Promise<void> {
    const closeResult = this.db.close()
    if (!isOk(closeResult)) {
      console.warn('Warning: Failed to close database connection:', closeResult.error.message)
    }
  }

  /**
   * Get the Hono app instance for testing or extending
   */
  getApp(): Hono {
    return this.app
  }
}

/**
 * Create and configure OpenCode server
 */
export function createServer(config: ServerConfig): OpenCodeServer {
  return new OpenCodeServer(config)
}

/**
 * Default server configuration from environment variables
 */
export function getDefaultServerConfig(databasePath?: string): ServerConfig {
  const corsOrigins = process.env.OPENCODE_CORS_ORIGINS?.split(',') || [
    'http://localhost:3000', 
    'http://localhost:5173',
    'http://localhost:8080'
  ]
  
  const corsMethods = process.env.OPENCODE_CORS_METHODS?.split(',') || [
    'GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'
  ]

  return {
    port: parseInt(process.env.OPENCODE_PORT || '3000'),
    database: {
      path: databasePath || process.env.OPENCODE_DATABASE_PATH || 'opencode.db',
      timeout: parseInt(process.env.OPENCODE_DATABASE_TIMEOUT || '5000'),
      verbose: process.env.DATABASE_VERBOSE === 'true'
    },
    cors: {
      origin: corsOrigins,
      allowMethods: corsMethods
    }
  }
} 