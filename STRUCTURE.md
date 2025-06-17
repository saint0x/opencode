# OpenCode v2 - Project Structure

## Overview
A streamlined TypeScript-only AI coding assistant with embedded sync, SQLite persistence, and a clean tool architecture optimized for LLM interaction.

## Repository Structure

```
opencode/
├── packages/
│   ├── core/                    # Core engine and business logic
│   │   ├── src/
│   │   │   ├── database/        # SQLite schema and migrations
│   │   │   │   ├── schema.ts    # Database schema definitions
│   │   │   │   ├── migrations/  # SQL migration files
│   │   │   │   └── client.ts    # Database connection and queries
│   │   │   ├── providers/       # AI provider integrations
│   │   │   │   ├── anthropic.ts
│   │   │   │   ├── openai.ts
│   │   │   │   ├── google.ts
│   │   │   │   ├── local.ts     # Ollama/local models
│   │   │   │   └── registry.ts  # Provider registration
│   │   │   ├── tools/           # AI coding tools
│   │   │   │   ├── filesystem/  # File operations
│   │   │   │   │   ├── read.ts
│   │   │   │   │   ├── write.ts
│   │   │   │   │   ├── edit.ts
│   │   │   │   │   └── list.ts
│   │   │   │   ├── search/      # Search and discovery
│   │   │   │   │   ├── grep.ts
│   │   │   │   │   └── glob.ts
│   │   │   │   ├── execution/   # Command execution
│   │   │   │   │   └── bash.ts
│   │   │   │   ├── intelligence/ # Code intelligence
│   │   │   │   │   ├── lsp-diagnostics.ts
│   │   │   │   │   └── lsp-hover.ts
│   │   │   │   ├── management/  # Task management
│   │   │   │   │   └── todo.ts
│   │   │   │   └── registry.ts  # Tool registration
│   │   │   ├── sessions/        # Session management
│   │   │   │   ├── manager.ts   # Session CRUD operations
│   │   │   │   ├── chat.ts      # Chat orchestration
│   │   │   │   └── context.ts   # Context management
│   │   │   ├── realtime/        # Simple real-time updates
│   │   │   │   ├── websocket.ts # WebSocket server
│   │   │   │   └── watcher.ts   # File system watching
│   │   │   ├── auth/            # Authentication
│   │   │   │   ├── manager.ts   # Auth management
│   │   │   │   └── providers.ts # OAuth implementations
│   │   │   ├── lsp/             # Language server integration
│   │   │   │   ├── client.ts    # LSP client implementation
│   │   │   │   └── languages.ts # Language definitions
│   │   │   ├── permissions/     # Permission system
│   │   │   │   └── manager.ts
│   │   │   ├── config/          # Configuration management
│   │   │   │   └── loader.ts
│   │   │   └── index.ts         # Core API exports
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── terminal/                # Terminal user interface
│   │   ├── src/
│   │   │   ├── components/      # Reusable UI components
│   │   │   │   ├── chat/        # Chat interface
│   │   │   │   │   ├── message.ts
│   │   │   │   │   ├── input.ts
│   │   │   │   │   └── history.ts
│   │   │   │   ├── dialogs/     # Modal dialogs
│   │   │   │   │   ├── permission.ts
│   │   │   │   │   └── provider-setup.ts
│   │   │   │   ├── views/       # Main application views
│   │   │   │   │   ├── session-list.ts
│   │   │   │   │   ├── session-view.ts
│   │   │   │   │   └── settings.ts
│   │   │   │   └── common/      # Shared components
│   │   │   │       ├── layout.ts
│   │   │   │       ├── spinner.ts
│   │   │   │       └── status-bar.ts
│   │   │   ├── styles/          # Terminal styling
│   │   │   │   ├── theme.ts
│   │   │   │   └── colors.ts
│   │   │   ├── state/           # Application state
│   │   │   │   ├── store.ts     # State management
│   │   │   │   └── reducer.ts   # State updates
│   │   │   ├── client/          # Core engine client
│   │   │   │   └── api.ts       # Communication with core
│   │   │   ├── app.ts           # Main application
│   │   │   └── cli.ts           # CLI entry point
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── web/                     # Web interface (optional)
│   │   ├── src/
│   │   │   ├── pages/           # Web pages
│   │   │   │   ├── share/       # Session sharing
│   │   │   │   └── docs/        # Documentation
│   │   │   └── components/      # Web components
│   │   ├── package.json
│   │   └── astro.config.mjs
│   └── types/                   # Shared type definitions
│       ├── src/
│       │   ├── sessions.ts      # Session types
│       │   ├── tools.ts         # Tool types
│       │   ├── providers.ts     # Provider types
│       │   ├── events.ts        # Event types
│       │   └── index.ts         # Type exports
│       ├── package.json
│       └── tsconfig.json
├── apps/
│   └── desktop/                 # Future: Electron app
├── scripts/                     # Build and deployment scripts
│   ├── build.ts
│   ├── dev.ts
│   └── migrate.ts
├── docs/                        # Documentation
│   ├── api/                     # API documentation
│   ├── tools/                   # Tool documentation
│   └── providers/               # Provider setup guides
├── .github/                     # GitHub workflows
├── package.json                 # Root package.json
├── tsconfig.json               # Root TypeScript config
├── bun.lock
└── README.md
```

## Key Architectural Decisions

### Database Layer
- **SQLite** with proper schema and migrations
- **WAL mode** for concurrent read/write access
- **Foreign keys** and **transactions** for data integrity
- **Prepared statements** for performance and security

### Real-time Synchronization
- **SQLite WAL mode** for concurrent read/write access
- **Simple WebSocket broadcasting** for UI state updates
- **File system watching** for external change detection
- **Direct function calls** instead of complex event systems

### Tool System
- **Structured metadata** optimized for LLM comprehension
- **Zod schemas** for runtime validation
- **Streaming results** for real-time feedback
- **Permission integration** for safe execution
- **Context awareness** (session, file state, etc.)

### Provider System
- **Plugin-based architecture** for easy extensibility
- **Unified interface** across all providers
- **Credential management** with secure storage
- **Model capability detection** and routing
- **Cost tracking** and usage analytics

### State Management
- **Centralized store** with immutable updates
- **Event-driven updates** for reactive UI
- **Optimistic UI updates** with rollback
- **Persistent state** with automatic restoration

### Terminal UI
- **Ink-based architecture** with React-like component composition
- **Flexbox layouts** that adapt to terminal size automatically
- **Rich styling** with 24-bit color and custom themes
- **Smooth animations** using React hooks and effects
- **Component reusability** with proper TypeScript interfaces
- **Hot reload support** for rapid development iteration

## Configuration Schema

```typescript
interface OpenCodeConfig {
  providers: {
    [key: string]: {
      apiKey?: string
      baseUrl?: string
      models: string[]
      options?: Record<string, any>
    }
  }
  tools: {
    enabled: string[]
    disabled: string[]
    permissions: {
      [toolId: string]: 'allow' | 'deny' | 'prompt'
    }
  }
  ui: {
    theme: string
    vim_mode: boolean
    auto_save: boolean
  }
  context: {
    max_tokens: number
    summary_threshold: number
    file_size_limit: number
  }
}
```

## Data Model

### Sessions
```typescript
interface Session {
  id: string
  title: string
  created_at: Date
  updated_at: Date
  parent_id?: string
  metadata: {
    total_cost: number
    message_count: number
    provider_usage: Record<string, number>
  }
}
```

### Messages
```typescript
interface Message {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: MessagePart[]
  metadata: {
    timestamp: Date
    provider?: string
    model?: string
    cost?: number
    tokens?: TokenUsage
    tools_used?: string[]
  }
}
```

### Tool Executions
```typescript
interface ToolExecution {
  id: string
  message_id: string
  tool_name: string
  parameters: Record<string, any>
  result: {
    output: string
    metadata: Record<string, any>
    error?: string
  }
  timing: {
    started_at: Date
    completed_at: Date
    duration_ms: number
  }
}
```

## Development Workflow

### Local Development
```bash
bun install              # Install dependencies
bun run dev:core         # Start core engine with hot reload
bun run dev:terminal     # Start terminal UI in development mode
bun run dev:web          # Start web interface (optional)
```

### Building
```bash
bun run build           # Build all packages
bun run build:core      # Build core engine only
bun run build:terminal  # Build terminal UI only
```

### Testing
```bash
bun run test           # Run all tests
bun run test:core      # Test core engine
bun run test:terminal  # Test terminal UI
bun run test:e2e       # End-to-end tests
```

## Technology Stack

- **Runtime**: Bun for package management and execution
- **Language**: TypeScript throughout (single language architecture)
- **Database**: SQLite with better-sqlite3 and WAL mode
- **Terminal UI**: Ink with React-like components
- **Web UI**: Astro + SolidJS (minimal, optional)
- **Real-time**: Simple WebSocket broadcasting
- **Validation**: Zod for schemas and runtime validation
- **Build**: esbuild via Bun with hot reload
- **Testing**: Bun test runner with comprehensive coverage
- **Error Handling**: Result types with graceful recovery

## Migration Strategy

This structure eliminates the complexity of the multi-language stack while preserving all core functionality. Simple WebSocket broadcasting replaces the complex Go-Node communication with a clean TypeScript-only solution optimized for single-user performance. 