import {
  ToolRegistry,
  ToolExecutionContext,
  ToolExecutionResult,
} from './registry.js'
import { Result } from '@opencode/types'

interface QueuedToolCall {
  toolName: string
  parameters: Record<string, any>
  context: ToolExecutionContext
  resolve: (result: Result<ToolExecutionResult, any>) => void
  priority: number
}

export class ExecutionQueue {
  private queue: QueuedToolCall[] = []
  private isProcessing = false
  private maxConcurrent = 1 // Default to serial execution

  constructor(
    private toolRegistry: ToolRegistry,
    options?: { maxConcurrent?: number }
  ) {
    if (options?.maxConcurrent) {
      this.maxConcurrent = options.maxConcurrent
    }
  }

  add(
    toolName: string,
    parameters: Record<string, any>,
    context: ToolExecutionContext,
    priority: number = 0
  ): Promise<Result<ToolExecutionResult, any>> {
    return new Promise(resolve => {
      this.queue.push({
        toolName,
        parameters,
        context,
        resolve,
        priority,
      })
      // Sort by priority (higher first)
      this.queue.sort((a, b) => b.priority - a.priority)
      this.processQueue()
    })
  }

  private async processQueue() {
    if (this.isProcessing) return
    this.isProcessing = true

    while (this.queue.length > 0) {
      // For now, we process one at a time. Concurrency will be added next.
      const call = this.queue.shift()
      if (call) {
        const result = await this.toolRegistry.executeToolTracked(
          call.toolName,
          call.parameters,
          call.context
        )
        call.resolve(result)
      }
    }

    this.isProcessing = false
  }

  getQueueSize(): number {
    return this.queue.length
  }
} 