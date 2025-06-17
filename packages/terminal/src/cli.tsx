#!/usr/bin/env node
import React from 'react'
import { render } from 'ink'
import { Command } from 'commander'
import { App } from './app.js'
import { RunMode } from './components/modes/run-mode.js'
import { CLIErrorBoundary } from './components/common/error-boundary.js'
import { OpenCodeServer, type ServerConfig, createAppInfo, ensureDirectories } from '@opencode/core'
import { join } from 'path'

const program = new Command()

program
  .name('code')
  .description('The AI-powered command-line coding assistant.')
  .version('2.0.0')

program
  .command('serve')
  .description('Start the OpenCode backend server.')
  .option('-p, --port <number>', 'Port to run the server on', '3000')
  .action((options) => {
    console.log('Starting OpenCode server...')
    const port = parseInt(options.port, 10)
    
    if (isNaN(port)) {
      console.error('Error: Port must be a number.')
      process.exit(1)
    }

    try {
      const appInfo = createAppInfo()
      ensureDirectories(appInfo)
      const dbPath = join(appInfo.paths.data, 'opencode.db')

      const server = new OpenCodeServer({
        port,
        database: {
          path: dbPath,
        },
      })
      server.start()
    } catch (error) {
      console.error('Failed to start server:', error)
      process.exit(1)
    }
  })

program
  .command('run <message...>')
  .description('Run a command in non-interactive mode.')
  .option('-s, --session <id>', 'Continue an existing session')
  .option('--share', 'Share the session URL')
  .action((message, options) => {
    console.clear()
    render(
      <CLIErrorBoundary>
        <RunMode 
          message={message.join(' ')}
          sessionId={options.session}
          share={options.share}
        />
      </CLIErrorBoundary>
    )
  })

program
  .command('auth', 'Manage authentication for AI providers.')
  .action(() => {
    console.log('🔑 Authentication management coming soon...')
    console.log('  • code auth login    - Add API credentials')
    console.log('  • code auth logout   - Remove credentials')
    console.log('  • code auth list     - Show configured providers')
  })

program
  .command('upgrade', 'Upgrade OpenCode to the latest version.')
  .action(() => {
    console.log('⬆️  Upgrade functionality coming soon...')
  })

// Default command: interactive mode with auto-server
program
  .action(async () => {
    console.clear()
    
    // Start server in background
    let server: OpenCodeServer | null = null
    try {
      const appInfo = createAppInfo()
      ensureDirectories(appInfo)
      const dbPath = join(appInfo.paths.data, 'opencode.db')

      server = new OpenCodeServer({
        port: 3000,
        database: {
          path: dbPath,
        },
      })
      
      // Start server without blocking
      server.start().catch((error) => {
        console.error('Server failed to start:', error)
      })
      
      // Give server a moment to start
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (error) {
      console.error('Failed to initialize server:', error)
    }
    
    // Start terminal UI
    const { unmount } = render(
      <CLIErrorBoundary>
        <App />
      </CLIErrorBoundary>
    )
    
    // Cleanup on exit
    const cleanup = async () => {
      unmount()
      if (server) {
        await server.stop()
      }
      process.exit(0)
    }
    
    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)
  })


async function main() {
  // If no arguments, run default interactive mode
  if (!process.argv.slice(2).length) {
    await program.parseAsync(['node', 'code'])
  } else {
    await program.parseAsync(process.argv)
  }
}

main().catch(error => {
  console.error('❌ Uncaught exception:', error)
  process.exit(1)
})