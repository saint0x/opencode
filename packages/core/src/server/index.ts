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
import { initializeTools, createToolContext, validateToolEnvironment } from '../tools/init.js'
import type { ToolRegistry } from '../tools/registry.js'
import { serve, type Server } from '@hono/node-server'
import { createAnthropicProvider } from '../providers/anthropic.js'
import { SystemPromptService } from '../prompts/service.js'
import { WebSocketServer, WebSocket } from 'ws'
import { realtimeNotifier } from '../realtime/notifier.js'
import type { RealtimeEvent } from '@opencode/types'

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
  private toolRegistry: ToolRegistry
  private config: ServerConfig
  private promptService: SystemPromptService
  private wss!: WebSocketServer
  private subscriptions: Map<string, Set<WebSocket>> = new Map()

  constructor(config: ServerConfig) {
    this.config = config
    this.app = new Hono()
    
    // Initialize database
    const dbResult = createDatabase(config.database)
    if (!isOk(dbResult)) {
      throw new Error(`Failed to create database: ${dbResult.error.message}`)
    }
    this.db = dbResult.data
    
    // Initialize services
    const toolRegistry = initializeTools(this.db)
    this.chatService = new ChatService(this.db, toolRegistry)
    this.promptService = new SystemPromptService()
    
    // Register providers
    const anthropicProviderResult = createAnthropicProvider()
    
    // Validate tool environment
    const validation = validateToolEnvironment()
    if (!validation.valid) {
      console.warn('Tool environment validation failed:', validation.errors)
    }
    
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
      const toolDefinitions = this.toolRegistry.getToolDefinitions()
      return c.json({ tools: toolDefinitions })
    })

    // Get tool by name with full definition
    tools.get('/:toolName', (c) => {
      const toolName = c.req.param('toolName')
      const tool = this.toolRegistry.getTool(toolName)
      
      if (!tool) {
        return c.json({ error: 'Tool not found' }, 404)
      }
      
      return c.json({ tool: tool.definition })
    })

    // Get tools by category
    tools.get('/category/:category', (c) => {
      const category = c.req.param('category') as any
      const tools = this.toolRegistry.getToolsByCategory(category)
      return c.json({ 
        tools: tools.map(t => t.definition),
        category 
      })
    })

    // Execute a tool
    tools.post('/execute', async (c) => {
      try {
        const body = await c.req.json()
        const { tool, parameters, sessionId, workingDirectory } = body
        
        if (!tool || !parameters) {
          return c.json({ 
            error: 'Missing required fields: tool, parameters' 
          }, 400)
        }
        
        // Create execution context
        const context = createToolContext({
          sessionId,
          workingDirectory: workingDirectory || process.cwd()
        })
        
        // Execute tool with tracking
        const result = await this.toolRegistry.executeToolTracked(tool, parameters, context)
        
        if (!result.success) {
          return this.handleServiceError(result.error, c)
        }
        
        return c.json({ 
          result: result.data,
          tool_name: tool,
          execution_context: {
            session_id: sessionId,
            working_directory: context.workingDirectory
          }
        })
      } catch (error) {
        return c.json({ error: 'Invalid JSON body' }, 400)
      }
    })

    // Get tool execution statistics
    tools.get('/stats', (c) => {
      const stats = this.toolRegistry.getExecutionStats()
      return c.json({ stats })
    })

    // Get tool execution history for a session
    tools.get('/sessions/:sessionId/executions', async (c) => {
      const sessionId = c.req.param('sessionId')
      
      // TODO: Implement when tool execution tracking is fully integrated with database
      return c.json({ 
        executions: [],
        message: 'Tool execution history tracking coming soon'
      })
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
    const toolStats = this.toolRegistry.getExecutionStats()
    
    console.log(`🚀 OpenCode server starting (${env})`)
    console.log(`📡 Port: ${this.config.port}`)
    console.log(`📊 Database: ${this.config.database.path}`)
    console.log(`💾 Cache enabled: ${process.env.ANTHROPIC_ENABLE_CACHE !== 'false'}`)
    console.log(`🔧 Tools loaded: ${toolStats.totalTools} (${Object.entries(toolStats.categories).map(([cat, count]) => `${cat}: ${count}`).join(', ')})`)
    console.log(`🌐 Health check: http://localhost:${this.config.port}/health`)
    console.log(`📚 API endpoints: http://localhost:${this.config.port}/api/`)
    
    if (env === 'development') {
      console.log(`⚙️  CORS origins: ${this.config.cors?.origin}`)
      console.log(`🛠️  Tools endpoint: http://localhost:${this.config.port}/api/tools`)
    }
    
    // Start server
    const server = await Bun.serve({
      port: this.config.port,
      fetch: this.app.fetch.bind(this.app)
    })

    console.log(`✅ OpenCode server running on http://localhost:${server.port}`)

    this.setupWebSocketServer(server)
    
    realtimeNotifier.on('event', this.handleRealtimeEvent.bind(this))
  }

  private setupWebSocketServer(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' })
    console.log('🔌 WebSocket server initialized at /ws')

    this.wss.on('connection', (ws, req) => {
      const url = new URL(req.url!, `http://${req.headers.host}`)
      const sessionId = url.searchParams.get('sessionId')

      if (!sessionId) {
        ws.close(1008, 'Session ID is required')
        return
      }

      this.subscribe(sessionId, ws)
      ws.on('close', () => this.unsubscribe(sessionId, ws))
      ws.on('error', () => this.unsubscribe(sessionId, ws))
    })
  }

  private subscribe(sessionId: string, ws: WebSocket) {
    if (!this.subscriptions.has(sessionId)) {
      this.subscriptions.set(sessionId, new Set())
    }
    this.subscriptions.get(sessionId)!.add(ws)
    console.log(`Client subscribed to session ${sessionId}`)
  }

  private unsubscribe(sessionId: string, ws: WebSocket) {
    const sessionSockets = this.subscriptions.get(sessionId)
    if (sessionSockets) {
      sessionSockets.delete(ws)
      if (sessionSockets.size === 0) {
        this.subscriptions.delete(sessionId)
      }
    }
    console.log(`Client unsubscribed from session ${sessionId}`)
  }

  private handleRealtimeEvent(event: RealtimeEvent) {
    const sessionId = (event.payload as any).sessionId
    if (sessionId && this.subscriptions.has(sessionId)) {
      const payload = JSON.stringify(event)
      this.subscriptions.get(sessionId)!.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload)
        }
      })
    }
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