import { 
  Result, 
  ok, 
  err, 
  ErrorCode, 
  toolError,
  fileSystemError,
  type OpenCodeError 
} from '@opencode/types'
import type { 
  ToolDefinition, 
  ToolParameter, 
  ToolExecutionResult,
  ToolExecutionContext
} from './registry.js'

/**
 * Helper to create tool parameters with common patterns
 */
export const ToolParam = {
  /**
   * File path parameter with standard validation
   */
  filePath(name: string = 'path', description?: string): ToolParameter {
    return {
      name,
      type: 'string',
      description: description || 'File path relative to workspace root',
      required: true
    }
  },

  /**
   * Optional directory path parameter
   */
  directoryPath(name: string = 'path', required: boolean = false): ToolParameter {
    return {
      name,
      type: 'string',
      description: 'Directory path relative to workspace root',
      required,
      default: required ? undefined : '.'
    }
  },

  /**
   * Line number parameter
   */
  lineNumber(name: string, description: string, required: boolean = false): ToolParameter {
    return {
      name,
      type: 'number',
      description,
      required
    }
  },

  /**
   * Boolean flag parameter
   */
  flag(name: string, description: string, defaultValue: boolean = false): ToolParameter {
    return {
      name,
      type: 'boolean',
      description,
      required: false,
      default: defaultValue
    }
  },

  /**
   * Text content parameter
   */
  content(name: string = 'content', description?: string): ToolParameter {
    return {
      name,
      type: 'string',
      description: description || 'Text content',
      required: true
    }
  },

  /**
   * Array parameter
   */
  array(name: string, description: string, required: boolean = false): ToolParameter {
    return {
      name,
      type: 'array',
      description,
      required
    }
  }
}

/**
 * Helper to create tool definitions with less boilerplate
 */
export function createToolDefinition(
  name: string,
  description: string,
  category: ToolDefinition['category'],
  parameters: ToolParameter[],
  examples?: ToolDefinition['examples']
): ToolDefinition {
  return {
    name,
    description,
    category,
    parameters,
    examples: examples || []
  }
}

/**
 * Helper to create successful tool results
 */
export function createToolSuccess(
  output: string,
  metadata: Record<string, any> = {},
  duration?: number
): ToolExecutionResult {
  return {
    success: true,
    output,
    metadata,
    duration: duration || 0,
    timestamp: new Date().toISOString()
  }
}

/**
 * Helper to create tool error results
 */
export function createToolError(
  error: string,
  metadata: Record<string, any> = {},
  duration?: number
): ToolExecutionResult {
  return {
    success: false,
    output: '',
    error,
    metadata,
    duration: duration || 0,
    timestamp: new Date().toISOString()
  }
}

/**
 * Common file system validation helpers
 */
export const FileSystemHelpers = {
  /**
   * Validate workspace path security
   */
  validateWorkspacePath(path: string, workspaceRoot: string): Result<string, OpenCodeError> {
    const { resolve, relative } = require('path')
    
    try {
      const fullPath = resolve(workspaceRoot, path)
      const relativePath = relative(workspaceRoot, fullPath)
      
      if (relativePath.startsWith('..')) {
        return err(fileSystemError(
          ErrorCode.FILE_ACCESS_DENIED,
          `Access denied: Cannot access files outside workspace: ${path}`
        ))
      }
      
      return ok(fullPath)
    } catch (error) {
      return err(fileSystemError(
        ErrorCode.VALIDATION_ERROR,
        `Invalid path: ${path}`,
        { path }
      ))
    }
  },

  /**
   * Check file size limits
   */
  validateFileSize(filePath: string, maxSizeMB?: number): Result<void, OpenCodeError> {
    const { statSync } = require('fs')
    const maxSize = (maxSizeMB || parseInt(process.env.MAX_FILE_SIZE_MB || '10')) * 1024 * 1024
    
    try {
      const stats = statSync(filePath)
      if (stats.size > maxSize) {
        return err(fileSystemError(
          ErrorCode.FILE_TOO_LARGE,
          `File too large: ${(stats.size / 1024 / 1024).toFixed(2)}MB > ${maxSize / 1024 / 1024}MB limit`
        ))
      }
      return ok(undefined)
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return err(fileSystemError(ErrorCode.FILE_NOT_FOUND, `File not found: ${filePath}`))
      }
      return err(fileSystemError(ErrorCode.INTERNAL_ERROR, `Failed to check file size: ${error.message}`))
    }
  },

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}M`
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}G`
  }
}

/**
 * Performance timing helper
 */
export class ToolTimer {
  private startTime: number

  constructor() {
    this.startTime = Date.now()
  }

  elapsed(): number {
    return Date.now() - this.startTime
  }

  reset(): void {
    this.startTime = Date.now()
  }
}

/**
 * Parameter extraction with type safety
 */
export function extractParameters<T extends Record<string, any>>(
  parameters: Record<string, any>,
  schema: { [K in keyof T]: { type: string; required?: boolean; default?: T[K] } }
): Result<T, OpenCodeError> {
  const result: Partial<T> = {}
  
  for (const [key, config] of Object.entries(schema)) {
    const value = parameters[key]
    
    if (value === undefined) {
      if (config.required && config.default === undefined) {
        return err(toolError(
          ErrorCode.TOOL_INVALID_PARAMS,
          `Missing required parameter: ${key}`
        ))
      }
      if (config.default !== undefined) {
        (result as any)[key] = config.default
      }
      continue
    }
    
    // Basic type validation
    const expectedType = config.type
    if (expectedType === 'string' && typeof value !== 'string') {
      return err(toolError(ErrorCode.TOOL_INVALID_PARAMS, `Parameter ${key} must be a string`))
    }
    if (expectedType === 'number' && typeof value !== 'number') {
      return err(toolError(ErrorCode.TOOL_INVALID_PARAMS, `Parameter ${key} must be a number`))
    }
    if (expectedType === 'boolean' && typeof value !== 'boolean') {
      return err(toolError(ErrorCode.TOOL_INVALID_PARAMS, `Parameter ${key} must be a boolean`))
    }
    
    (result as any)[key] = value
  }
  
  return ok(result as T)
}

/**
 * Common tool execution wrapper with error handling
 */
export async function withToolExecution<T>(
  context: ToolExecutionContext,
  fn: () => Promise<T>
): Promise<Result<T, OpenCodeError>> {
  const timeout = context.timeout || parseInt(process.env.TOOL_EXECUTION_TIMEOUT_SECONDS || '30') * 1000
  
  try {
    const result = await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Tool execution timeout')), timeout)
      })
    ])
    
    return ok(result)
  } catch (error: any) {
    if (error.message === 'Tool execution timeout') {
      return err(toolError(ErrorCode.TOOL_TIMEOUT, `Tool execution timed out after ${timeout}ms`))
    }
    
    return err(toolError(
      ErrorCode.TOOL_EXECUTION_FAILED,
      `Tool execution failed: ${error.message}`,
      { originalError: error }
    ))
  }
} 