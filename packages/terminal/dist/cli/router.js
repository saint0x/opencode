import { parseArgs } from 'node:util';
import { ok, err, ErrorCode, cliError, getUserMessage, getRecoverySuggestion } from '@opencode/types';
export function parseCliArgs(argv) {
    try {
        var _a = parseArgs({
            args: argv.slice(2), // Remove 'node' and script path
            options: {
                session: { type: 'string', short: 's' },
                share: { type: 'boolean' },
                help: { type: 'boolean', short: 'h' },
            },
            allowPositionals: true,
        }), values = _a.values, positionals = _a.positionals;
        // First positional is the command, rest are message
        var command = positionals[0], message = positionals.slice(1);
        // Validate command
        var validCommands = ['run', 'auth', 'upgrade', 'interactive'];
        if (command && !validCommands.includes(command)) {
            return err(cliError(ErrorCode.CLI_INVALID_COMMAND, "Unknown command: ".concat(command), { command: command, validCommands: validCommands }));
        }
        // Validate run command has message
        if (command === 'run' && message.length === 0) {
            return err(cliError(ErrorCode.CLI_MISSING_ARGS, 'Run command requires a message', { command: 'run', usage: 'code run "your message here"' }));
        }
        return ok({
            command: command || 'interactive',
            message: message,
            session: values.session,
            share: values.share,
            help: values.help,
        });
    }
    catch (error) {
        return err(cliError(ErrorCode.CLI_PARSE_ERROR, 'Failed to parse command line arguments', { cause: error }));
    }
}
export function showHelp() {
    console.log("\n\u2588\u2580\u2580\u2588 \u2588\u2580\u2580\u2588 \u2588\u2580\u2580 \u2588\u2580\u2580\u2584  \u2588\u2580\u2580 \u2588\u2580\u2580\u2588 \u2588\u2580\u2580\u2584 \u2588\u2580\u2580\n\u2588\u2591\u2591\u2588 \u2588\u2591\u2591\u2588 \u2588\u2580\u2580 \u2588\u2591\u2591\u2588  \u2588\u2591\u2591 \u2588\u2591\u2591\u2588 \u2588\u2591\u2591\u2588 \u2588\u2580\u2580\n\u2580\u2580\u2580\u2580 \u2588\u2580\u2580\u2580 \u2580\u2580\u2580 \u2580  \u2580  \u2580\u2580\u2580 \u2580\u2580\u2580\u2580 \u2580\u2580\u2580  \u2580\u2580\u2580\n\nUsage:\n  code                          Start interactive chat\n  code run [message...]         Send message directly  \n  code auth                     Manage authentication\n  code upgrade                  Upgrade to latest version\n  code --help                   Show this help\n\nOptions:\n  -s, --session <id>           Continue specific session\n  --share                      Share the session publicly\n  -h, --help                   Show help\n\nExamples:\n  code                         # Interactive mode\n  code run \"help me debug\"     # Direct message\n  code run --session abc123 \"continue coding\"\n  code auth login              # Add API credentials\n");
}
export function showError(error) {
    var _a;
    console.error("\n\u274C ".concat(getUserMessage(error)));
    var suggestion = getRecoverySuggestion(error);
    if (suggestion) {
        console.error("\uD83D\uDCA1 ".concat(suggestion));
    }
    if ((_a = error.context) === null || _a === void 0 ? void 0 : _a.usage) {
        console.error("\nUsage: ".concat(error.context.usage));
    }
    console.error('\nRun "code --help" for more information.\n');
}
