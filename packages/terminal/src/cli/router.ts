import { parseArgs } from 'node:util'
import { Result, ok, err, ErrorCode, cliError, getUserMessage, getRecoverySuggestion } from '@opencode/types'

export interface CLIArgs {
  command?: string
  message?: string[]
  session?: string
  share?: boolean
  help?: boolean
}

export function parseCliArgs(argv: string[]): Result<CLIArgs, import('@opencode/types').OpenCodeError> {
  try {
    const { values, positionals } = parseArgs({
      args: argv.slice(2), // Remove 'node' and script path
      options: {
        session: { type: 'string', short: 's' },
        share: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
      allowPositionals: true,
    })

    // First positional is the command, rest are message
    const [command, ...message] = positionals

    // Validate command
    const validCommands = ['run', 'auth', 'upgrade', 'interactive']
    if (command && !validCommands.includes(command)) {
      return err(cliError(
        ErrorCode.CLI_INVALID_COMMAND,
        `Unknown command: ${command}`,
        { command, validCommands }
      ))
    }

    // Validate run command has message
    if (command === 'run' && message.length === 0) {
      return err(cliError(
        ErrorCode.CLI_MISSING_ARGS,
        'Run command requires a message',
        { command: 'run', usage: 'code run "your message here"' }
      ))
    }

    return ok({
      command: command || 'interactive',
      message,
      session: values.session,
      share: values.share,
      help: values.help,
    })
  } catch (error) {
    return err(cliError(
      ErrorCode.CLI_PARSE_ERROR,
      'Failed to parse command line arguments',
      { cause: error }
    ))
  }
}

export function showHelp() {
  console.log(`
█▀▀█ █▀▀█ █▀▀ █▀▀▄  █▀▀ █▀▀█ █▀▀▄ █▀▀
█░░█ █░░█ █▀▀ █░░█  █░░ █░░█ █░░█ █▀▀
▀▀▀▀ █▀▀▀ ▀▀▀ ▀  ▀  ▀▀▀ ▀▀▀▀ ▀▀▀  ▀▀▀

Usage:
  code                          Start interactive chat
  code run [message...]         Send message directly  
  code auth                     Manage authentication
  code upgrade                  Upgrade to latest version
  code --help                   Show this help

Options:
  -s, --session <id>           Continue specific session
  --share                      Share the session publicly
  -h, --help                   Show help

Examples:
  code                         # Interactive mode
  code run "help me debug"     # Direct message
  code run --session abc123 "continue coding"
  code auth login              # Add API credentials
`)
}

export function showError(error: import('@opencode/types').OpenCodeError) {
  console.error(`\n❌ ${getUserMessage(error)}`)
  
  const suggestion = getRecoverySuggestion(error)
  if (suggestion) {
    console.error(`💡 ${suggestion}`)
  }
  
  if (error.context?.usage) {
    console.error(`\nUsage: ${error.context.usage}`)
  }
  
  console.error('\nRun "code --help" for more information.\n')
} 