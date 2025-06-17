import { z } from "zod"
import * as path from "path"
import { Tool } from "./tool.js"
import { FileTimes } from "./util/file-times.js"
import { getAppInfo } from "../utils/app-context.js"
import DESCRIPTION from "./write.txt"

export const WriteTool = Tool.define({
  id: "opencode.write",
  description: DESCRIPTION,
  parameters: z.object({
    filePath: z
      .string()
      .describe(
        "The absolute path to the file to write (must be absolute, not relative)",
      ),
    content: z.string().describe("The content to write to the file"),
  }),
  async execute(params, ctx) {
    const app = getAppInfo()
    const filepath = path.isAbsolute(params.filePath)
      ? params.filePath
      : path.join(app.paths.cwd, params.filePath)

    const file = Bun.file(filepath)
    const exists = await file.exists()
    if (exists) await FileTimes.assert(ctx.sessionID, filepath)

    // TODO: Add permission system back

    await Bun.write(filepath, params.content)
    FileTimes.read(ctx.sessionID, filepath)

    const output = exists 
      ? `File overwritten successfully: ${filepath}`
      : `New file created successfully: ${filepath}`

    return {
      metadata: {
        filepath,
        exists: exists,
        title: path.relative(app.paths.cwd, filepath),
      },
      output,
    }
  },
})
