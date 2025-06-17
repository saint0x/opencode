#!/usr/bin/env node
import React from 'react'
import { render } from 'ink'
import { App } from './app.js'
import { RunMode } from './components/modes/run-mode.js'
import { parseCliArgs, showHelp, showError } from './cli/router.js'
import { CLIErrorBoundary } from './components/common/error-boundary.js'
import { isOk, isErr, unwrap } from '@opencode/types'

// Parse command line arguments with error handling
const parseResult = parseCliArgs(process.argv)

if (isErr(parseResult)) {
  showError(parseResult.error)
  process.exit(1)
}

const args = unwrap(parseResult)

// Handle help
if (args.help) {
  showHelp()
  process.exit(0)
}

// Clear the terminal for clean startup
console.clear()

// Route to appropriate mode with error boundaries
let component: React.ReactElement

try {
  switch (args.command) {
    case 'run':
      // Already validated in parseCliArgs, but extra safety check
      if (!args.message || args.message.length === 0) {
        console.error('❌ Run command requires a message')
        console.error('Usage: code run "your message here"')
        process.exit(1)
      }
      component = (
        <CLIErrorBoundary>
          <RunMode 
            message={args.message.join(' ')}
            sessionId={args.session}
            share={args.share}
          />
        </CLIErrorBoundary>
      )
      break
      
    case 'auth':
      console.log('🔑 Authentication management coming soon...')
      console.log('This will include:')
      console.log('  • code auth login    - Add API credentials')
      console.log('  • code auth logout   - Remove credentials')
      console.log('  • code auth list     - Show configured providers')
      process.exit(0)
      
    case 'upgrade':
      console.log('⬆️  Upgrade functionality coming soon...')
      console.log('This will automatically update OpenCode to the latest version.')
      process.exit(0)
      
    case 'interactive':
    default:
      // Default to interactive chat mode
      component = (
        <CLIErrorBoundary>
          <App />
        </CLIErrorBoundary>
      )
      break
  }
} catch (error) {
  console.error('❌ Failed to initialize application:', error)
  process.exit(1)
}

// Render the selected component with global error handling
let unmount: (() => void) | undefined

try {
  const result = render(component)
  unmount = result.unmount
} catch (error) {
  console.error('❌ Failed to render application:', error)
  process.exit(1)
}

// Handle process termination gracefully
const cleanup = () => {
  try {
    if (unmount) {
      unmount()
    }
  } catch (error) {
    console.error('Warning: Error during cleanup:', error)
  }
}

process.on('SIGINT', () => {
  cleanup()
  process.exit(0)
})

process.on('SIGTERM', () => {
  cleanup()
  process.exit(0)
})

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error)
  cleanup()
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled rejection:', reason)
  cleanup()
  process.exit(1)
}) 