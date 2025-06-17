var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { Message } from './message.js';
export function ChatHistory(_a) {
    var messages = _a.messages, isLoading = _a.isLoading;
    return (_jsx(Box, { flexDirection: "column", flexGrow: 1, children: messages.length === 0 ? (_jsx(Box, { justifyContent: "center", alignItems: "center", flexGrow: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "Start a conversation by typing a message below..." }) })) : (_jsxs(Box, { flexDirection: "column", children: [messages.map(function (message, index) { return (_jsx(Message, __assign({}, message), index)); }), isLoading && (_jsx(Box, { marginLeft: 2, marginY: 1, children: _jsx(Text, { color: "yellow", children: "\u25D0 Thinking..." }) }))] })) }));
}
