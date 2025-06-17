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
import { spawn } from 'child_process'

export class GrepTool implements Tool {
  definition = createToolDefinition(
    'grep',
    'Search for a pattern across files in the workspace using ripgrep.',
    'search',
    [
      { name: 'pattern', type: 'string', description: 'The regex pattern to search for.', required: true },
      { name: 'path', type: 'string', description: 'A specific file or directory to search within. Defaults to the entire workspace.', required: false },
    ],
    [
      {
        description: 'Search for "import React" in all files.',
        parameters: { pattern: 'import React' },
      },
      {
        description: 'Search for "useState" in the `src` directory.',
        parameters: { pattern: 'useState', path: 'src' },
      },
    ]
  )

  async execute(
    parameters: { pattern: string; path?: string },
    context: ToolExecutionContext
  ): Promise<Result<ToolExecutionResult, OpenCodeError>> {
    return withToolExecution(context, async () => {
      const { pattern, path } = parameters
      const searchPath = path
        ? FileSystemHelpers.validateWorkspacePath(path, context.workingDirectory)
        : ok(context.workingDirectory)

      if (!searchPath.success) return createToolError(searchPath.error.message)

      return new Promise((resolve) => {
        const rg = spawn('rg', ['--json', pattern, searchPath.data])
        let outputJson = ''
        let errorOutput = ''

        rg.stdout.on('data', (data) => {
          outputJson += data.toString()
        })
        rg.stderr.on('data', (data) => {
          errorOutput += data.toString()
        })
        
        rg.on('close', (code) => {
          if (code === 0 && outputJson) {
            const matches = outputJson
              .trim()
              .split('\n')
              .map((line) => JSON.parse(line))
              .filter((m) => m.type === 'match')
              
            const output = matches.map(m => `${m.data.path.text}:${m.data.line_number}: ${m.data.lines.text.trim()}`).join('\n')
            
            resolve(createToolSuccess(output, {
              pattern,
              path,
              matches: matches.length,
            }))
          } else if (code === 1) {
            resolve(createToolSuccess('No matches found.', { pattern, path, matches: 0 }))
          } else {
            resolve(createToolError(
              `ripgrep exited with code ${code}: ${errorOutput || 'Unknown error'}`
            ))
          }
        })

        rg.on('error', (err) => {
          resolve(
            createToolError(`Failed to start ripgrep. Is it installed and in your PATH? Error: ${err.message}`)
          )
        })
      })
    })
  }
} 