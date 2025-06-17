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
import { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { Banner } from '../common/banner.js';
var TOOL_COLORS = {
    read: ['Read', 'cyan'],
    write: ['Write', 'green'],
    edit: ['Edit', 'green'],
    bash: ['Bash', 'red'],
    grep: ['Grep', 'blue'],
    glob: ['Glob', 'blue'],
    list: ['List', 'blue'],
    todo: ['Todo', 'yellow'],
};
export function RunMode(_a) {
    var _this = this;
    var message = _a.message, sessionId = _a.sessionId, share = _a.share;
    var _b = useState([]), events = _b[0], setEvents = _b[1];
    var _c = useState(false), isComplete = _c[0], setIsComplete = _c[1];
    var _d = useState(''), response = _d[0], setResponse = _d[1];
    useEffect(function () {
        simulateExecution();
    }, []);
    var simulateExecution = function () { return __awaiter(_this, void 0, void 0, function () {
        var toolSequence, _loop_1, _i, toolSequence_1, _a, tool, title, delay;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: 
                // Show banner and initial message
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 100); })
                    // Simulate tool execution events
                ];
                case 1:
                    // Show banner and initial message
                    _b.sent();
                    toolSequence = [
                        { tool: 'read', title: 'Reading project files', delay: 500 },
                        { tool: 'grep', title: 'Searching for patterns', delay: 800 },
                        { tool: 'edit', title: 'Updating configuration', delay: 1200 },
                        { tool: 'write', title: 'Creating new file', delay: 600 },
                    ];
                    _loop_1 = function (tool, title, delay) {
                        var _c, toolName, color;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0: return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, delay); })];
                                case 1:
                                    _d.sent();
                                    _c = TOOL_COLORS[tool] || [tool, 'white'], toolName = _c[0], color = _c[1];
                                    setEvents(function (prev) { return __spreadArray(__spreadArray([], prev, true), [{ tool: toolName, title: title, color: color }], false); });
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, toolSequence_1 = toolSequence;
                    _b.label = 2;
                case 2:
                    if (!(_i < toolSequence_1.length)) return [3 /*break*/, 5];
                    _a = toolSequence_1[_i], tool = _a.tool, title = _a.title, delay = _a.delay;
                    return [5 /*yield**/, _loop_1(tool, title, delay)];
                case 3:
                    _b.sent();
                    _b.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5: 
                // Show final response
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 800); })];
                case 6:
                    // Show final response
                    _b.sent();
                    setResponse("I've analyzed your request: \"".concat(message, "\"\n\nI found and updated the relevant files. The changes have been applied successfully."));
                    setIsComplete(true);
                    return [2 /*return*/];
            }
        });
    }); };
    var sessionDisplay = sessionId ? sessionId.slice(-8) : 'new';
    var shareUrl = share ? "https://opencode.ai/s/".concat(sessionDisplay) : null;
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Box, { marginBottom: 1, children: _jsx(Banner, {}) }), _jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { bold: true, color: "white", children: '> ' }), _jsx(Text, { children: message })] }), shareUrl && (_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { bold: true, color: "blue", children: '~  ' }), _jsx(Text, { color: "blue", children: shareUrl })] })), _jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { bold: true, color: "white", children: '@ ' }), _jsx(Text, { color: "gray", children: "anthropic/claude-3.5-sonnet" })] }), _jsx(Box, { flexDirection: "column", marginBottom: 1, children: events.map(function (event, index) { return (_jsxs(Box, { children: [_jsx(Text, { color: event.color, children: '|' }), _jsx(Text, { color: "gray", dimColor: true, children: " ".concat(event.tool.padEnd(7, ' ')) }), _jsxs(Text, { children: [" ", event.title] })] }, index)); }) }), isComplete && response && (_jsx(Box, { children: _jsx(Text, { children: response }) }))] }));
}
