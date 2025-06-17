import type { OpenCodeDatabase } from '../database/client.js'
import { ToolRegistry } from './registry.js'
import { ReadTool } from './adapters/read-tool.js'
import { ListTool } from './adapters/list-tool.js'
import { WriteTool } from './adapters/write-tool.js'
import { EditTool } from './adapters/edit-tool.js'
import { GrepTool } from './adapters/grep-tool.js'
import { BashTool } from './adapters/bash-tool.js'
import { TodoTool } from './adapters/todo-tool.js'
// TODO: Add more tool imports as they're created

/**
 * Initialize and register all available tools
 */
export function initializeTools(db: OpenCodeDatabase): ToolRegistry {
  const registry = new ToolRegistry(db)
  
  // Filesystem tools
  registry.register(new ReadTool())
  registry.register(new ListTool())
  registry.register(new WriteTool())
  registry.register(new EditTool())
  
  // Search tools
  registry.register(new GrepTool())
  
  // Execution tools
  registry.register(new BashTool())
  
  // Management tools
  if (db) {
    registry.register(new TodoTool(db))
  }
  
  // TODO: Register additional tools as they're implemented:
  // registry.register(new BashTool())
  
  return registry
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
 * Validate tool execution environment
 */
export function validateToolEnvironment(): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  // Check file size limits
  const maxFileSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB || '10')
  if (maxFileSizeMB < 1 || maxFileSizeMB > 100) {
    errors.push(`MAX_FILE_SIZE_MB must be between 1 and 100, got: ${maxFileSizeMB}`)
  }
  
  // Check timeout settings
  const timeoutSeconds = parseInt(process.env.TOOL_EXECUTION_TIMEOUT_SECONDS || '30')
  if (timeoutSeconds < 1 || timeoutSeconds > 300) {
    errors.push(`TOOL_EXECUTION_TIMEOUT_SECONDS must be between 1 and 300, got: ${timeoutSeconds}`)
  }
  
  // Check concurrency limits
  const maxConcurrent = parseInt(process.env.TOOL_MAX_CONCURRENT_EXECUTIONS || '5')
  if (maxConcurrent < 1 || maxConcurrent > 20) {
    errors.push(`TOOL_MAX_CONCURRENT_EXECUTIONS must be between 1 and 20, got: ${maxConcurrent}`)
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
} 