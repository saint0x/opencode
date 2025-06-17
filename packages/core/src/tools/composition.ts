import { 
  Result, 
  ok, 
  err, 
  ErrorCode, 
  toolError,
  type OpenCodeError 
} from '@opencode/types'
import type { 
  Tool, 
  ToolExecutionContext, 
  ToolExecutionResult,
  ToolRegistry
} from './registry.js'

/**
 * Tool composition step in a workflow
 */
export interface ToolStep {
  toolName: string
  parameters: Record<string, any> | ((previousResults: ToolExecutionResult[]) => Record<string, any>)
  condition?: (previousResults: ToolExecutionResult[]) => boolean
  onError?: 'stop' | 'continue' | 'retry'
  retryCount?: number
}

/**
 * Tool workflow execution result
 */
export interface WorkflowResult {
  success: boolean
  steps: Array<{
    step: ToolStep
    result: ToolExecutionResult
    index: number
  }>
  totalDuration: number
  error?: string
}

/**
 * Tool composition pipeline for chaining multiple tools
 */
export class ToolPipeline {
  private steps: ToolStep[] = []
  private registry: ToolRegistry

  constructor(registry: ToolRegistry) {
    this.registry = registry
  }

  /**
   * Add a tool step to the pipeline
   */
  addStep(step: ToolStep): this {
    this.steps.push(step)
    return this
  }

  /**
   * Add multiple steps at once
   */
  addSteps(steps: ToolStep[]): this {
    this.steps.push(...steps)
    return this
  }

  /**
   * Execute the entire pipeline
   */
  async execute(context: ToolExecutionContext): Promise<Result<WorkflowResult, OpenCodeError>> {
    const startTime = Date.now()
    const executedSteps: WorkflowResult['steps'] = []
    const previousResults: ToolExecutionResult[] = []

    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i]

      // Check condition if specified
      if (step.condition && !step.condition(previousResults)) {
        continue
      }

      // Resolve parameters (can be static or function of previous results)
      const parameters = typeof step.parameters === 'function' 
        ? step.parameters(previousResults) 
        : step.parameters

      let attempts = 0
      const maxAttempts = (step.retryCount || 0) + 1
      let stepResult: ToolExecutionResult | null = null

      while (attempts < maxAttempts) {
        attempts++

        const result = await this.registry.executeToolTracked(
          step.toolName,
          parameters,
          context
        )

        if (result.success) {
          stepResult = result.data
          break
        } else {
          // Handle error based on step configuration
          if (step.onError === 'continue' || (attempts < maxAttempts)) {
            if (attempts === maxAttempts) {
              stepResult = {
                success: false,
                output: '',
                error: result.error.message,
                metadata: { attempts, maxAttempts },
                duration: 0,
                timestamp: new Date().toISOString()
              }
            }
            continue
          } else {
            // Stop on error
            return err(result.error)
          }
        }
      }

      if (stepResult) {
        executedSteps.push({
          step,
          result: stepResult,
          index: i
        })
        previousResults.push(stepResult)

        // Stop if step failed and onError is 'stop'
        if (!stepResult.success && step.onError === 'stop') {
          break
        }
      }
    }

    const totalDuration = Date.now() - startTime
    const hasFailures = executedSteps.some(s => !s.result.success)

    return ok({
      success: !hasFailures,
      steps: executedSteps,
      totalDuration,
      error: hasFailures ? 'One or more steps failed' : undefined
    })
  }

  /**
   * Clear all steps
   */
  clear(): this {
    this.steps = []
    return this
  }

  /**
   * Get step count
   */
  getStepCount(): number {
    return this.steps.length
  }
}

/**
 * Tool dependency management
 */
export interface ToolDependency {
  toolName: string
  required: boolean
  version?: string
  alternatives?: string[]
}

export class ToolDependencyManager {
  private registry: ToolRegistry
  private dependencies: Map<string, ToolDependency[]> = new Map()

  constructor(registry: ToolRegistry) {
    this.registry = registry
  }

  /**
   * Register dependencies for a tool
   */
  registerDependencies(toolName: string, dependencies: ToolDependency[]): void {
    this.dependencies.set(toolName, dependencies)
  }

  /**
   * Check if all dependencies are satisfied for a tool
   */
  checkDependencies(toolName: string): Result<boolean, OpenCodeError> {
    const deps = this.dependencies.get(toolName)
    if (!deps) return ok(true) // No dependencies

    const missing: string[] = []
    const unavailable: string[] = []

    for (const dep of deps) {
      const tool = this.registry.getTool(dep.toolName)
      
      if (!tool) {
        if (dep.required) {
          // Check alternatives
          if (dep.alternatives) {
            const hasAlternative = dep.alternatives.some(alt => this.registry.getTool(alt))
            if (!hasAlternative) {
              missing.push(dep.toolName)
            }
          } else {
            missing.push(dep.toolName)
          }
        } else {
          unavailable.push(dep.toolName)
        }
      }
    }

    if (missing.length > 0) {
      return err(toolError(
        ErrorCode.TOOL_NOT_FOUND,
        `Missing required dependencies for ${toolName}: ${missing.join(', ')}`,
        { missing, unavailable }
      ))
    }

    return ok(true)
  }

  /**
   * Get dependency graph for a tool
   */
  getDependencyGraph(toolName: string): string[] {
    const visited = new Set<string>()
    const result: string[] = []

    const visit = (name: string) => {
      if (visited.has(name)) return
      visited.add(name)

      const deps = this.dependencies.get(name)
      if (deps) {
        for (const dep of deps) {
          if (this.registry.getTool(dep.toolName)) {
            visit(dep.toolName)
            result.push(dep.toolName)
          }
        }
      }
    }

    visit(toolName)
    return result
  }
}

/**
 * Helper functions for common tool compositions
 */
export const ToolCompositions = {
  /**
   * Read-then-process pattern
   */
  readAndProcess(
    filePath: string,
    processor: (content: string) => Record<string, any>
  ): ToolStep[] {
    return [
      {
        toolName: 'read',
        parameters: { path: filePath }
      },
      {
        toolName: 'process',
        parameters: (results) => {
          const readResult = results[results.length - 1]
          return processor(readResult.output)
        }
      }
    ]
  },

  /**
   * List-then-filter pattern
   */
  listAndFilter(
    directoryPath: string,
    filter: (files: any[]) => Record<string, any>
  ): ToolStep[] {
    return [
      {
        toolName: 'list',
        parameters: { path: directoryPath, recursive: true }
      },
      {
        toolName: 'filter',
        parameters: (results) => {
          const listResult = results[results.length - 1]
          // Parse the list output and apply filter
          return filter([]) // TODO: Parse list output
        }
      }
    ]
  },

  /**
   * Backup-then-modify pattern
   */
  backupAndModify(
    filePath: string,
    modifications: Record<string, any>
  ): ToolStep[] {
    return [
      {
        toolName: 'read',
        parameters: { path: filePath }
      },
      {
        toolName: 'write',
        parameters: { path: `${filePath}.backup`, content: (results: ToolExecutionResult[]) => results[0].output }
      },
      {
        toolName: 'edit',
        parameters: { path: filePath, ...modifications },
        onError: 'stop' // Don't continue if edit fails
      }
    ]
  }
}

/**
 * Factory function to create a new pipeline
 */
export function createPipeline(registry: ToolRegistry): ToolPipeline {
  return new ToolPipeline(registry)
}

/**
 * Factory function to create dependency manager
 */
export function createDependencyManager(registry: ToolRegistry): ToolDependencyManager {
  return new ToolDependencyManager(registry)
} 