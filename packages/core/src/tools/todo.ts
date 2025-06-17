import { z } from "zod"
import { Tool } from "./tool.js"
import DESCRIPTION_WRITE from "./todowrite.txt"

const TodoInfo = z.object({
  content: z.string().min(1).describe("Brief description of the task"),
  status: z
    .enum(["pending", "in_progress", "completed"])
    .describe("Current status of the task"),
  priority: z
    .enum(["high", "medium", "low"])
    .describe("Priority level of the task"),
  id: z.string().describe("Unique identifier for the todo item"),
})
type TodoInfo = z.infer<typeof TodoInfo>

// Simple in-memory store - TODO: Replace with database storage in v2
const todoStore: { [sessionId: string]: TodoInfo[] } = {}

export const TodoWriteTool = Tool.define({
  id: "opencode.todowrite",
  description: DESCRIPTION_WRITE,
  parameters: z.object({
    todos: z.array(TodoInfo).describe("The updated todo list"),
  }),
  async execute(params, opts) {
    todoStore[opts.sessionID] = params.todos
    return {
      output: JSON.stringify(params.todos, null, 2),
      metadata: {
        title: `${params.todos.filter((x) => x.status !== "completed").length} todos`,
        todos: params.todos,
      },
    }
  },
})

export const TodoReadTool = Tool.define({
  id: "opencode.todoread",
  description: "Use this tool to read your todo list",
  parameters: z.object({}),
  async execute(_params, opts) {
    const todos = todoStore[opts.sessionID] ?? []
    return {
      metadata: {
        todos,
        title: `${todos.filter((x) => x.status !== "completed").length} todos`,
      },
      output: JSON.stringify(todos, null, 2),
    }
  },
})
