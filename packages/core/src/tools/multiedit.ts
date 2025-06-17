import { z } from "zod"
import { Tool } from "./tool.js"
import { EditTool } from "./edit.js"
import DESCRIPTION from "./multiedit.txt"
import path from "path"
import { getAppInfo } from "../utils/app-context.js"

export const MultiEditTool = Tool.define({
  id: "opencode.multiedit",
  description: DESCRIPTION,
  parameters: z.object({
    filePath: z.string().describe("The absolute path to the file to modify"),
    edits: z
      .array(EditTool.parameters)
      .describe("Array of edit operations to perform sequentially on the file"),
  }),
  async execute(params, ctx) {
    const results = []
    for (const [, edit] of params.edits.entries()) {
      const result = await EditTool.execute(
        {
          filePath: params.filePath,
          oldString: edit.oldString,
          newString: edit.newString,
          replaceAll: edit.replaceAll,
        },
        ctx,
      )
      results.push(result)
    }
    const app = getAppInfo()
    return {
      metadata: {
        results: results.map((r) => r.metadata),
        title: path.relative(app.paths.cwd, params.filePath),
      },
      output: results.at(-1)!.output,
    }
  },
})
