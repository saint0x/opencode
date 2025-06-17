import {
  Tool,
  type ToolExecutionContext,
  type ToolExecutionResult,
} from '../registry'
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
  createToolSuccess,
} from '../helpers'
import { promises as fs } from 'fs'
import { createTwoFilesPatch } from 'diff'

interface EditOperation {
  from: string
  to: string
  all?: boolean
}

export class MultiEditTool implements Tool {
  definition = createToolDefinition(
    'multiedit',
    'Perform a series of edits on a single file.',
    'filesystem',
    [
      { name: 'path', type: 'string', description: 'The relative path to the file to edit.', required: true },
      { name: 'edits', type: 'array', description: 'An array of edit operations to perform.', required: true },
    ],
    [
      {
        description: 'In `main.py`, replace `foo` with `bar` and `old` with `new`.',
        parameters: { 
          path: 'main.py', 
          edits: [
            { from: 'foo', to: 'bar' },
            { from: 'old', to: 'new' },
          ]
        },
      },
    ]
  )

  async execute(
    parameters: { path: string; edits: EditOperation[] },
    context: ToolExecutionContext
  ): Promise<Result<ToolExecutionResult, OpenCodeError>> {
    return withToolExecution(context, async () => {
      const { path, edits } = parameters
      const safePath = FileSystemHelpers.validateWorkspacePath(path, context.workingDirectory)
      if (!safePath.success) return createToolError(safePath.error.message)

      try {
        const originalContent = await fs.readFile(safePath.data, 'utf-8')
        let currentContent = originalContent

        for (const edit of edits) {
          if (edit.all) {
            currentContent = currentContent.replaceAll(edit.from, edit.to)
          } else {
            currentContent = currentContent.replace(edit.from, edit.to)
          }
        }
        
        if (originalContent === currentContent) {
          return createToolError(`No changes were made.`)
        }

        await fs.writeFile(safePath.data, currentContent, 'utf-8')

        const diff = createTwoFilesPatch(path, path, originalContent, currentContent)

        return createToolSuccess(
          `Successfully applied ${edits.length} edits to ${path}.\n\n${diff}`,
          { path, diff, editCount: edits.length }
        )
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          return createToolError(`File not found at path: ${path}`)
        }
        return createToolError(`Failed to edit file: ${error.message}`)
      }
    })
  }
} 