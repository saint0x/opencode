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
import path from 'path'

const MAX_READ_BYTES = 50 * 1024 // 50KB

export class ReadTool implements Tool {
  definition = createToolDefinition(
    'read',
    'Read the contents of a file in the workspace.',
    'filesystem',
    [
      { name: 'path', type: 'string', description: 'The relative path to the file to read.', required: true },
      { name: 'base64', type: 'boolean', description: 'Set to true to read the file as a base64 encoded string.', required: false },
    ],
    [
      {
        description: 'Read the contents of `src/index.ts`.',
        parameters: { path: 'src/index.ts' },
      },
    ]
  )

  async execute(
    parameters: { path: string; base64?: boolean },
    context: ToolExecutionContext
  ): Promise<Result<ToolExecutionResult, OpenCodeError>> {
    return withToolExecution(context, async () => {
      const safePath = FileSystemHelpers.validateWorkspacePath(
        parameters.path,
        context.workingDirectory
      )
      if (!safePath.success) return createToolError(safePath.error.message)

      try {
        const stats = await fs.stat(safePath.data)
        if (stats.isDirectory()) {
          return createToolError(`Path is a directory, not a file.`)
        }
        if (stats.size > MAX_READ_BYTES) {
          return createToolError(
            `File is too large (${stats.size} bytes). Maximum size is ${MAX_READ_BYTES} bytes.`
          )
        }

        const content = await fs.readFile(
          safePath.data,
          parameters.base64 ? 'base64' : 'utf-8'
        )
        const output = parameters.base64 ? `(Base64 content of ${path.basename(parameters.path)})` : content
        
        return createToolSuccess(
          output,
          {
            path: parameters.path,
            size: stats.size,
            base64: parameters.base64 ?? false,
          }
        )
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          return createToolError(`File not found at path: ${parameters.path}`)
        }
        return createToolError(`Failed to read file: ${error.message}`)
      }
    })
  }
} 