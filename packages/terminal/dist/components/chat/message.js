import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
export function Message(_a) {
    var role = _a.role, content = _a.content, timestamp = _a.timestamp, toolCalls = _a.toolCalls;
    return (_jsxs(Box, { flexDirection: "column", marginY: 1, children: [_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { bold: true, color: role === 'user' ? 'yellow' : 'cyan', children: role === 'user' ? '> ' : '◍ ' }), _jsx(Text, { color: role === 'user' ? 'yellow' : 'cyan', children: role === 'user' ? 'You' : 'OpenCode' }), timestamp && (_jsxs(Text, { color: "gray", dimColor: true, children: [' ', "(", timestamp.toLocaleTimeString(), ")"] }))] }), _jsx(Box, { marginLeft: 2, marginBottom: 1, children: _jsx(Text, { children: content }) }), toolCalls && toolCalls.length > 0 && (_jsx(Box, { flexDirection: "column", marginLeft: 2, children: toolCalls.map(function (tool) { return (_jsx(ToolCallDisplay, { tool: tool }, tool.id)); }) }))] }));
}
function ToolCallDisplay(_a) {
    var tool = _a.tool;
    var getStatusColor = function () {
        switch (tool.status) {
            case 'running': return 'yellow';
            case 'success': return 'green';
            case 'error': return 'red';
            default: return 'gray';
        }
    };
    var getStatusIcon = function () {
        switch (tool.status) {
            case 'running': return '◐';
            case 'success': return '✓';
            case 'error': return '✗';
            default: return '◯';
        }
    };
    return (_jsxs(Box, { flexDirection: "column", marginY: 1, children: [_jsxs(Box, { children: [_jsxs(Text, { color: getStatusColor(), children: [getStatusIcon(), " ", tool.name.padEnd(8)] }), _jsxs(Text, { dimColor: true, children: [" ", tool.title] })] }), tool.result && tool.status === 'success' && (_jsx(Box, { marginLeft: 2, marginTop: 1, children: _jsx(Text, { dimColor: true, children: tool.result }) }))] }));
}
