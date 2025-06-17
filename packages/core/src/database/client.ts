import { Database } from 'bun:sqlite'
import { readFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { 
  Result, 
  ok, 
  err, 
  ErrorCode, 
  databaseError,
  type OpenCodeError 
} from '@opencode/types'

const __dirname = dirname(fileURLToPath(import.meta.url))

export interface DatabaseConfig {
  path: string
  readonly?: boolean
  verbose?: boolean
  timeout?: number
  mmapSize?: number
  cacheSize?: number
}

export interface SessionRecord {
  id: string
  title: string
  created_at: string
  updated_at: string
  parent_id?: string
  provider?: string
  model?: string
  system_prompt?: string
  metadata: string // JSON
  message_count: number
  total_cost: number
  status: 'active' | 'archived' | 'error'
}

export interface MessageRecord {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  created_at: string
  provider?: string
  model?: string
  cost?: number
  tokens_input?: number
  tokens_output?: number
  metadata: string // JSON
  error_code?: string
  error_message?: string
}

export interface ToolExecutionRecord {
  id: string
  message_id: string
  session_id: string
  tool_name: string
  parameters: string // JSON
  result: string // JSON
  status: 'pending' | 'running' | 'success' | 'error' | 'timeout'
  started_at: string
  completed_at?: string
  duration_ms?: number
  error_code?: string
  error_message?: string
  metadata: string // JSON
}

export interface TodoRecord {
  id: string
  content: string
  status: 'pending' | 'completed'
  created_at: string
  updated_at: string
  session_id: string | null
  metadata: string // JSON
}

export class OpenCodeDatabase {
  private db: Database
  private readonly config: DatabaseConfig

  constructor(config: DatabaseConfig) {
    this.config = config
    
    try {
      // Ensure database directory exists
      const dbDir = dirname(config.path)
      mkdirSync(dbDir, { recursive: true })
      
      this.db = new Database(config.path, {
        readonly: config.readonly ?? false,
        create: true,
      })

      // Configure WAL mode and performance settings
      this.db.run('PRAGMA journal_mode = WAL')
      this.db.run('PRAGMA synchronous = NORMAL')
      this.db.run('PRAGMA temp_store = memory')
      
      const mmapSizeMB = config.mmapSize || parseInt(process.env.DATABASE_MMAP_SIZE_MB || '256')
      this.db.run(`PRAGMA mmap_size = ${mmapSizeMB * 1024 * 1024}`)
      
      const cacheSize = config.cacheSize || parseInt(process.env.DATABASE_CACHE_SIZE || '1000')
      this.db.run(`PRAGMA cache_size = ${cacheSize}`)
      
      this.db.run('PRAGMA foreign_keys = ON')

    } catch (error) {
      throw databaseError(
        ErrorCode.DATABASE_CONNECTION,
        `Failed to connect to database: ${config.path}`,
        error as Error
      )
    }
  }

  /**
   * Initialize database with schema
   */
  async initialize(): Promise<Result<void, OpenCodeError>> {
    try {
      // Import and use the schema from the TypeScript file instead of reading SQL file
      const { initializeDatabase } = await import('./schema.js')
      initializeDatabase(this.db)
      
      return ok(undefined)
    } catch (error) {
      return err(databaseError(
        ErrorCode.DATABASE_MIGRATION,
        'Failed to initialize database schema',
        error as Error
      ))
    }
  }

  /**
   * Execute within a transaction
   */
  transaction<T>(fn: () => T): Result<T, OpenCodeError> {
    try {
      const transaction = this.db.transaction(fn)
      const result = transaction()
      return ok(result)
    } catch (error) {
      return err(databaseError(
        ErrorCode.DATABASE_TRANSACTION,
        'Transaction failed',
        error as Error
      ))
    }
  }

  // ===== SESSION OPERATIONS =====

  /**
   * Create a new session
   */
  createSession(session: Omit<SessionRecord, 'created_at' | 'updated_at' | 'message_count' | 'total_cost'>): Result<void, OpenCodeError> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO sessions (
          id, title, parent_id, provider, model, system_prompt, metadata, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      
      stmt.run(
        session.id,
        session.title,
        session.parent_id || null,
        session.provider || null,
        session.model || null,
        session.system_prompt || null,
        session.metadata,
        session.status
      )
      
      return ok(undefined)
    } catch (error) {
      return err(databaseError(
        ErrorCode.DATABASE_QUERY,
        'Failed to create session',
        error as Error
      ))
    }
  }

  /**
   * Get session by ID
   */
  getSession(id: string): Result<SessionRecord | null, OpenCodeError> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM sessions WHERE id = ?
      `)
      
      const result = stmt.get(id) as SessionRecord | undefined
      return ok(result ?? null)
    } catch (error) {
      return err(databaseError(
        ErrorCode.DATABASE_QUERY,
        'Failed to get session',
        error as Error
      ))
    }
  }

  /**
   * List all sessions with pagination
   */
  listSessions(
    limit: number = 50, 
    offset: number = 0,
    status?: SessionRecord['status']
  ): Result<SessionRecord[], OpenCodeError> {
    try {
      let query = `
        SELECT * FROM sessions 
      `
      const params: any[] = []

      if (status) {
        query += ` WHERE status = ?`
        params.push(status)
      }

      query += ` ORDER BY updated_at DESC LIMIT ? OFFSET ?`
      params.push(limit, offset)

      const stmt = this.db.prepare(query)
      const results = stmt.all(...params) as SessionRecord[]
      
      return ok(results)
    } catch (error) {
      return err(databaseError(
        ErrorCode.DATABASE_QUERY,
        'Failed to list sessions',
        error as Error
      ))
    }
  }

  /**
   * Update session
   */
  updateSession(id: string, updates: Partial<Omit<SessionRecord, 'id' | 'created_at' | 'updated_at'>>): Result<void, OpenCodeError> {
    try {
      const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ')
      const values = Object.values(updates)
      
      const stmt = this.db.prepare(`
        UPDATE sessions SET ${fields} WHERE id = ?
      `)
      
      const result = stmt.run(...values, id)
      
      if (result.changes === 0) {
        return err(databaseError(
          ErrorCode.SESSION_NOT_FOUND,
          `Session not found: ${id}`
        ))
      }
      
      return ok(undefined)
    } catch (error) {
      return err(databaseError(
        ErrorCode.DATABASE_QUERY,
        'Failed to update session',
        error as Error
      ))
    }
  }

  /**
   * Delete session
   */
  deleteSession(id: string): Result<void, OpenCodeError> {
    try {
      const stmt = this.db.prepare(`DELETE FROM sessions WHERE id = ?`)
      const result = stmt.run(id)
      
      if (result.changes === 0) {
        return err(databaseError(
          ErrorCode.SESSION_NOT_FOUND,
          `Session not found: ${id}`
        ))
      }
      
      return ok(undefined)
    } catch (error) {
      return err(databaseError(
        ErrorCode.DATABASE_QUERY,
        'Failed to delete session',
        error as Error
      ))
    }
  }

  // ===== MESSAGE OPERATIONS =====

  /**
   * Add message to session
   */
  addMessage(message: Omit<MessageRecord, 'created_at'>): Result<{ id: string }, OpenCodeError> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO messages (
          id, session_id, role, content, provider, model, cost, 
          tokens_input, tokens_output, metadata, error_code, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      
      stmt.run(
        message.id,
        message.session_id,
        message.role,
        message.content,
        message.provider || null,
        message.model || null,
        message.cost || null,
        message.tokens_input || null,
        message.tokens_output || null,
        message.metadata,
        message.error_code || null,
        message.error_message || null
      )
      
      return ok({ id: message.id })
    } catch (error) {
      return err(databaseError(
        ErrorCode.DATABASE_QUERY,
        'Failed to add message',
        error as Error
      ))
    }
  }

  /**
   * Get messages for session
   */
  getSessionMessages(sessionId: string, limit?: number): Result<MessageRecord[], OpenCodeError> {
    try {
      let query = `
        SELECT * FROM messages 
        WHERE session_id = ? 
        ORDER BY created_at ASC
      `
      const params: any[] = [sessionId]
      
      if (limit) {
        query += ` LIMIT ?`
        params.push(limit)
      }
      
      const stmt = this.db.prepare(query)
      const results = stmt.all(...params) as MessageRecord[]
      
      return ok(results)
    } catch (error) {
      return err(databaseError(
        ErrorCode.DATABASE_QUERY,
        'Failed to get session messages',
        error as Error
      ))
    }
  }

  // ===== TODO OPERATIONS =====

  addTodo(
    todo: Omit<TodoRecord, 'created_at' | 'updated_at' | 'status'>
  ): Result<void, OpenCodeError> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO todos (id, content, session_id, metadata)
        VALUES (?, ?, ?, ?)
      `)
      stmt.run(todo.id, todo.content, todo.session_id, todo.metadata)
      return ok(undefined)
    } catch (error) {
      return err(
        databaseError(
          ErrorCode.DATABASE_QUERY,
          'Failed to add todo',
          error as Error
        )
      )
    }
  }

  listTodos(
    sessionId?: string,
    status?: 'pending' | 'completed'
  ): Result<TodoRecord[], OpenCodeError> {
    try {
      let query = `SELECT * FROM todos`
      const params: any[] = []
      const conditions: string[] = []

      if (sessionId) {
        conditions.push(`session_id = ?`)
        params.push(sessionId)
      }
      if (status) {
        conditions.push(`status = ?`)
        params.push(status)
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`
      }

      query += ` ORDER BY created_at DESC`
      
      const stmt = this.db.prepare(query)
      const results = stmt.all(...params) as TodoRecord[]
      return ok(results)
    } catch (error) {
      return err(
        databaseError(
          ErrorCode.DATABASE_QUERY,
          'Failed to list todos',
          error as Error
        )
      )
    }
  }

  updateTodoStatus(
    id: string,
    status: 'pending' | 'completed'
  ): Result<void, OpenCodeError> {
    try {
      const stmt = this.db.prepare(`
        UPDATE todos SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `)
      const result = stmt.run(status, id)
      if (result.changes === 0) {
        return err(databaseError(ErrorCode.NOT_FOUND, `Todo not found: ${id}`))
      }
      return ok(undefined)
    } catch (error) {
      return err(
        databaseError(
          ErrorCode.DATABASE_QUERY,
          'Failed to update todo status',
          error as Error
        )
      )
    }
  }

  // ===== HEALTH CHECK =====

  /**
   * Health check
   */
  healthCheck(): Result<{ status: 'healthy' | 'unhealthy'; details: Record<string, any> }, OpenCodeError> {
    try {
      // Test basic query
      const result = this.db.prepare('SELECT 1 as test').get() as { test: number }
      
      // Get database info
      const info = {
        walMode: this.db.query('PRAGMA journal_mode').get(),
        foreignKeys: this.db.query('PRAGMA foreign_keys').get(),
        pageSize: this.db.query('PRAGMA page_size').get(),
        cacheSize: this.db.query('PRAGMA cache_size').get(),
        mmapSize: this.db.query('PRAGMA mmap_size').get(),
      }
      
      return ok({
        status: result.test === 1 ? 'healthy' : 'unhealthy',
        details: info
      })
    } catch (error) {
      return err(databaseError(
        ErrorCode.DATABASE_CONNECTION,
        'Database health check failed',
        error as Error
      ))
    }
  }

  /**
   * Close database connection
   */
  close(): Result<void, OpenCodeError> {
    try {
      this.db.close()
      return ok(undefined)
    } catch (error) {
      return err(databaseError(
        ErrorCode.DATABASE_CONNECTION,
        'Failed to close database connection',
        error as Error
      ))
    }
  }
}

// Helper function to create database instance
export function createDatabase(config: DatabaseConfig): Result<OpenCodeDatabase, OpenCodeError> {
  try {
    // Ensure database directory exists before creating database
    const dbDir = dirname(config.path)
    mkdirSync(dbDir, { recursive: true })
    
    const db = new OpenCodeDatabase(config)
    return ok(db)
  } catch (error) {
    return err(error as OpenCodeError)
  }
} 