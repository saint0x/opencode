#!/usr/bin/env node
import { jsx as _jsx } from "react/jsx-runtime";
import { render } from 'ink';
import { App } from './app.js';
import { RunMode } from './components/modes/run-mode.js';
import { parseCliArgs, showHelp, showError } from './cli/router.js';
import { CLIErrorBoundary } from './components/common/error-boundary.js';
import { isErr, unwrap } from '@opencode/types';
// Parse command line arguments with error handling
var parseResult = parseCliArgs(process.argv);
if (isErr(parseResult)) {
    showError(parseResult.error);
    process.exit(1);
}
var args = unwrap(parseResult);
// Handle help
if (args.help) {
    showHelp();
    process.exit(0);
}
// Clear the terminal for clean startup
console.clear();
// Route to appropriate mode with error boundaries
var component;
try {
    switch (args.command) {
        case 'run':
            // Already validated in parseCliArgs, but extra safety check
            if (!args.message || args.message.length === 0) {
                console.error('❌ Run command requires a message');
                console.error('Usage: code run "your message here"');
                process.exit(1);
            }
            component = (_jsx(CLIErrorBoundary, { children: _jsx(RunMode, { message: args.message.join(' '), sessionId: args.session, share: args.share }) }));
            break;
        case 'auth':
            console.log('🔑 Authentication management coming soon...');
            console.log('This will include:');
            console.log('  • code auth login    - Add API credentials');
            console.log('  • code auth logout   - Remove credentials');
            console.log('  • code auth list     - Show configured providers');
            process.exit(0);
        case 'upgrade':
            console.log('⬆️  Upgrade functionality coming soon...');
            console.log('This will automatically update OpenCode to the latest version.');
            process.exit(0);
        case 'interactive':
        default:
            // Default to interactive chat mode
            component = (_jsx(CLIErrorBoundary, { children: _jsx(App, {}) }));
            break;
    }
}
catch (error) {
    console.error('❌ Failed to initialize application:', error);
    process.exit(1);
}
// Render the selected component with global error handling
var unmount;
try {
    var result = render(component);
    unmount = result.unmount;
}
catch (error) {
    console.error('❌ Failed to render application:', error);
    process.exit(1);
}
// Handle process termination gracefully
var cleanup = function () {
    try {
        if (unmount) {
            unmount();
        }
    }
    catch (error) {
        console.error('Warning: Error during cleanup:', error);
    }
};
process.on('SIGINT', function () {
    cleanup();
    process.exit(0);
});
process.on('SIGTERM', function () {
    cleanup();
    process.exit(0);
});
process.on('uncaughtException', function (error) {
    console.error('❌ Uncaught exception:', error);
    cleanup();
    process.exit(1);
});
process.on('unhandledRejection', function (reason) {
    console.error('❌ Unhandled rejection:', reason);
    cleanup();
    process.exit(1);
});
