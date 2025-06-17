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
import ignore from 'ignore'

export class ListTool implements Tool {
  definition = createToolDefinition(
    'list',
    'List files and directories in the workspace, similar to `ls -F`.',
    'filesystem',
    [
      { name: 'path', type: 'string', description: 'The directory path to list. Defaults to the current working directory.', required: false },
      { name: 'recursive', type: 'boolean', description: 'Set to true to list files recursively.', required: false },
    ],
    [
      {
        description: 'List contents of the `src` directory.',
        parameters: { path: 'src' },
      },
      {
        description: 'List all files recursively.',
        parameters: { path: '.', recursive: true },
      },
    ]
  )

  async execute(
    parameters: { path?: string; recursive?: boolean },
    context: ToolExecutionContext
  ): Promise<Result<ToolExecutionResult, OpenCodeError>> {
    const dirPath = parameters.path || '.'
    
    return withToolExecution(context, async () => {
      const safePath = FileSystemHelpers.validateWorkspacePath(
        dirPath,
        context.workingDirectory
      )
      if (!safePath.success) return createToolError(safePath.error.message)

      try {
        const stats = await fs.stat(safePath.data)
        if (!stats.isDirectory()) {
          return createToolError(`Path is not a directory.`)
        }

        const ig = ignore().add(await this.getIgnorePatterns(context.workingDirectory))

        const entries = await this.readDirRecursive(
          safePath.data,
          parameters.recursive ?? false,
          context.workingDirectory,
          ig
        )

        const output = entries.join('\n')
        return createToolSuccess(
          output.length > 0 ? output : `Directory is empty: ${dirPath}`,
          {
            path: dirPath,
            recursive: parameters.recursive ?? false,
            count: entries.length,
          }
        )
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          return createToolError(`Directory not found at path: ${dirPath}`)
        }
        return createToolError(`Failed to list directory: ${error.message}`)
      }
    })
  }

  private async getIgnorePatterns(workingDir: string): Promise<string[]> {
    const defaultIgnores = ['.git', 'node_modules', '.DS_Store']
    try {
      const ignoreContent = await fs.readFile(path.join(workingDir, '.gitignore'), 'utf-8')
      return [...defaultIgnores, ...ignoreContent.split('\n')]
    } catch {
      return defaultIgnores
    }
  }

  private async readDirRecursive(
    dir: string,
    recursive: boolean,
    baseDir: string,
    ig: any
  ): Promise<string[]> {
    const dirents = await fs.readdir(dir, { withFileTypes: true })
    const files: string[] = []

    for (const dirent of dirents) {
      const fullPath = path.join(dir, dirent.name)
      const relativePath = path.relative(baseDir, fullPath)

      if (ig.ignores(relativePath)) {
        continue
      }

      if (dirent.isDirectory()) {
        files.push(`${relativePath}/`)
        if (recursive) {
          files.push(...(await this.readDirRecursive(fullPath, true, baseDir, ig)))
        }
      } else {
        files.push(relativePath)
      }
    }
    return files
  }
} 