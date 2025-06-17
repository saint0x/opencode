import { Tool } from "./tool.js"
import DESCRIPTION from "./task.txt"
import { z } from "zod"

export const TaskTool = Tool.define({
  id: "opencode.task",
  description: DESCRIPTION,
  parameters: z.object({
    description: z
      .string()
      .describe("A short (3-5 words) description of the task"),
    prompt: z.string().describe("The task for the agent to perform"),
  }),
  async execute(params, ctx) {
    // TODO: Implement sub-task creation in v2
    return {
      metadata: {
        title: params.description,
      },
      output: `Task "${params.description}" received. Sub-task execution not yet implemented in OpenCode v2. This feature will be restored in a future update.\n\nTask prompt: ${params.prompt}`,
    }
  },
})
