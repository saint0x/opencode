import { readFileSync, writeFileSync } from 'fs'
import {
  Tool,
  ToolExecutionContext,
  ToolExecutionResult,
} from '../registry.js'
import {
  Result,
  ok,
  err,
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

export class EditTool implements Tool {
  definition = createToolDefinition(
    'edit',
    'Edit a file by searching for a string and replacing it with new content.',
    'filesystem',
    [
      ToolParam.filePath('path', 'The file to edit.'),
      ToolParam.content('search', 'The exact content to find.'),
      ToolParam.content('replace', 'The content to replace the search string with.'),
    ],
    [
      {
        description: 'Replace "foo" with "bar" in `main.py`.',
        parameters: {
          path: 'main.py',
          search: 'foo',
          replace: 'bar',
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
        search: string
        replace: string
      }>(parameters, {
        path: { type: 'string', required: true },
        search: { type: 'string', required: true },
        replace: { type: 'string', required: true },
      })

      if (!paramsResult.success) {
        return createToolError(paramsResult.error.message, {}, timer.elapsed())
      }

      const { path, search, replace } = paramsResult.data

      const pathResult = FileSystemHelpers.validateWorkspacePath(
        path,
        context.workingDirectory
      )
      if (!pathResult.success) {
        return createToolError(pathResult.error.message, { path }, timer.elapsed())
      }
      const fullPath = pathResult.data

      try {
        const originalContent = readFileSync(fullPath, 'utf-8')
        if (!originalContent.includes(search)) {
            return createToolError(
                `Search string not found in ${path}. Edit failed.`,
                { path, search },
                timer.elapsed()
            )
        }

        const newContent = originalContent.replace(search, replace)
        writeFileSync(fullPath, newContent, 'utf-8')

        return createToolSuccess(
          `Successfully edited ${path}.`,
          { file_path: path, search, replace },
          timer.elapsed()
        )
      } catch (error: any) {
        if (error.code === 'ENOENT') {
            return createToolError(`File not found: ${path}`, { path }, timer.elapsed())
        }
        return createToolError(
          `Failed to edit file: ${error.message}`,
          { path, error_code: error.code },
          timer.elapsed()
        )
      }
    }).then(result => {
      if (result.success) {
        return ok(result.data)
      } else {
        const toolExecResult = createToolError(result.error.message, result.error.context)
        return ok(toolExecResult)
      }
    })
  }
} 