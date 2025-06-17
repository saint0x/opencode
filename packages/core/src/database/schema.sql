-- OpenCode v2 Database Schema
-- SQLite with WAL mode, foreign keys, and proper indexing

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA temp_store = memory;
PRAGMA mmap_size = 268435456; -- 256MB mmap

-- Sessions table - Core conversation sessions
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    parent_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
    provider TEXT,
    model TEXT,
    system_prompt TEXT,
    metadata JSON NOT NULL DEFAULT '{}',
    message_count INTEGER NOT NULL DEFAULT 0,
    total_cost REAL NOT NULL DEFAULT 0.0,
    status TEXT CHECK(status IN ('active', 'archived', 'error')) DEFAULT 'active'
);

-- Messages table - Individual messages in conversations
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    provider TEXT,
    model TEXT,
    cost REAL DEFAULT 0.0,
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    metadata JSON NOT NULL DEFAULT '{}',
    error_code TEXT,
    error_message TEXT
);

-- Tool executions table - Track all tool usage
CREATE TABLE IF NOT EXISTS tool_executions (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    tool_name TEXT NOT NULL,
    parameters JSON NOT NULL DEFAULT '{}',
    result JSON NOT NULL DEFAULT '{}',
    status TEXT CHECK(status IN ('pending', 'running', 'success', 'error', 'timeout')) DEFAULT 'pending',
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    duration_ms INTEGER,
    error_code TEXT,
    error_message TEXT,
    metadata JSON NOT NULL DEFAULT '{}'
);

-- Authentication credentials table - Encrypted API keys and tokens
CREATE TABLE IF NOT EXISTS auth_credentials (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    credential_type TEXT NOT NULL CHECK(credential_type IN ('api_key', 'oauth_token', 'refresh_token')),
    encrypted_value BLOB NOT NULL,
    expires_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSON NOT NULL DEFAULT '{}',
    UNIQUE(provider, credential_type)
);

-- Configuration table - Application settings
CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value JSON NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Migration tracking
CREATE TABLE IF NOT EXISTS migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    checksum TEXT NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_parent_id ON sessions(parent_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
CREATE INDEX IF NOT EXISTS idx_messages_session_created ON messages(session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_tool_executions_message_id ON tool_executions(message_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_session_id ON tool_executions(session_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_tool_name ON tool_executions(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_executions_status ON tool_executions(status);
CREATE INDEX IF NOT EXISTS idx_tool_executions_started_at ON tool_executions(started_at);

CREATE INDEX IF NOT EXISTS idx_auth_credentials_provider ON auth_credentials(provider);
CREATE INDEX IF NOT EXISTS idx_auth_credentials_type ON auth_credentials(credential_type);

-- Triggers to maintain updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_sessions_timestamp 
    AFTER UPDATE ON sessions
BEGIN
    UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_auth_credentials_timestamp 
    AFTER UPDATE ON auth_credentials
BEGIN
    UPDATE auth_credentials SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_config_timestamp 
    AFTER UPDATE ON config
BEGIN
    UPDATE config SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
END;

-- Trigger to update session message count and cost
CREATE TRIGGER IF NOT EXISTS update_session_stats_on_message_insert
    AFTER INSERT ON messages
BEGIN
    UPDATE sessions 
    SET 
        message_count = message_count + 1,
        total_cost = total_cost + COALESCE(NEW.cost, 0),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.session_id;
END;

CREATE TRIGGER IF NOT EXISTS update_session_stats_on_message_update
    AFTER UPDATE ON messages
BEGIN
    UPDATE sessions 
    SET 
        total_cost = total_cost - COALESCE(OLD.cost, 0) + COALESCE(NEW.cost, 0),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.session_id;
END;

-- Insert initial migration record
INSERT OR IGNORE INTO migrations (version, name, checksum) 
VALUES (1, 'initial_schema', 'sha256:initial');

-- Insert default configuration
INSERT OR IGNORE INTO config (key, value) VALUES 
('app_version', '"2.0.0"'),
('database_version', '1'),
('created_at', '"' || datetime('now') || '"');

-- Todos table - for the todo tool
CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    session_id TEXT,
    metadata JSON NOT NULL DEFAULT '{}',
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_todos_session_id ON todos(session_id);
CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);

CREATE TRIGGER IF NOT EXISTS update_todos_timestamp
    AFTER UPDATE ON todos
BEGIN
    UPDATE todos SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END; 