import { writeFileSync, existsSync } from 'fs'
import {
  Tool,
  ToolExecutionContext,
  ToolExecutionResult,
} from '../registry.js'
import {
  Result,
  ok,
  err,
  ErrorCode,
  fileSystemError,
  type OpenCodeError,
} from '@opencode/types'
import {
  ToolParam,
  createToolDefinition,
  createToolSuccess,
  createToolError,
  FileSystemHelpers,
  ToolTimer,
  extractParameters,
  withToolExecution,
} from '../helpers.js'

export class WriteTool implements Tool {
  definition = createToolDefinition(
    'write',
    'Write content to a file. By default, it will not overwrite existing files.',
    'filesystem',
    [
      ToolParam.filePath('path', 'Path to the file to write.'),
      ToolParam.content('content', 'The content to write to the file.'),
      ToolParam.flag(
        'overwrite',
        'Set to true to overwrite the file if it exists.',
        false
      ),
    ],
    [
      {
        description: 'Write "hello world" to a new file.',
        parameters: {
          path: 'hello.txt',
          content: 'hello world',
        },
      },
      {
        description: 'Overwrite an existing file with new content.',
        parameters: {
          path: 'hello.txt',
          content: 'new content',
          overwrite: true,
        },
      },
    ]
  )

  async execute(
    parameters: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<Result<ToolExecutionResult, OpenCodeError>> {
    return withToolExecution(context, async () => {
      const timer = new ToolTimer()

      const paramsResult = extractParameters<{
        path: string
        content: string
        overwrite?: boolean
      }>(parameters, {
        path: { type: 'string', required: true },
        content: { type: 'string', required: true },
        overwrite: { type: 'boolean', default: false },
      })

      if (!paramsResult.success) {
        return createToolError(paramsResult.error.message, {}, timer.elapsed())
      }

      const { path, content, overwrite } = paramsResult.data

      const pathResult = FileSystemHelpers.validateWorkspacePath(
        path,
        context.workingDirectory
      )
      if (!pathResult.success) {
        return createToolError(pathResult.error.message, { path }, timer.elapsed())
      }
      const fullPath = pathResult.data

      try {
        if (existsSync(fullPath) && !overwrite) {
          return createToolError(
            `File already exists at ${path}. Use 'overwrite: true' to overwrite it.`,
            { path, overwrite: false },
            timer.elapsed()
          )
        }

        writeFileSync(fullPath, content, 'utf-8')

        const metadata = {
          file_path: path,
          bytes_written: Buffer.byteLength(content, 'utf-8'),
        }
        return createToolSuccess(
          `Successfully wrote ${metadata.bytes_written} bytes to ${path}.`,
          metadata,
          timer.elapsed()
        )
      } catch (error: any) {
        return createToolError(
          `Failed to write to file: ${error.message}`,
          { path, error_code: error.code },
          timer.elapsed()
        )
      }
    }).then(result => {
      if (result.success) {
        return ok(result.data)
      } else {
        // Here, result.error is an OpenCodeError. We need to wrap the *data*
        // which is a ToolExecutionResult, not the error itself.
        const toolExecResult = createToolError(result.error.message, result.error.context)
        return ok(toolExecResult)
      }
    })
  }
} 