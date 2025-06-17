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

export class EditTool implements Tool {
  definition = createToolDefinition(
    'edit',
    'Edit a file in the workspace by replacing a string.',
    'filesystem',
    [
      { name: 'path', type: 'string', description: 'The relative path to the file to edit.', required: true },
      { name: 'from', type: 'string', description: 'The exact string to be replaced.', required: true },
      { name: 'to', type: 'string', description: 'The string to replace it with.', required: true },
      { name: 'all', type: 'boolean', description: 'Set to true to replace all occurrences.', required: false },
    ],
    [
      {
        description: 'Replace the first occurrence of `foo` with `bar` in `main.py`.',
        parameters: { path: 'main.py', from: 'foo', to: 'bar' },
      },
    ]
  )

  async execute(
    parameters: { path: string; from: string; to: string; all?: boolean },
    context: ToolExecutionContext
  ): Promise<Result<ToolExecutionResult, OpenCodeError>> {
    return withToolExecution(context, async () => {
      const { path, from, to, all } = parameters
      const safePath = FileSystemHelpers.validateWorkspacePath(path, context.workingDirectory)
      if (!safePath.success) return createToolError(safePath.error.message)

      try {
        const originalContent = await fs.readFile(safePath.data, 'utf-8')
        let newContent = ''

        if (all) {
          newContent = originalContent.replaceAll(from, to)
        } else {
          const index = originalContent.indexOf(from)
          if (index === -1) {
            return createToolError(`The 'from' string was not found in the file.`)
          }
          newContent = originalContent.replace(from, to)
        }

        if (originalContent === newContent) {
          return createToolError(`No changes were made. Does the 'from' string exist?`)
        }

        await fs.writeFile(safePath.data, newContent, 'utf-8')

        const diff = createTwoFilesPatch(path, path, originalContent, newContent)

        return createToolSuccess(`Successfully edited ${path}.\n\n${diff}`, { path, diff })
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          return createToolError(`File not found at path: ${path}`)
        }
        return createToolError(`Failed to edit file: ${error.message}`)
      }
    })
  }
} 