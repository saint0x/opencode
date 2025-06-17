import { ToolRegistry } from './registry'
import type { OpenCodeDatabase } from '../database/client'

// Filesystem Tools
import { ReadTool } from './adapters/read-tool'
import { ListTool } from './adapters/list-tool'
import { WriteTool } from './adapters/write-tool'
import { EditTool } from './adapters/edit-tool'
import { MultiEditTool } from './adapters/multiedit-tool'

// Search Tools
import { GrepTool } from './adapters/grep-tool'
import { GlobTool } from './adapters/glob-tool'
import { WebFetchTool } from './adapters/webfetch-tool'
import { WebSearchTool } from './adapters/websearch-tool'

// Execution Tools
import { BashTool } from './adapters/bash-tool'

// Management Tools
import { TodoTool } from './adapters/todo-tool'

/**
 * Initialize all available tools and register them with the ToolRegistry.
 * @param db - The database instance for tools that require persistence.
 * @returns A configured ToolRegistry instance.
 */
export function initializeTools(db: OpenCodeDatabase): ToolRegistry {
  const toolRegistry = new ToolRegistry(db)

  // Filesystem Tools
  toolRegistry.register(new ReadTool())
  toolRegistry.register(new ListTool())
  toolRegistry.register(new WriteTool())
  toolRegistry.register(new EditTool())
  toolRegistry.register(new MultiEditTool())
  
  // Search Tools
  toolRegistry.register(new GrepTool())
  toolRegistry.register(new GlobTool())
  toolRegistry.register(new WebFetchTool())
  toolRegistry.register(new WebSearchTool())

  // Execution Tools
  toolRegistry.register(new BashTool())
  
  // Management Tools
  toolRegistry.register(new TodoTool(db))

  return toolRegistry
}

/**
 * Get default tool execution context
 */
export function createToolContext(options: {
  sessionId?: string
  userId?: string
  workingDirectory?: string
  timeout?: number
}): {
  sessionId?: string
  userId?: string
  workingDirectory: string
  timeout: number
} {
  return {
    sessionId: options.sessionId,
    userId: options.userId,
    workingDirectory: options.workingDirectory || process.cwd(),
    timeout: options.timeout || parseInt(process.env.TOOL_EXECUTION_TIMEOUT_SECONDS || '30') * 1000
  }
}

/**
 * Tool execution safety wrapper with timeout
 */
export async function executeToolSafely<T>(
  fn: () => Promise<T>,
  timeoutMs: number = 30000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Tool execution timeout after ${timeoutMs}ms`))
    }, timeoutMs)

    fn()
      .then(result => {
        clearTimeout(timer)
        resolve(result)
      })
      .catch(error => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

/**
 * Validates that the necessary environment (e.g., CLI tools) for all
 * registered tools is available.
 */
export function validateToolEnvironment() {
  // TODO: Implement checks for tools like 'ripgrep'
  return {
    valid: true,
    errors: []
  }
} 