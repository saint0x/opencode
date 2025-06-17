import { homedir } from 'os'
import { join } from 'path'
import { mkdirSync } from 'fs'

export interface AppInfo {
  paths: {
    home: string
    data: string
    config: string
  }
}

export function createAppInfo(): AppInfo {
  const home = homedir()
  const appDir = join(home, '.opencode')

  return {
    paths: {
      home,
      data: join(appDir, 'data'),
      config: join(appDir, 'config'),
  },
}
}

export function ensureDirectories(info: AppInfo): void {
  try {
    mkdirSync(info.paths.data, { recursive: true })
    mkdirSync(info.paths.config, { recursive: true })
  } catch (error) {
    console.error('Failed to create application directories:', error)
    throw error
  }
}
