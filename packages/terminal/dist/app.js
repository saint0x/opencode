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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback, useEffect } from 'react';
import { Layout, StatusBar } from './components/common/layout.js';
import { CompactHeader } from './components/common/banner.js';
import { ChatHistory } from './components/chat/history.js';
import { ChatInput } from './components/chat/input.js';
export function App() {
    var _this = this;
    var _a = useState({
        messages: [],
        isLoading: false,
        status: 'Ready'
    }), state = _a[0], setState = _a[1];
    var handleSendMessage = useCallback(function (content) { return __awaiter(_this, void 0, void 0, function () {
        var userMessage, assistantMessage_1, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    userMessage = {
                        role: 'user',
                        content: content,
                        timestamp: new Date()
                    };
                    setState(function (prev) { return (__assign(__assign({}, prev), { messages: __spreadArray(__spreadArray([], prev.messages, true), [userMessage], false), isLoading: true, status: 'Processing...' })); });
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    // TODO: Connect to core engine
                    // For now, simulate response
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000); })];
                case 2:
                    // TODO: Connect to core engine
                    // For now, simulate response
                    _a.sent();
                    assistantMessage_1 = {
                        role: 'assistant',
                        content: "I received your message: \"".concat(content, "\". OpenCode v2 is being rebuilt - core functionality coming soon!"),
                        timestamp: new Date(),
                        toolCalls: [
                            {
                                id: '1',
                                name: 'read',
                                status: 'success',
                                title: 'Reading project files',
                                result: 'Found 25 TypeScript files'
                            }
                        ]
                    };
                    setState(function (prev) { return (__assign(__assign({}, prev), { messages: __spreadArray(__spreadArray([], prev.messages, true), [assistantMessage_1], false), isLoading: false, status: 'Ready' })); });
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    setState(function (prev) { return (__assign(__assign({}, prev), { isLoading: false, status: 'Error' })); });
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); }, []);
    useEffect(function () {
        // Initialize session
        setState(function (prev) { return (__assign(__assign({}, prev), { sessionId: generateSessionId(), status: 'Connected' })); });
    }, []);
    return (_jsxs(Layout, { header: _jsx(CompactHeader, {}), footer: _jsx(StatusBar, { status: state.status, session: state.sessionId || undefined }), children: [_jsx(ChatHistory, { messages: state.messages, isLoading: state.isLoading }), _jsx(ChatInput, { onSubmit: handleSendMessage, disabled: state.isLoading, placeholder: "Ask me to help with your code..." })] }));
}
function generateSessionId() {
    return Math.random().toString(36).substring(2, 15);
}
