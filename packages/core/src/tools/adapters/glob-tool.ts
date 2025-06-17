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
import { glob } from 'glob'

export class GlobTool implements Tool {
  definition = createToolDefinition(
    'glob',
    'Find files and directories using glob patterns.',
    'search',
    [
      { name: 'pattern', type: 'string', description: 'The glob pattern to match (e.g., "src/**/*.ts").', required: true },
    ],
    [
      {
        description: 'Find all TypeScript files in the `src` directory.',
        parameters: { pattern: 'src/**/*.ts' },
      },
    ]
  )

  async execute(
    parameters: { pattern: string },
    context: ToolExecutionContext
  ): Promise<Result<ToolExecutionResult, OpenCodeError>> {
    return withToolExecution(context, async () => {
      try {
        const files = await glob(parameters.pattern, {
          cwd: context.workingDirectory,
          nodir: true,
          dot: true,
        })
        
        const output = files.join('\n')
        return createToolSuccess(
          output || 'No files found for pattern.',
          {
            pattern: parameters.pattern,
            count: files.length,
          }
        )
      } catch (error: any) {
        return createToolError(`Glob search failed: ${error.message}`)
      }
    })
  }
} 