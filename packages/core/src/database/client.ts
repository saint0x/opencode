import Database from 'better-sqlite3'
import path from 'path'
import { initializeDatabase } from './schema.js'
import type { Result } from '../utils/error.js'

class DatabaseClient {
  private db: Database.Database | null = null
  private dbPath: string

  constructor(dataDir: string = '.opencode') {
    this.dbPath = path.join(dataDir, 'opencode.db')
  }

  connect(): Result<void> {
    try {
      if (this.db) {
        return { success: true, data: undefined }
      }

      this.db = new Database(this.dbPath)
      initializeDatabase(this.db)
      
      return { success: true, data: undefined }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error('Failed to connect to database')
      }
    }
  }

  disconnect(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }

  getDatabase(): Database.Database {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.')
    }
    return this.db
  }

  // Transaction wrapper
  transaction<T>(fn: (db: Database.Database) => T): Result<T> {
    try {
      const db = this.getDatabase()
      const transaction = db.transaction(fn)
      const result = transaction(db)
      return { success: true, data: result }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Transaction failed')
      }
    }
  }

  // Health check
  healthCheck(): Result<{ status: 'healthy' | 'unhealthy', message: string }> {
    try {
      const db = this.getDatabase()
      const result = db.prepare('SELECT 1 as health').get()
      
      if (result && (result as any).health === 1) {
        return { 
          success: true, 
          data: { status: 'healthy', message: 'Database is responsive' }
        }
      } else {
        return {
          success: false,
          error: new Error('Health check query returned unexpected result')
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Health check failed')
      }
    }
  }

  // Backup database
  backup(backupPath: string): Result<void> {
    try {
      const db = this.getDatabase()
      db.backup(backupPath)
      return { success: true, data: undefined }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Backup failed')
      }
    }
  }

  // Get database info
  getInfo(): Result<{
    path: string
    size: number
    tables: string[]
    walMode: boolean
  }> {
    try {
      const db = this.getDatabase()
      
      // Get file size
      const fs = require('fs')
      const stats = fs.statSync(this.dbPath)
      
      // Get tables
      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all() as { name: string }[]
      
      // Check WAL mode
      const walMode = db.prepare('PRAGMA journal_mode').get() as { journal_mode: string }
      
      return {
        success: true,
        data: {
          path: this.dbPath,
          size: stats.size,
          tables: tables.map(t => t.name),
          walMode: walMode.journal_mode === 'wal'
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Failed to get database info')
      }
    }
  }
}

// Singleton instance
let dbClient: DatabaseClient | null = null

export function getDbClient(dataDir?: string): DatabaseClient {
  if (!dbClient) {
    dbClient = new DatabaseClient(dataDir)
  }
  return dbClient
}

export { DatabaseClient } 