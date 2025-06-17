import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
export function Banner(_a) {
    var _b = _a.padding, padding = _b === void 0 ? '' : _b;
    var logo = [
        ['█▀▀█ █▀▀█ █▀▀ █▀▀▄ ', '█▀▀ █▀▀█ █▀▀▄ █▀▀'],
        ['█░░█ █░░█ █▀▀ █░░█ ', '█░░ █░░█ █░░█ █▀▀'],
        ['▀▀▀▀ █▀▀▀ ▀▀▀ ▀  ▀ ', '▀▀▀ ▀▀▀▀ ▀▀▀  ▀▀▀'],
    ];
    return (_jsx(Box, { flexDirection: "column", children: logo.map(function (row, index) { return (_jsxs(Box, { children: [_jsx(Text, { children: padding }), _jsx(Text, { color: "gray", children: row[0] }), _jsx(Text, { color: "white", children: row[1] })] }, index)); }) }));
}
export function CompactHeader() {
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { justifyContent: "center", paddingY: 1, children: [_jsx(Text, { bold: true, color: "cyan", children: "\u25CD OpenCode" }), _jsx(Text, { color: "gray", dimColor: true, children: " - AI Coding Assistant" })] }), _jsx(Box, { children: _jsx(Text, { color: "gray", children: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500" }) })] }));
}
