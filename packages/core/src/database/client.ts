import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
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
  role: 'user' | 'assistant' | 'system'
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
  private db: Database.Database
  private readonly config: DatabaseConfig

  constructor(config: DatabaseConfig) {
    this.config = config
    
    try {
      this.db = new Database(config.path, {
        readonly: config.readonly ?? false,
        verbose: config.verbose ? console.log : undefined,
        timeout: config.timeout ?? 5000,
      })

      // Configure WAL mode and performance settings
      this.db.pragma('journal_mode = WAL')
      this.db.pragma('synchronous = NORMAL')
      this.db.pragma('temp_store = memory')
      
      const mmapSizeMB = config.mmapSize || parseInt(process.env.DATABASE_MMAP_SIZE_MB || '256')
      this.db.pragma(`mmap_size = ${mmapSizeMB * 1024 * 1024}`)
      
      const cacheSize = config.cacheSize || parseInt(process.env.DATABASE_CACHE_SIZE || '1000')
      this.db.pragma(`cache_size = ${cacheSize}`)
      
      this.db.pragma('foreign_keys = ON')

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
      const schemaPath = join(__dirname, 'schema.sql')
      const schema = readFileSync(schemaPath, 'utf-8')
      
      this.db.exec(schema)
      
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
        session.parent_id,
        session.provider,
        session.model,
        session.system_prompt,
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
  addMessage(message: Omit<MessageRecord, 'created_at'>): Result<void, OpenCodeError> {
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
        message.provider,
        message.model,
        message.cost,
        message.tokens_input,
        message.tokens_output,
        message.metadata,
        message.error_code,
        message.error_message
      )
      
      return ok(undefined)
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
        walMode: this.db.pragma('journal_mode', { simple: true }),
        foreignKeys: this.db.pragma('foreign_keys', { simple: true }),
        pageSize: this.db.pragma('page_size', { simple: true }),
        cacheSize: this.db.pragma('cache_size', { simple: true }),
        mmapSize: this.db.pragma('mmap_size', { simple: true }),
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
    const db = new OpenCodeDatabase(config)
    return ok(db)
  } catch (error) {
    return err(error as OpenCodeError)
  }
} 