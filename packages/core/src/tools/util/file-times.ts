import { getAppInfo } from "../../utils/app-context.js"

export namespace FileTimes {
  // Simple in-memory storage for file read times
  const readTimes: {
    [sessionID: string]: {
      [path: string]: Date | undefined
    }
  } = {}

  export function read(sessionID: string, file: string) {
    readTimes[sessionID] = readTimes[sessionID] || {}
    readTimes[sessionID][file] = new Date()
  }

  export function get(sessionID: string, file: string) {
    return readTimes[sessionID]?.[file]
  }

  export async function assert(sessionID: string, filepath: string) {
    const time = get(sessionID, filepath)
    if (!time)
      throw new Error(
        `You must read the file ${filepath} before overwriting it. Use the Read tool first`,
      )
    const stats = await Bun.file(filepath).stat()
    if (stats.mtime.getTime() > time.getTime()) {
      throw new Error(
        `File ${filepath} has been modified since it was last read.\nLast modification: ${stats.mtime.toISOString()}\nLast read: ${time.toISOString()}\n\nPlease read the file again before modifying it.`,
      )
    }
  }
}
