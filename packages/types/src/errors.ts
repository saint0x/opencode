/**
 * Comprehensive error types for OpenCode application
 */

export enum ErrorCode {
  // CLI Errors
  CLI_INVALID_COMMAND = 'CLI_INVALID_COMMAND',
  CLI_MISSING_ARGS = 'CLI_MISSING_ARGS',
  CLI_PARSE_ERROR = 'CLI_PARSE_ERROR',
  
  // Database Errors
  DATABASE_CONNECTION = 'DATABASE_CONNECTION',
  DATABASE_CORRUPTION = 'DATABASE_CORRUPTION',
  DATABASE_MIGRATION = 'DATABASE_MIGRATION',
  DATABASE_QUERY = 'DATABASE_QUERY',
  DATABASE_TRANSACTION = 'DATABASE_TRANSACTION',
  
  // Tool Execution Errors
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  TOOL_TIMEOUT = 'TOOL_TIMEOUT',
  TOOL_PERMISSION_DENIED = 'TOOL_PERMISSION_DENIED',
  TOOL_EXECUTION_FAILED = 'TOOL_EXECUTION_FAILED',
  TOOL_INVALID_PARAMS = 'TOOL_INVALID_PARAMS',
  
  // Provider Errors
  PROVIDER_NOT_CONFIGURED = 'PROVIDER_NOT_CONFIGURED',
  PROVIDER_AUTH_FAILED = 'PROVIDER_AUTH_FAILED',
  PROVIDER_RATE_LIMITED = 'PROVIDER_RATE_LIMITED',
  PROVIDER_NETWORK_ERROR = 'PROVIDER_NETWORK_ERROR',
  PROVIDER_QUOTA_EXCEEDED = 'PROVIDER_QUOTA_EXCEEDED',
  
  // LLM API Errors
  LLM_API_ERROR = 'LLM_API_ERROR',
  LLM_MODEL_NOT_FOUND = 'LLM_MODEL_NOT_FOUND',
  LLM_CONTEXT_TOO_LONG = 'LLM_CONTEXT_TOO_LONG',
  
  // Session Errors
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_CORRUPTED = 'SESSION_CORRUPTED',
  SESSION_ACCESS_DENIED = 'SESSION_ACCESS_DENIED',
  
  // File System Errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_ACCESS_DENIED = 'FILE_ACCESS_DENIED',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  DIRECTORY_NOT_FOUND = 'DIRECTORY_NOT_FOUND',
  
  // Network Errors
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_UNREACHABLE = 'NETWORK_UNREACHABLE',
  NETWORK_SSL_ERROR = 'NETWORK_SSL_ERROR',
  
  // Configuration Errors
  CONFIG_INVALID = 'CONFIG_INVALID',
  CONFIG_MISSING = 'CONFIG_MISSING',
  CONFIG_SCHEMA_ERROR = 'CONFIG_SCHEMA_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  
  // Authentication Errors
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_PERMISSION_DENIED = 'AUTH_PERMISSION_DENIED',
  
  // General Errors
  NOT_FOUND = 'NOT_FOUND',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

export interface OpenCodeError {
  readonly code: ErrorCode
  readonly message: string
  readonly context?: Record<string, any>
  readonly cause?: Error
  readonly timestamp: Date
  readonly recoverable: boolean
}

// Error creation utilities
export function createError(
  code: ErrorCode,
  message: string,
  options: {
    context?: Record<string, any>
    cause?: Error
    recoverable?: boolean
  } = {}
): OpenCodeError {
  return {
    code,
    message,
    context: options.context,
    cause: options.cause,
    timestamp: new Date(),
    recoverable: options.recoverable ?? false,
  }
}

// Specific error creators
export function cliError(
  code: ErrorCode,
  message: string,
  context?: Record<string, any>
): OpenCodeError {
  return createError(code, message, { context, recoverable: true })
}

export function databaseError(
  code: ErrorCode,
  message: string,
  cause?: Error
): OpenCodeError {
  return createError(code, message, { cause, recoverable: false })
}

export function toolError(
  code: ErrorCode,
  message: string,
  context?: Record<string, any>
): OpenCodeError {
  return createError(code, message, { context, recoverable: true })
}

export function providerError(
  code: ErrorCode,
  message: string,
  context?: Record<string, any>
): OpenCodeError {
  return createError(code, message, { context, recoverable: true })
}

export function fileSystemError(
  code: ErrorCode,
  message: string,
  context?: Record<string, any>
): OpenCodeError {
  return createError(code, message, { context, recoverable: true })
}

export function systemError(
  code: ErrorCode,
  message: string,
  cause?: Error
): OpenCodeError {
  return createError(code, message, { cause, recoverable: false })
}

// Error classification
export function isRecoverable(error: OpenCodeError): boolean {
  return error.recoverable
}

export function isCritical(error: OpenCodeError): boolean {
  return [
    ErrorCode.DATABASE_CORRUPTION,
    ErrorCode.INTERNAL_ERROR,
  ].includes(error.code)
}

export function requiresUserAction(error: OpenCodeError): boolean {
  return [
    ErrorCode.PROVIDER_NOT_CONFIGURED,
    ErrorCode.AUTH_INVALID_CREDENTIALS,
    ErrorCode.CONFIG_MISSING,
    ErrorCode.TOOL_PERMISSION_DENIED,
  ].includes(error.code)
}

// User-friendly error messages
export function getUserMessage(error: OpenCodeError): string {
  switch (error.code) {
    case ErrorCode.CLI_INVALID_COMMAND:
      return 'Invalid command. Run "code --help" for available commands.'
    
    case ErrorCode.PROVIDER_NOT_CONFIGURED:
      return 'No AI provider configured. Run "code auth login" to set up authentication.'
    
    case ErrorCode.TOOL_PERMISSION_DENIED:
      return 'Permission denied. This operation requires your approval.'
    
    case ErrorCode.FILE_NOT_FOUND:
      return `File not found: ${error.context?.path || 'unknown'}`
    
    case ErrorCode.NETWORK_UNREACHABLE:
      return 'Network connection failed. Please check your internet connection.'
    
    case ErrorCode.PROVIDER_RATE_LIMITED:
      return 'API rate limit exceeded. Please wait before trying again.'
    
    case ErrorCode.LLM_API_ERROR:
      return 'AI service error. Please try again or switch to a different model.'
    
    case ErrorCode.CONFIGURATION_ERROR:
      return 'Configuration error. Please check your settings.'
    
    case ErrorCode.NOT_FOUND:
      return 'The requested resource was not found.'
    
    default:
      return error.message
  }
}

// Error recovery suggestions
export function getRecoverySuggestion(error: OpenCodeError): string | null {
  switch (error.code) {
    case ErrorCode.PROVIDER_NOT_CONFIGURED:
      return 'Run: code auth login'
    
    case ErrorCode.FILE_NOT_FOUND:
      return 'Check the file path and try again'
    
    case ErrorCode.NETWORK_UNREACHABLE:
      return 'Check your internet connection and retry'
    
    case ErrorCode.PROVIDER_RATE_LIMITED:
      return 'Wait a few minutes and try again'
    
    case ErrorCode.DATABASE_CORRUPTION:
      return 'Contact support for database recovery assistance'
    
    default:
      return null
  }
} 