import type { Argv } from "yargs"
import { getAppInfo } from "../utils/app-context.js"
import { UI } from "./ui.js"
import { VERSION } from "./version.js"

const COLOR = [
  UI.Style.TEXT_SUCCESS_BOLD,
  UI.Style.TEXT_INFO_BOLD,
  UI.Style.TEXT_HIGHLIGHT_BOLD,
  UI.Style.TEXT_WARNING_BOLD,
]

const TOOL: Record<string, [string, string]> = {
  opencode_todowrite: ["Todo", UI.Style.TEXT_WARNING_BOLD],
  opencode_todoread: ["Todo", UI.Style.TEXT_WARNING_BOLD],
  opencode_bash: ["Bash", UI.Style.TEXT_DANGER_BOLD],
  opencode_edit: ["Edit", UI.Style.TEXT_SUCCESS_BOLD],
  opencode_glob: ["Glob", UI.Style.TEXT_INFO_BOLD],
  opencode_grep: ["Grep", UI.Style.TEXT_INFO_BOLD],
  opencode_list: ["List", UI.Style.TEXT_INFO_BOLD],
  opencode_read: ["Read", UI.Style.TEXT_HIGHLIGHT_BOLD],
  opencode_write: ["Write", UI.Style.TEXT_SUCCESS_BOLD],
}

export const RunCommand = {
  command: "run [message..]",
  describe: "Run OpenCode with a message",
  builder: (yargs: Argv) => {
    return yargs
      .positional("message", {
        describe: "Message to send",
        type: "string",
        array: true,
        default: [],
      })
      .option("session", {
        describe: "Session ID to continue",
        type: "string",
      })
  },
  handler: async (args: any) => {
    const message = args.message.join(" ")
    
    UI.println(UI.Style.TEXT_HIGHLIGHT_BOLD + "◍  OpenCode " + VERSION)
    UI.empty()
    UI.println(UI.Style.TEXT_NORMAL_BOLD + "> " + message)
    UI.empty()
    UI.println(UI.Style.TEXT_WARNING_BOLD + "⚠  Run command not yet implemented in v2")
    UI.println("This is a placeholder while the new architecture is being built.")
    UI.empty()
    
    console.log("Message received:", message)
    console.log("Session ID:", args.session || "new")
  },
}
