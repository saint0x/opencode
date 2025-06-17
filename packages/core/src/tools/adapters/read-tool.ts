import { readFileSync } from 'fs'
import { 
  Result, 
  ok, 
  err, 
  ErrorCode, 
  fileSystemError,
  type OpenCodeError 
} from '@opencode/types'
import type { 
  Tool, 
  ToolExecutionContext, 
  ToolExecutionResult 
} from '../registry.js'
import { 
  ToolParam, 
  createToolDefinition, 
  createToolSuccess, 
  createToolError,
  FileSystemHelpers,
  ToolTimer,
  extractParameters,
  withToolExecution
} from '../helpers.js'

export class ReadTool implements Tool {
  definition = createToolDefinition(
    'read',
    'Read the contents of a file with optional line range selection',
    'filesystem',
    [
      ToolParam.filePath('path', 'Path to the file to read (relative to workspace root)'),
      ToolParam.lineNumber('start_line', 'Starting line number (1-indexed, optional)'),
      ToolParam.lineNumber('end_line', 'Ending line number (1-indexed, optional)')
    ],
    [
      {
        description: 'Read entire file',
        parameters: { path: 'src/index.ts' }
      },
      {
        description: 'Read specific lines',
        parameters: { path: 'src/index.ts', start_line: 10, end_line: 20 }
      }
    ]
  )

  async execute(
    parameters: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<Result<ToolExecutionResult, OpenCodeError>> {
    return withToolExecution(context, async () => {
      const timer = new ToolTimer()
      
      // Extract and validate parameters
      const paramsResult = extractParameters<{
        path: string
        start_line?: number
        end_line?: number
      }>(parameters, {
        path: { type: 'string', required: true },
        start_line: { type: 'number', required: false },
        end_line: { type: 'number', required: false }
      })
      
      if (!paramsResult.success) {
        return createToolError(paramsResult.error.message, {}, timer.elapsed())
      }
      
      const { path, start_line, end_line } = paramsResult.data
      
      // Validate workspace path
      const pathResult = FileSystemHelpers.validateWorkspacePath(path, context.workingDirectory)
      if (!pathResult.success) {
        return createToolError(pathResult.error.message, { path }, timer.elapsed())
      }
      
      const fullPath = pathResult.data
      
      // Check file size limits
      const sizeResult = FileSystemHelpers.validateFileSize(fullPath)
      if (!sizeResult.success) {
        return createToolError(sizeResult.error.message, { path }, timer.elapsed())
      }

      try {
        // Read file content
        const content = readFileSync(fullPath, 'utf-8')
        const lines = content.split('\n')
        
        let output = content
        let metadata: Record<string, any> = {
          file_path: path,
          total_lines: lines.length,
          file_size: require('fs').statSync(fullPath).size,
          encoding: 'utf-8',
          file_size_formatted: FileSystemHelpers.formatFileSize(require('fs').statSync(fullPath).size)
        }

        // Handle line range if specified
        if (start_line !== undefined || end_line !== undefined) {
          const startIdx = Math.max(0, (start_line || 1) - 1)
          const endIdx = Math.min(lines.length, end_line || lines.length)
          
          if (startIdx >= lines.length) {
            return createToolError(
              `Start line ${start_line} exceeds file length (${lines.length} lines)`,
              { path, start_line, total_lines: lines.length },
              timer.elapsed()
            )
          }

          const selectedLines = lines.slice(startIdx, endIdx)
          output = selectedLines.join('\n')
          
          metadata = {
            ...metadata,
            lines_read: selectedLines.length,
            start_line: startIdx + 1,
            end_line: endIdx,
            is_partial: true
          }
        }

        return createToolSuccess(output, metadata, timer.elapsed())

      } catch (error: any) {
        if (error.code === 'ENOENT') {
          return createToolError(`File not found: ${path}`, { path }, timer.elapsed())
        }
        
        if (error.code === 'EACCES') {
          return createToolError(`Permission denied: ${path}`, { path }, timer.elapsed())
        }

        return createToolError(
          `Failed to read file: ${error.message}`, 
          { path, error_code: error.code }, 
          timer.elapsed()
        )
      }
    }).then(result => {
      if (result.success) {
        return ok(result.data)
      } else {
        return result
      }
    })
  }
} 