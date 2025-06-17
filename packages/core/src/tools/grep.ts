import { z } from "zod"
import { Tool } from "./tool.js"
import { getAppInfo } from "../utils/app-context.js"

import DESCRIPTION from "./grep.txt"

export const GrepTool = Tool.define({
  id: "opencode.grep",
  description: DESCRIPTION,
  parameters: z.object({
    pattern: z
      .string()
      .describe("The regex pattern to search for in file contents"),
    path: z
      .string()
      .nullable()
      .describe(
        "The directory to search in. Defaults to the current working directory.",
      ),
    include: z
      .string()
      .nullable()
      .describe(
        'File pattern to include in the search (e.g. "*.js", "*.{ts,tsx}")',
      ),
  }),
  async execute(params) {
    if (!params.pattern) {
      throw new Error("pattern is required")
    }

    const app = getAppInfo()
    const searchPath = params.path || app.paths.cwd

    // Use native grep if available, fallback to manual search
    let output = ""
    let exitCode = 0
    
    try {
      const args = ["-n", "-r", params.pattern]
      if (params.include) {
        args.push("--include", params.include)
      }
      args.push(searchPath)

      const proc = Bun.spawn(["grep", ...args], {
        stdout: "pipe",
        stderr: "pipe",
      })

      output = await new Response(proc.stdout).text()
      const errorOutput = await new Response(proc.stderr).text()
      exitCode = await proc.exited

      if (exitCode === 1) {
        return {
          metadata: { matches: 0, truncated: false, title: params.pattern },
          output: "No files found",
        }
      }

      if (exitCode !== 0) {
        // Fallback to manual search if grep not available
        throw new Error("grep not available, using fallback")
      }
    } catch (error) {
      // Fallback to manual file search
      const pattern = new RegExp(params.pattern, 'gi')
      const glob = new Bun.Glob(params.include || "**/*")
      const matches: Array<{
        path: string
        modTime: number
        lineNum: number
        lineText: string
      }> = []

      for await (const file of glob.scan({ cwd: searchPath })) {
        const fullPath = require('path').join(searchPath, file)
        try {
          const bunFile = Bun.file(fullPath)
          const stat = await bunFile.stat()
          if (stat.isDirectory()) continue
          
          const content = await bunFile.text()
          const lines = content.split('\n')
          
          lines.forEach((line, index) => {
            if (pattern.test(line)) {
              matches.push({
                path: fullPath,
                modTime: stat.mtime.getTime(),
                lineNum: index + 1,
                lineText: line.trim(),
              })
            }
          })
        } catch {}
      }

      matches.sort((a, b) => b.modTime - a.modTime)
      const limit = 100
      const truncated = matches.length > limit
      const finalMatches = truncated ? matches.slice(0, limit) : matches

      if (finalMatches.length === 0) {
        return {
          metadata: { matches: 0, truncated: false, title: params.pattern },
          output: "No files found",
        }
      }

      const outputLines = [`Found ${finalMatches.length} matches`]
      let currentFile = ""
      for (const match of finalMatches) {
        if (currentFile !== match.path) {
          if (currentFile !== "") outputLines.push("")
          currentFile = match.path
          outputLines.push(`${match.path}:`)
        }
        outputLines.push(`  Line ${match.lineNum}: ${match.lineText}`)
      }

      if (truncated) {
        outputLines.push("")
        outputLines.push("(Results are truncated. Consider using a more specific path or pattern.)")
      }

      return {
        metadata: {
          matches: finalMatches.length,
          truncated,
          title: params.pattern,
        },
        output: outputLines.join("\n"),
      }
    }

    // Process grep output (successful case)
    const lines = output.trim().split("\n")
    const matches: Array<{
      path: string
      modTime: number
      lineNum: number
      lineText: string
    }> = []

    for (const line of lines) {
      if (!line) continue

      const parts = line.split(":", 3)
      if (parts.length < 3) continue

      const filePath = parts[0]
      const lineNum = parseInt(parts[1] || "0", 10)
      const lineText = parts[2]

      if (!filePath || !lineText) continue

      try {
        const file = Bun.file(filePath)
        const stats = await file.stat()
        
        matches.push({
          path: filePath,
          modTime: stats.mtime.getTime(),
          lineNum,
          lineText,
        })
      } catch {
        // Skip files that can't be accessed
      }
    }

    matches.sort((a, b) => b.modTime - a.modTime)

    const limit = 100
    const truncated = matches.length > limit
    const finalMatches = truncated ? matches.slice(0, limit) : matches

    if (finalMatches.length === 0) {
      return {
        metadata: { matches: 0, truncated: false, title: params.pattern },
        output: "No files found",
      }
    }

    const outputLines = [`Found ${finalMatches.length} matches`]

    let currentFile = ""
    for (const match of finalMatches) {
      if (currentFile !== match.path) {
        if (currentFile !== "") {
          outputLines.push("")
        }
        currentFile = match.path
        outputLines.push(`${match.path}:`)
      }
      outputLines.push(`  Line ${match.lineNum}: ${match.lineText}`)
    }

    if (truncated) {
      outputLines.push("")
      outputLines.push(
        "(Results are truncated. Consider using a more specific path or pattern.)",
      )
    }

    return {
      metadata: {
        matches: finalMatches.length,
        truncated,
        title: params.pattern,
      },
      output: outputLines.join("\n"),
    }
  },
})
