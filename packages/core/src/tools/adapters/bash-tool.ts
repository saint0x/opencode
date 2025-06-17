import { exec } from 'child_process'
import {
  Tool,
  ToolExecutionContext,
  ToolExecutionResult,
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
  createToolSuccess,
  createToolError,
  ToolTimer,
  extractParameters,
  withToolExecution,
} from '../helpers'

export class BashTool implements Tool {
  definition = createToolDefinition(
    'bash',
    'Execute a shell command in the workspace. SECURITY: This tool has full access to the workspace and can be dangerous. Use with caution.',
    'execution',
    [
      ToolParam.content('command', 'The command to execute.'),
      ToolParam.lineNumber(
        'timeout',
        'Timeout in seconds for the command.',
        false
      ),
    ],
    [
      {
        description: 'List all files in the current directory.',
        parameters: { command: 'ls -la' },
      },
      {
        description: 'Run a script with a 10-second timeout.',
        parameters: { command: './run.sh', timeout: 10 },
      },
    ]
  )

  async execute(
    parameters: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<Result<ToolExecutionResult, OpenCodeError>> {
    const customTimeout = parameters.timeout
      ? parameters.timeout * 1000
      : context.timeout

    return withToolExecution({ ...context, timeout: customTimeout }, async () => {
      const timer = new ToolTimer()

      const paramsResult = extractParameters<{
        command: string
      }>(parameters, {
        command: { type: 'string', required: true },
      })

      if (!paramsResult.success) {
        return createToolError(paramsResult.error.message, {}, timer.elapsed())
      }
      const { command } = paramsResult.data

      return new Promise(resolve => {
        exec(
          command,
          { cwd: context.workingDirectory, timeout: customTimeout },
          (error, stdout, stderr) => {
            if (error) {
              if (error.signal === 'SIGTERM') {
                resolve(
                  createToolError(
                    `Command timed out after ${customTimeout}ms.`,
                    { command, stdout, stderr },
                    timer.elapsed()
                  )
                )
              } else {
                resolve(
                  createToolError(
                    `Command failed with exit code ${error.code}: ${stderr || error.message}`,
                    { command, stdout, stderr, exit_code: error.code },
                    timer.elapsed()
                  )
                )
              }
              return
            }

            resolve(
              createToolSuccess(
                stdout,
                { command, stderr },
                timer.elapsed()
              )
            )
          }
        )
      })
    })
  }
} 