import { z } from "zod"
import { OpenCodeError } from "../utils/error.js"

export class CancelledError extends Error {
  constructor() {
    super('Operation cancelled by user')
    this.name = 'CancelledError'
  }
}

export class UI {
  static Style = {
    TEXT_SUCCESS_BOLD: '\x1b[1;32m',
    TEXT_INFO_BOLD: '\x1b[1;34m', 
    TEXT_HIGHLIGHT_BOLD: '\x1b[1;33m',
    TEXT_WARNING_BOLD: '\x1b[1;35m',
    TEXT_DANGER_BOLD: '\x1b[1;31m',
    TEXT_NORMAL_BOLD: '\x1b[1m',
    TEXT_NORMAL: '\x1b[0m',
    TEXT_DIM: '\x1b[2m',
    RESET: '\x1b[0m',
  }

  static empty() {
    console.log('')
  }

  static println(...args: string[]) {
    console.log(...args)
  }

  static logo(prefix = '') {
    return `${prefix}◍ OpenCode - AI Coding Assistant`
  }

  static async input(prompt: string): Promise<string> {
    process.stdout.write(prompt + ' ')
    return new Promise((resolve) => {
      process.stdin.once('data', (data) => {
        resolve(data.toString().trim())
      })
    })
  }

  static CancelledError = CancelledError
}
