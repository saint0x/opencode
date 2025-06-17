import { z } from "zod"
import path from "path"
import { Tool } from "./tool"
import { App } from "../app/app"
import DESCRIPTION from "./glob.txt"

export const GlobTool = Tool.define({
  id: "opencode.glob",
  description: DESCRIPTION,
  parameters: z.object({
    pattern: z.string().describe("The glob pattern to match files against"),
    path: z
      .string()
      .nullable()
      .describe(
        `The directory to search in. If not specified, the current working directory will be used. IMPORTANT: Omit this field to use the default directory. DO NOT enter "undefined" or "null" - simply omit it for the default behavior. Must be a valid directory path if provided.`,
      ),
  }),
  async execute(params) {
    const app = App.info()
    let search = params.path ?? app.path.cwd
    search = path.isAbsolute(search)
      ? search
      : path.resolve(app.path.cwd, search)

    const limit = 100
    const glob = new Bun.Glob(params.pattern)
    const files = []
    let truncated = false
    for await (const file of glob.scan({ cwd: search, dot: true })) {
      if (files.length >= limit) {
        truncated = true
        break
      }
      const full = path.resolve(search, file)
      const stats = await Bun.file(full)
        .stat()
        .then((x) => x.mtime.getTime())
        .catch(() => 0)
      files.push({
        path: full,
        mtime: stats,
      })
    }
    files.sort((a, b) => b.mtime - a.mtime)

    const output = []
    if (files.length === 0) output.push("No files found")
    if (files.length > 0) {
      output.push(...files.map((f) => f.path))
      if (truncated) {
        output.push("")
        output.push(
          "(Results are truncated. Consider using a more specific path or pattern.)",
        )
      }
    }

    return {
      metadata: {
        count: files.length,
        truncated,
        title: path.relative(app.path.root, search),
      },
      output: output.join("\n"),
    }
  },
})
