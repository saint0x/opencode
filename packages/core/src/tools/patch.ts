import {
  Tool,
  type ToolExecutionContext,
  type ToolExecutionResult,
} from './registry'
import {
  Result,
  ok,
  err,
  type OpenCodeError,
} from '@opencode/types'
import {
  ToolParam,
  createToolDefinition,
  createToolError,
  withToolExecution,
  FileSystemHelpers,
  ToolTimer,
  createToolSuccess,
} from './helpers'
import { promises as fs } from 'fs'
import path from 'path'

interface PatchOperation {
  type: 'update' | 'add' | 'delete'
  filePath: string
  content?: string
}

export class PatchTool implements Tool {
  definition = createToolDefinition(
    'patch',
    'Apply a patch to a file. This is for making multiple complex changes to a file at once.',
    'filesystem',
    [
      ToolParam.content('patch', 'The patch content to apply.'),
    ],
    [
      {
        description: 'Apply a patch to `src/main.ts`.',
        parameters: { patch: '*** Update File: src/main.ts\n@@ -1,3 +1,3 @@\n- old line\n+ new line' },
      },
    ]
  )

  private parsePatch(patchText: string): PatchOperation[] {
    const operations: PatchOperation[] = []
    const lines = patchText.split('\n')
    let currentOp: PatchOperation | null = null
    let currentContent: string[] = []

    for (const line of lines) {
        if (line.startsWith('*** ')) {
            if (currentOp) {
                if (currentOp.type === 'add' || currentOp.type === 'update') {
                    currentOp.content = currentContent.join('\n')
                }
                operations.push(currentOp)
                currentContent = []
            }

            const parts = line.substring(4).split(':').map(s => s.trim())
            const type = parts[0].toLowerCase().split(' ')[0] as 'update' | 'add' | 'delete'
            const filePath = parts[1]
            currentOp = { type, filePath }
        } else if (currentOp) {
            currentContent.push(line)
        }
    }

    if (currentOp) {
        if (currentOp.type === 'add' || currentOp.type === 'update') {
            currentOp.content = currentContent.join('\n')
        }
        operations.push(currentOp)
    }

    return operations
  }

  async execute(
    parameters: { patch: string },
    context: ToolExecutionContext
  ): Promise<Result<ToolExecutionResult, OpenCodeError>> {
    return withToolExecution(context, async () => {
      const timer = new ToolTimer()
      try {
        const operations = this.parsePatch(parameters.patch)
        if (operations.length === 0) {
          return createToolError('Invalid or empty patch.', {}, timer.elapsed())
        }
        
        for (const op of operations) {
          const safePath = FileSystemHelpers.validateWorkspacePath(op.filePath, context.workingDirectory)
          if (!safePath.success) {
            return createToolError(`Invalid path in patch: ${op.filePath}`, {}, timer.elapsed())
          }

          if (op.type === 'delete') {
            await fs.unlink(safePath.data)
          } else if (op.content !== undefined) {
            await fs.mkdir(path.dirname(safePath.data), { recursive: true })
            await fs.writeFile(safePath.data, op.content, 'utf-8')
          }
        }
        
        return createToolSuccess(
          `Successfully applied patch affecting ${operations.length} file(s).`,
          { fileCount: operations.length, files: operations.map(o => o.filePath) },
          timer.elapsed()
        )
      } catch (error: any) {
        return createToolError(`Failed to apply patch: ${error.message}`, {}, timer.elapsed())
      }
    })
  }
}
