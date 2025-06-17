import Database from 'better-sqlite3'
import { z } from 'zod'

export const DatabaseSchema = {
  sessions: `
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      parent_id TEXT,
      total_cost REAL DEFAULT 0,
      message_count INTEGER DEFAULT 0,
      provider_usage TEXT DEFAULT '{}',
      FOREIGN KEY (parent_id) REFERENCES sessions(id)
    )
  `,
  
  messages: `
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      provider TEXT,
      model TEXT,
      cost REAL,
      tokens_input INTEGER DEFAULT 0,
      tokens_output INTEGER DEFAULT 0,
      tokens_reasoning INTEGER DEFAULT 0,
      tokens_cache_read INTEGER DEFAULT 0,
      tokens_cache_write INTEGER DEFAULT 0,
      tools_used TEXT DEFAULT '[]',
      error_data TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `,
  
  tool_executions: `
    CREATE TABLE IF NOT EXISTS tool_executions (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      parameters TEXT NOT NULL,
      output TEXT NOT NULL,
      metadata TEXT NOT NULL,
      error TEXT,
      started_at INTEGER NOT NULL,
      completed_at INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
    )
  `,
  
  auth_credentials: `
    CREATE TABLE IF NOT EXISTS auth_credentials (
      provider_id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('api', 'oauth')),
      encrypted_data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `,
  
  provider_configs: `
    CREATE TABLE IF NOT EXISTS provider_configs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      base_url TEXT,
      models TEXT NOT NULL,
      active BOOLEAN DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `,
  
  usage_metrics: `
    CREATE TABLE IF NOT EXISTS usage_metrics (
      id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      cost REAL NOT NULL,
      tokens_input INTEGER NOT NULL,
      tokens_output INTEGER NOT NULL,
      requests INTEGER DEFAULT 1,
      timestamp INTEGER NOT NULL,
      session_id TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )
  `,
  
  // Indexes for performance
  indexes: [
    'CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id)',
    'CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)',
    'CREATE INDEX IF NOT EXISTS idx_tool_executions_message_id ON tool_executions(message_id)',
    'CREATE INDEX IF NOT EXISTS idx_usage_metrics_timestamp ON usage_metrics(timestamp)',
    'CREATE INDEX IF NOT EXISTS idx_usage_metrics_provider ON usage_metrics(provider_id)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at)',
  ],
}

export function initializeDatabase(db: Database.Database) {
  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('cache_size = 1000')
  db.pragma('foreign_keys = ON')
  
  // Create tables
  db.exec(DatabaseSchema.sessions)
  db.exec(DatabaseSchema.messages)
  db.exec(DatabaseSchema.tool_executions)
  db.exec(DatabaseSchema.auth_credentials)
  db.exec(DatabaseSchema.provider_configs)
  db.exec(DatabaseSchema.usage_metrics)
  
  // Create indexes
  for (const index of DatabaseSchema.indexes) {
    db.exec(index)
  }
  
  console.log('Database initialized successfully')
} 