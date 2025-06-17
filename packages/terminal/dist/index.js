// OpenCode Terminal UI (Ink-based)
// TODO: Implement Ink-based terminal interface
export function startTerminalUI() {
    console.log("🚧 OpenCode Terminal UI v2 - Coming Soon!");
    console.log("The new Ink-based terminal interface is under development.");
}
export default {
    start: startTerminalUI
};
export { App } from './app.js';
export { Layout, StatusBar } from './components/common/layout.js';
export { Banner, CompactHeader } from './components/common/banner.js';
export { ErrorBoundary, ToolErrorBoundary, CLIErrorBoundary } from './components/common/error-boundary.js';
export { ChatHistory } from './components/chat/history.js';
export { ChatInput } from './components/chat/input.js';
export { Message } from './components/chat/message.js';
export { RunMode } from './components/modes/run-mode.js';
export { parseCliArgs, showHelp, showError } from './cli/router.js';
