var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from 'react';
import { Box, Text } from 'ink';
import { ErrorCode, createError, getUserMessage, getRecoverySuggestion } from '@opencode/types';
var ErrorBoundary = /** @class */ (function (_super) {
    __extends(ErrorBoundary, _super);
    function ErrorBoundary(props) {
        var _this = _super.call(this, props) || this;
        _this.state = { hasError: false, error: null };
        return _this;
    }
    ErrorBoundary.getDerivedStateFromError = function (error) {
        var openCodeError = createError(ErrorCode.INTERNAL_ERROR, error.message || 'An unexpected error occurred', { cause: error, recoverable: true });
        return {
            hasError: true,
            error: openCodeError,
        };
    };
    ErrorBoundary.prototype.componentDidCatch = function (error, errorInfo) {
        var openCodeError = this.state.error;
        if (openCodeError && this.props.onError) {
            this.props.onError(openCodeError, errorInfo);
        }
    };
    ErrorBoundary.prototype.render = function () {
        if (this.state.hasError && this.state.error) {
            if (this.props.fallback) {
                return this.props.fallback(this.state.error);
            }
            return _jsx(DefaultErrorDisplay, { error: this.state.error });
        }
        return this.props.children;
    };
    return ErrorBoundary;
}(Component));
export { ErrorBoundary };
function DefaultErrorDisplay(_a) {
    var error = _a.error;
    var userMessage = getUserMessage(error);
    var suggestion = getRecoverySuggestion(error);
    return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsx(Box, { marginBottom: 1, children: _jsxs(Text, { color: "red", bold: true, children: ["\u26A0\uFE0F Error: ", error.code] }) }), _jsx(Box, { marginBottom: 1, children: _jsx(Text, { children: userMessage }) }), suggestion && (_jsx(Box, { marginBottom: 1, children: _jsxs(Text, { color: "yellow", children: ["\uD83D\uDCA1 Suggestion: ", suggestion] }) })), _jsx(Box, { children: _jsx(Text, { color: "gray", dimColor: true, children: "Press Ctrl+C to exit or fix the issue and try again" }) })] }));
}
// Tool-specific error boundary
export function ToolErrorBoundary(_a) {
    var children = _a.children, toolName = _a.toolName;
    var handleError = function (error, errorInfo) {
        console.error("Tool ".concat(toolName, " failed:"), error);
        console.error('Error Info:', errorInfo);
    };
    var fallback = function (error) { return (_jsx(Box, { children: _jsxs(Text, { color: "red", children: ["\u2717 ", toolName, " failed: ", getUserMessage(error)] }) })); };
    return (_jsx(ErrorBoundary, { onError: handleError, fallback: fallback, children: children }));
}
// CLI command error boundary
export function CLIErrorBoundary(_a) {
    var children = _a.children;
    var handleError = function (error, errorInfo) {
        console.error('CLI Command failed:', error);
        console.error('Stack trace:', errorInfo.componentStack);
    };
    return (_jsx(ErrorBoundary, { onError: handleError, children: children }));
}
