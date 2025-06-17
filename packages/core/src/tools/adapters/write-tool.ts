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

export class WriteTool implements Tool {
  definition = createToolDefinition(
    'write',
    'Write content to a file in the workspace, overwriting it if it exists.',
    'filesystem',
    [
      { name: 'path', type: 'string', description: 'The relative path to the file to write.', required: true },
      { name: 'content', type: 'string', description: 'The content to write to the file.', required: true },
      { name: 'base64', type: 'boolean', description: 'Set to true if the content is base64 encoded.', required: false },
    ],
    [
      {
        description: 'Write "hello world" to `hello.txt`.',
        parameters: { path: 'hello.txt', content: 'hello world' },
      },
    ]
  )

  async execute(
    parameters: { path: string; content: string; base64?: boolean },
    context: ToolExecutionContext
  ): Promise<Result<ToolExecutionResult, OpenCodeError>> {
    return withToolExecution(context, async () => {
      const safePath = FileSystemHelpers.validateWorkspacePath(
        parameters.path,
        context.workingDirectory
      )
      if (!safePath.success) return createToolError(safePath.error.message)

      try {
        const dir = path.dirname(safePath.data)
        await fs.mkdir(dir, { recursive: true })

        await fs.writeFile(
          safePath.data,
          parameters.content,
          parameters.base64 ? 'base64' : 'utf-8'
        )

        return createToolSuccess(
          `Successfully wrote to ${parameters.path}`,
          {
            path: parameters.path,
            size: Buffer.from(parameters.content).length,
          }
        )
      } catch (error: any) {
        return createToolError(`Failed to write file: ${error.message}`)
      }
    })
  }
} 