import { 
  Result, 
  ok, 
  err, 
  ErrorCode, 
  toolError,
  type OpenCodeError 
} from '@opencode/types'
import type { OpenCodeDatabase } from '../database/client.js'

export interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description: string
  required: boolean
  default?: any
}

export interface ToolDefinition {
  name: string
  description: string
  category: 'filesystem' | 'search' | 'execution' | 'intelligence' | 'management'
  parameters: ToolParameter[]
  examples: Array<{
    description: string
    parameters: Record<string, any>
  }>
}

export interface ToolExecutionContext {
  sessionId?: string
  userId?: string
  workingDirectory: string
  environment?: Record<string, string>
  timeout?: number
}

export interface ToolExecutionResult {
  success: boolean
  output: string
  error?: string
  metadata: Record<string, any>
  duration: number
  timestamp: string
}

export interface Tool {
  definition: ToolDefinition
  execute(
    parameters: Record<string, any>, 
    context: ToolExecutionContext
  ): Promise<Result<ToolExecutionResult, OpenCodeError>>
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map()
  private db?: OpenCodeDatabase

  constructor(db?: OpenCodeDatabase) {
    this.db = db
  }

  /**
   * Register a tool with the registry
   */
  register(tool: Tool): void {
    this.tools.set(tool.definition.name, tool)
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  /**
   * Get all registered tools
   */
  getAllTools(): Tool[] {
    return Array.from(this.tools.values())
  }

  /**
   * Get tool definitions for API responses
   */
  getToolDefinitions(): ToolDefinition[] {
    return this.getAllTools().map(tool => tool.definition)
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category: ToolDefinition['category']): Tool[] {
    return this.getAllTools().filter(tool => tool.definition.category === category)
  }

  /**
   * Execute a tool with full tracking and persistence
   */
  async executeToolTracked(
    toolName: string,
    parameters: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<Result<ToolExecutionResult, OpenCodeError>> {
    const tool = this.getTool(toolName)
    if (!tool) {
      return err(toolError(
        ErrorCode.TOOL_NOT_FOUND,
        `Tool not found: ${toolName}`
      ))
    }

    // Validate parameters
    const validationResult = this.validateParameters(tool.definition, parameters)
    if (!validationResult.success) return validationResult

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const startTime = Date.now()

    // Store execution start in database if available
    if (this.db && context.sessionId) {
      // Create a placeholder message for the tool execution
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const addMessageResult = this.db.addMessage({
        id: messageId,
        session_id: context.sessionId,
        role: 'system',
        content: `Executing tool: ${toolName}`,
        metadata: JSON.stringify({
          tool_execution_id: executionId,
          tool_name: toolName,
          parameters
        })
      })

      if (!addMessageResult.success) {
        console.warn('Failed to log tool execution start:', addMessageResult.error.message)
      }
    }

    try {
      // Execute the tool
      const result = await tool.execute(parameters, context)
      const duration = Date.now() - startTime

      if (!result.success) {
        // Log execution failure
        if (this.db && context.sessionId) {
          await this.logToolExecution(executionId, toolName, parameters, context, {
            success: false,
            output: '',
            error: result.error.message,
            metadata: { error_code: result.error.code },
            duration,
            timestamp: new Date().toISOString()
          })
        }
        return result
      }

      // Update duration in result
      result.data.duration = duration

      // Log successful execution
      if (this.db && context.sessionId) {
        await this.logToolExecution(executionId, toolName, parameters, context, result.data)
      }

      return result
    } catch (error) {
      const duration = Date.now() - startTime
      const errorResult: ToolExecutionResult = {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
        metadata: { unexpected_error: true },
        duration,
        timestamp: new Date().toISOString()
      }

      // Log unexpected failure
      if (this.db && context.sessionId) {
        await this.logToolExecution(executionId, toolName, parameters, context, errorResult)
      }

      return err(toolError(
        ErrorCode.TOOL_EXECUTION_FAILED,
        `Tool execution failed: ${error}`,
        { toolName, parameters }
      ))
    }
  }

  /**
   * Validate tool parameters against definition
   */
  private validateParameters(
    definition: ToolDefinition, 
    parameters: Record<string, any>
  ): Result<void, OpenCodeError> {
    for (const param of definition.parameters) {
      if (param.required && !(param.name in parameters)) {
        return err(toolError(
          ErrorCode.TOOL_INVALID_PARAMS,
          `Missing required parameter: ${param.name}`
        ))
      }

      if (param.name in parameters) {
        const value = parameters[param.name]
        const expectedType = param.type

        // Basic type checking
        if (expectedType === 'string' && typeof value !== 'string') {
          return err(toolError(
            ErrorCode.TOOL_INVALID_PARAMS,
            `Parameter ${param.name} must be a string`
          ))
        }
        if (expectedType === 'number' && typeof value !== 'number') {
          return err(toolError(
            ErrorCode.TOOL_INVALID_PARAMS,
            `Parameter ${param.name} must be a number`
          ))
        }
        if (expectedType === 'boolean' && typeof value !== 'boolean') {
          return err(toolError(
            ErrorCode.TOOL_INVALID_PARAMS,
            `Parameter ${param.name} must be a boolean`
          ))
        }
        if (expectedType === 'array' && !Array.isArray(value)) {
          return err(toolError(
            ErrorCode.TOOL_INVALID_PARAMS,
            `Parameter ${param.name} must be an array`
          ))
        }
        if (expectedType === 'object' && typeof value !== 'object') {
          return err(toolError(
            ErrorCode.TOOL_INVALID_PARAMS,
            `Parameter ${param.name} must be an object`
          ))
        }
      }
    }

    return ok(undefined)
  }

  /**
   * Log tool execution to database
   */
  private async logToolExecution(
    executionId: string,
    toolName: string,
    parameters: Record<string, any>,
    context: ToolExecutionContext,
    result: ToolExecutionResult
  ): Promise<void> {
    if (!this.db || !context.sessionId) return

    // Note: This would need to be implemented in the database client
    // For now, we'll log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`Tool execution logged: ${toolName}`, {
        executionId,
        success: result.success,
        duration: result.duration
      })
    }
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(): {
    totalTools: number
    categories: Record<string, number>
    averageExecutionTime?: number
  } {
    const tools = this.getAllTools()
    const categories = tools.reduce((acc, tool) => {
      acc[tool.definition.category] = (acc[tool.definition.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      totalTools: tools.length,
      categories
    }
  }
}

// Global tool registry instance
export const toolRegistry = new ToolRegistry() 