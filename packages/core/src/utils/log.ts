export interface LogLevel {
  value: number
  name: string
}

export const LogLevels = {
  DEBUG: { value: 0, name: 'DEBUG' },
  INFO: { value: 1, name: 'INFO' },
  WARN: { value: 2, name: 'WARN' },
  ERROR: { value: 3, name: 'ERROR' },
} as const

export interface LogEntry {
  timestamp: Date
  level: LogLevel
  service?: string
  message: string
  data?: unknown
}

class Logger {
  private level: LogLevel = LogLevels.INFO
  private service?: string
  private printLogs: boolean = false

  constructor(options: { service?: string; level?: LogLevel; print?: boolean } = {}) {
    if (options.service) {
      this.service = options.service
    }
    this.level = options.level ?? LogLevels.INFO
    this.printLogs = options.print ?? false
  }

  private log(level: LogLevel, message: string, data?: unknown) {
    if (level.value < this.level.value) return

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      ...(this.service ? { service: this.service } : {}),
      message,
      ...(data !== undefined ? { data } : {}),
    }

    if (this.printLogs) {
      const timestamp = entry.timestamp.toISOString()
      const service = this.service ? `[${this.service}]` : ''
      const dataStr = data ? ` ${JSON.stringify(data)}` : ''
      
      console.error(`${timestamp} ${level.name} ${service} ${message}${dataStr}`)
    }
  }

  debug(message: string, data?: unknown) {
    this.log(LogLevels.DEBUG, message, data)
  }

  info(message: string, data?: unknown) {
    this.log(LogLevels.INFO, message, data)
  }

  warn(message: string, data?: unknown) {
    this.log(LogLevels.WARN, message, data)
  }

  error(message: string | Error, data?: unknown) {
    const msg = message instanceof Error ? message.message : message
    const errorData = message instanceof Error ? 
      { ...(data && typeof data === 'object' ? data : {}), stack: message.stack, name: message.name } : 
      data
    this.log(LogLevels.ERROR, msg, errorData)
  }

  clone() {
    return new Logger({
      ...(this.service ? { service: this.service } : {}),
      level: this.level,
      print: this.printLogs,
    })
  }

  tag(key: string, value: string) {
    const newLogger = this.clone()
    newLogger.service = this.service ? `${this.service}:${key}=${value}` : `${key}=${value}`
    return newLogger
  }

  child(service: string) {
    return new Logger({
      service: this.service ? `${this.service}:${service}` : service,
      level: this.level,
      print: this.printLogs,
    })
  }
}

export class Log {
  private static instance: Logger | null = null

  static async init(options: { print?: boolean; level?: LogLevel } = {}) {
    Log.instance = new Logger({
      print: options.print ?? false,
      level: options.level ?? LogLevels.INFO,
    })
  }

  static get Default(): Logger {
    if (!Log.instance) {
      Log.instance = new Logger({ print: false })
    }
    return Log.instance
  }

  static create(options: { service?: string; level?: LogLevel } = {}): Logger {
    const printLogs = Log.instance ? (Log.instance as any).printLogs : false
    return new Logger({
      ...(options.service ? { service: options.service } : {}),
      level: options.level ?? LogLevels.INFO,
      print: printLogs,
    })
  }
}
