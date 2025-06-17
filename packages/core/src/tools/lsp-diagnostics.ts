import { z } from "zod"
import { Tool } from "./tool.js"
import path from "path"
import { getAppInfo } from "../utils/app-context.js"
import DESCRIPTION from "./lsp-diagnostics.txt"

export const LspDiagnosticTool = Tool.define({
  id: "opencode.lsp_diagnostics",
  description: DESCRIPTION,
  parameters: z.object({
    path: z.string().describe("The path to the file to get diagnostics."),
  }),
  execute: async (args) => {
    const app = getAppInfo()
    const normalized = path.isAbsolute(args.path)
      ? args.path
      : path.join(app.paths.cwd, args.path)
    
    // TODO: Implement LSP integration in v2
    return {
      metadata: {
        title: path.relative(app.paths.cwd, normalized),
      },
      output: "LSP diagnostics not yet implemented in OpenCode v2. This feature will be restored in a future update.",
    }
  },
})
