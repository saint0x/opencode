import { z } from "zod"
import * as path from "path"
import { Tool } from "./tool.js"
import { FileTimes } from "./util/file-times.js"
import { createTwoFilesPatch } from "diff"
import { getAppInfo } from "../utils/app-context.js"
import DESCRIPTION from "./edit.txt"

export const EditTool = Tool.define({
  id: "opencode.edit",
  description: DESCRIPTION,
  parameters: z.object({
    filePath: z.string().describe("The absolute path to the file to modify"),
    oldString: z.string().describe("The text to replace"),
    newString: z
      .string()
      .describe(
        "The text to replace it with (must be different from old_string)",
      ),
    replaceAll: z
      .boolean()
      .nullable()
      .describe("Replace all occurences of old_string (default false)"),
  }),
  async execute(params, ctx) {
    if (!params.filePath) {
      throw new Error("filePath is required")
    }

    const app = getAppInfo()
    const filepath = path.isAbsolute(params.filePath)
      ? params.filePath
      : path.join(app.paths.cwd, params.filePath)

    // TODO: Add permission system back

    let contentOld = ""
    let contentNew = ""
    await (async () => {
      if (params.oldString === "") {
        contentNew = params.newString
        await Bun.write(filepath, params.newString)
        return
      }

      const file = Bun.file(filepath)
      if (!(await file.exists())) throw new Error(`File ${filepath} not found`)
      const stats = await file.stat()
      if (stats.isDirectory())
        throw new Error(`Path is a directory, not a file: ${filepath}`)
      await FileTimes.assert(ctx.sessionID, filepath)
      contentOld = await file.text()
      const index = contentOld.indexOf(params.oldString)
      if (index === -1)
        throw new Error(
          `oldString not found in file. Make sure it matches exactly, including whitespace and line breaks`,
        )

      if (params.replaceAll) {
        contentNew = contentOld.replaceAll(params.oldString, params.newString)
      }

      if (!params.replaceAll) {
        const lastIndex = contentOld.lastIndexOf(params.oldString)
        if (index !== lastIndex)
          throw new Error(
            `oldString appears multiple times in the file. Please provide more context to ensure a unique match`,
          )

        contentNew =
          contentOld.substring(0, index) +
          params.newString +
          contentOld.substring(index + params.oldString.length)
      }

      await file.write(contentNew)
    })()

    const diff = createTwoFilesPatch(filepath, filepath, contentOld, contentNew)

    FileTimes.read(ctx.sessionID, filepath)

    // TODO: Add LSP diagnostics back
    let output = `File edited successfully.`
    if (contentOld !== contentNew) {
      output += `\n\nDiff:\n${diff}`
    }

    return {
      metadata: {
        diff,
        title: `${path.relative(app.paths.cwd, filepath)}`,
      },
      output,
    }
  },
})
