import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
export function Layout(_a) {
    var children = _a.children, header = _a.header, footer = _a.footer;
    return (_jsxs(Box, { flexDirection: "column", height: "100%", children: [header && (_jsx(Box, { children: header }, "header")), _jsx(Box, { flexGrow: 1, flexDirection: "column", children: children }, "main"), footer && (_jsx(Box, { children: footer }, "footer"))] }));
}
export function Header() {
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { justifyContent: "center", paddingY: 1, children: [_jsx(Text, { bold: true, color: "cyan", children: "\u25CD OpenCode" }), _jsx(Text, { color: "gray", dimColor: true, children: " - AI Coding Assistant" })] }, "title"), _jsx(Box, { children: _jsx(Text, { color: "gray", children: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500" }) }, "separator")] }));
}
export function StatusBar(_a) {
    var status = _a.status, session = _a.session;
    return (_jsxs(Box, { justifyContent: "space-between", paddingX: 1, children: [_jsxs(Text, { color: "green", children: ["\u25CF ", status] }, "status"), session && _jsxs(Text, { color: "blue", children: ["Session: ", session.slice(-8)] }, "session")] }));
}
export default Layout;
