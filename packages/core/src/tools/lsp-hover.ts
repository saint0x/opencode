import { z } from "zod"
import { Tool } from "./tool.js"
import path from "path"
import { getAppInfo } from "../utils/app-context.js"
import DESCRIPTION from "./lsp-hover.txt"

export const LspHoverTool = Tool.define({
  id: "opencode.lsp_hover",
  description: DESCRIPTION,
  parameters: z.object({
    file: z.string().describe("The path to the file to get diagnostics."),
    line: z.number().describe("The line number to get diagnostics."),
    character: z.number().describe("The character number to get diagnostics."),
  }),
  execute: async (args) => {
    const app = getAppInfo()
    const file = path.isAbsolute(args.file)
      ? args.file
      : path.join(app.paths.cwd, args.file)
    
    // TODO: Implement LSP integration in v2
    return {
      metadata: {
        title: `${path.relative(app.paths.cwd, file)}:${args.line}:${args.character}`,
      },
      output: "LSP hover information not yet implemented in OpenCode v2. This feature will be restored in a future update.",
    }
  },
})
