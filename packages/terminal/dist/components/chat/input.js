import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
export function ChatInput(_a) {
    var onSubmit = _a.onSubmit, _b = _a.disabled, disabled = _b === void 0 ? false : _b, _c = _a.placeholder, placeholder = _c === void 0 ? "Ask me to help with your code..." : _c;
    var _d = useState(''), input = _d[0], setInput = _d[1];
    var handleSubmit = useCallback(function () {
        if (input.trim() && !disabled) {
            onSubmit(input.trim());
            setInput('');
        }
    }, [input, onSubmit, disabled]);
    useInput(function (input, key) {
        if (disabled)
            return;
        if (key.return) {
            handleSubmit();
        }
        else if (key.backspace || key.delete) {
            setInput(function (prev) { return prev.slice(0, -1); });
        }
        else if (key.ctrl && input === 'c') {
            process.exit(0);
        }
        else if (input.length === 1 && !key.ctrl && !key.meta) {
            setInput(function (prev) { return prev + input; });
        }
    });
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Box, { children: _jsx(Text, { color: "gray", children: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500" }) }, "input-separator"), _jsxs(Box, { paddingY: 1, children: [_jsx(Text, { bold: true, color: "green", children: '> ' }), _jsxs(Text, { children: [input || (_jsx(Text, { color: "gray", dimColor: true, children: placeholder })), !disabled && _jsx(Text, { inverse: true, children: " " })] })] }, "input-line"), disabled && (_jsx(Box, { children: _jsx(Text, { color: "yellow", dimColor: true, children: "Processing... Press Ctrl+C to cancel" }) }, "processing-message")), _jsx(Box, { children: _jsx(Text, { color: "gray", dimColor: true, children: "Press Enter to send \u2022 Ctrl+C to exit \u2022 Run with: code" }) }, "help-text")] }));
}
