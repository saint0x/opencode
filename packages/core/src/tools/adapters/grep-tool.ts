import { glob } from 'glob'
import { readFileSync } from 'fs'
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

export class GrepTool implements Tool {
  definition = createToolDefinition(
    'grep',
    'Search for a pattern across files in the workspace using glob patterns.',
    'search',
    [
      ToolParam.content('pattern', 'The literal string or regex pattern to search for.'),
      ToolParam.content(
        'glob',
        'A glob pattern specifying which files to search (e.g., "src/**/*.ts").'
      ),
    ],
    [
      {
        description: 'Search for "import React" in all TypeScript files.',
        parameters: {
          pattern: 'import React',
          glob: 'src/**/*.ts',
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
        pattern: string
        glob: string
      }>(parameters, {
        pattern: { type: 'string', required: true },
        glob: { type: 'string', required: true },
      })

      if (!paramsResult.success) {
        return createToolError(paramsResult.error.message, {}, timer.elapsed())
      }

      const { pattern, glob: globPattern } = paramsResult.data

      try {
        const files = await glob(globPattern, {
          cwd: context.workingDirectory,
          nodir: true,
          dot: true,
          ignore: ['node_modules/**', '.git/**'],
        })

        if (files.length === 0) {
          return createToolSuccess(
            `No files found matching glob pattern: ${globPattern}`,
            { pattern, glob: globPattern, matches: [] },
            timer.elapsed()
          )
        }

        const matches: Array<{ file: string; line: number; text: string }> = []
        const searchRegex = new RegExp(pattern, 'g')

        for (const file of files) {
          const pathResult = FileSystemHelpers.validateWorkspacePath(
            file,
            context.workingDirectory
          )
          if (!pathResult.success) continue // Skip files outside workspace

          const content = readFileSync(pathResult.data, 'utf-8')
          const lines = content.split('\n')
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].match(searchRegex)) {
              matches.push({
                file,
                line: i + 1,
                text: lines[i].trim(),
              })
            }
          }
        }
        
        const output = matches.map(m => `${m.file}:${m.line}: ${m.text}`).join('\n')
        const summary = `Found ${matches.length} matches in ${files.length} files.`

        return createToolSuccess(
            `${summary}\n${output}`,
            { pattern, glob: globPattern, match_count: matches.length, file_count: files.length, matches },
            timer.elapsed()
        )
      } catch (error: any) {
        return createToolError(
          `Grep failed: ${error.message}`,
          { pattern, glob: globPattern, error_code: error.code },
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