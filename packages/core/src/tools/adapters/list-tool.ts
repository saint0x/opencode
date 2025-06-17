import { readdirSync, statSync } from 'fs'
import { resolve, relative, join } from 'path'
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
  ToolDefinition, 
  ToolExecutionContext, 
  ToolExecutionResult 
} from '../registry.js'

interface FileInfo {
  name: string
  type: 'file' | 'directory'
  size: number
  modified: string
  permissions: string
}

export class ListTool implements Tool {
  definition: ToolDefinition = {
    name: 'list',
    description: 'List files and directories in a given path',
    category: 'filesystem',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: 'Path to list (relative to workspace root, defaults to current directory)',
        required: false,
        default: '.'
      },
      {
        name: 'show_hidden',
        type: 'boolean',
        description: 'Include hidden files and directories (starting with .)',
        required: false,
        default: false
      },
      {
        name: 'recursive',
        type: 'boolean',
        description: 'List files recursively in subdirectories',
        required: false,
        default: false
      },
      {
        name: 'max_depth',
        type: 'number',
        description: 'Maximum recursion depth (only used when recursive=true)',
        required: false,
        default: 3
      }
    ],
    examples: [
      {
        description: 'List current directory',
        parameters: { path: '.' }
      },
      {
        description: 'List with hidden files',
        parameters: { path: 'src', show_hidden: true }
      },
      {
        description: 'Recursive listing',
        parameters: { path: 'src', recursive: true, max_depth: 2 }
      }
    ]
  }

  async execute(
    parameters: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<Result<ToolExecutionResult, OpenCodeError>> {
    const startTime = Date.now()
    
    try {
      const { 
        path = '.', 
        show_hidden = false, 
        recursive = false, 
        max_depth = 3 
      } = parameters
      
      // Resolve path relative to working directory
      const fullPath = resolve(context.workingDirectory, path)
      const relativePath = relative(context.workingDirectory, fullPath)
      
      // Security check: prevent listing outside workspace
      if (relativePath.startsWith('..')) {
        return err(fileSystemError(
          ErrorCode.FILE_ACCESS_DENIED,
          `Access denied: Cannot list files outside workspace: ${path}`
        ))
      }

      // Get file/directory info
      const files = this.listDirectory(fullPath, show_hidden, recursive, max_depth, 0)
      
      // Format output
      const output = this.formatFileList(files, recursive)
      
      const metadata = {
        path: relativePath,
        total_items: files.length,
        directories: files.filter(f => f.type === 'directory').length,
        files: files.filter(f => f.type === 'file').length,
        show_hidden,
        recursive,
        max_depth: recursive ? max_depth : undefined
      }

      const duration = Date.now() - startTime
      
      return ok({
        success: true,
        output,
        metadata,
        duration,
        timestamp: new Date().toISOString()
      })

    } catch (error: any) {
      const duration = Date.now() - startTime
      
      if (error.code === 'ENOENT') {
        return err(fileSystemError(
          ErrorCode.DIRECTORY_NOT_FOUND,
          `Directory not found: ${parameters.path}`
        ))
      }
      
      if (error.code === 'EACCES') {
        return err(fileSystemError(
          ErrorCode.FILE_ACCESS_DENIED,
          `Permission denied: ${parameters.path}`
        ))
      }

      return err(fileSystemError(
        ErrorCode.INTERNAL_ERROR,
        `Failed to list directory: ${error.message}`,
        { path: parameters.path }
      ))
    }
  }

  private listDirectory(
    dirPath: string, 
    showHidden: boolean, 
    recursive: boolean, 
    maxDepth: number, 
    currentDepth: number
  ): FileInfo[] {
    const files: FileInfo[] = []
    
    try {
      const entries = readdirSync(dirPath)
      
      for (const entry of entries) {
        // Skip hidden files if not requested
        if (!showHidden && entry.startsWith('.')) {
          continue
        }
        
        const entryPath = join(dirPath, entry)
        const stats = statSync(entryPath)
        
        const fileInfo: FileInfo = {
          name: entry,
          type: stats.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          modified: stats.mtime.toISOString(),
          permissions: this.getPermissions(stats.mode)
        }
        
        files.push(fileInfo)
        
        // Recurse into directories if requested and within depth limit
        if (recursive && stats.isDirectory() && currentDepth < maxDepth) {
          const subFiles = this.listDirectory(
            entryPath, 
            showHidden, 
            recursive, 
            maxDepth, 
            currentDepth + 1
          )
          
          // Add subdirectory prefix to nested files
          const nestedFiles = subFiles.map(f => ({
            ...f,
            name: `${entry}/${f.name}`
          }))
          
          files.push(...nestedFiles)
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
    
    return files
  }

  private formatFileList(files: FileInfo[], recursive: boolean): string {
    if (files.length === 0) {
      return 'Directory is empty'
    }

    const maxNameLength = Math.max(...files.map(f => f.name.length))
    const formatSize = (size: number) => {
      if (size < 1024) return `${size}B`
      if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}K`
      if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)}M`
      return `${(size / 1024 / 1024 / 1024).toFixed(1)}G`
    }

    const lines = files.map(file => {
      const name = file.name.padEnd(maxNameLength)
      const type = file.type === 'directory' ? 'DIR' : 'FILE'
      const size = file.type === 'file' ? formatSize(file.size).padStart(8) : '       -'
      const date = new Date(file.modified).toLocaleDateString()
      
      return `${type}  ${size}  ${date}  ${name}`
    })

    const header = `TYPE     SIZE       DATE        NAME`
    const separator = '-'.repeat(header.length)
    
    return [header, separator, ...lines].join('\n')
  }

  private getPermissions(mode: number): string {
    const perms = [
      (mode & 0o400) ? 'r' : '-',
      (mode & 0o200) ? 'w' : '-',
      (mode & 0o100) ? 'x' : '-',
      (mode & 0o040) ? 'r' : '-',
      (mode & 0o020) ? 'w' : '-',
      (mode & 0o010) ? 'x' : '-',
      (mode & 0o004) ? 'r' : '-',
      (mode & 0o002) ? 'w' : '-',
      (mode & 0o001) ? 'x' : '-'
    ]
    return perms.join('')
  }
} 