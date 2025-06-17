import path from 'path'
import os from 'os'

export interface AppInfo {
  user: string
  version: string
  paths: {
    cwd: string
    root: string
    data: string
    config: string
  }
  git: {
    enabled: boolean
    root?: string
  }
  initialized: boolean
}

let appInfo: AppInfo | null = null

export function createAppInfo(options: {
  cwd: string
  version: string
  dataDir?: string
}): AppInfo {
  // Find git root
  let gitRoot: string | undefined
  let current = options.cwd
  
  while (current !== path.dirname(current)) {
    try {
      const gitPath = path.join(current, '.git')
      if (require('fs').existsSync(gitPath)) {
        gitRoot = current
        break
      }
    } catch {}
    current = path.dirname(current)
  }

  const dataDir = options.dataDir ?? path.join(os.homedir(), '.opencode')
  
  const info: AppInfo = {
    user: os.userInfo().username,
    version: options.version,
    paths: {
      cwd: options.cwd,
      root: gitRoot ?? options.cwd,
      data: dataDir,
      config: path.join(dataDir, 'config'),
    },
    git: {
      enabled: !!gitRoot,
      ...(gitRoot ? { root: gitRoot } : {}),
    },
    initialized: true,
  }

  appInfo = info
  return info
}

export function getAppInfo(): AppInfo {
  if (!appInfo) {
    throw new Error('App not initialized. Call createAppInfo() first.')
  }
  return appInfo
}

// Legacy compatibility
export const App = {
  info: getAppInfo,
  provide: async <T>(
    options: { cwd: string; version: string }, 
    fn: (app: AppInfo) => Promise<T>
  ): Promise<T> => {
    const info = createAppInfo(options)
    return fn(info)
  },
}

// Create data directories
export async function ensureDirectories(info: AppInfo): Promise<void> {
  const fs = require('fs').promises
  
  await fs.mkdir(info.paths.data, { recursive: true })
  await fs.mkdir(info.paths.config, { recursive: true })
  await fs.mkdir(path.join(info.paths.data, 'sessions'), { recursive: true })
  await fs.mkdir(path.join(info.paths.data, 'logs'), { recursive: true })
} 