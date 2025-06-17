import {
  Tool,
  type ToolExecutionContext,
  type ToolExecutionResult,
} from '../registry'
import {
  Result,
  ok,
  err,
  type OpenCodeError,
} from '@opencode/types'
import {
  ToolParam,
  createToolDefinition,
  createToolError,
  withToolExecution,
  createToolSuccess,
} from '../helpers'
import type { OpenCodeDatabase } from '../../database/client'

export class TodoTool implements Tool {
  definition = createToolDefinition(
    'todo',
    'Manage a todo list. Supports adding, listing, and completing tasks.',
    'management',
    [
      { name: 'subcommand', type: 'string', description: 'The action to perform: "add", "list", or "complete".', required: true },
      { name: 'content', type: 'string', description: 'The todo content (for "add").', required: false },
      { name: 'id', type: 'string', description: 'The ID of the todo to complete (for "complete").', required: false },
      { name: 'all', type: 'boolean', description: 'List all todos, not just from the current session (for "list").', required: false },
    ],
    [
      {
        description: 'Add a new todo to the current session.',
        parameters: { subcommand: 'add', content: 'Implement the UI' },
      },
      {
        description: 'List pending todos for the current session.',
        parameters: { subcommand: 'list' },
      },
      {
        description: 'Mark a todo as complete.',
        parameters: { subcommand: 'complete', id: 'todo_123' },
      },
    ]
  )

  constructor(private db: OpenCodeDatabase) {}

  async execute(
    parameters: { subcommand: string; content?: string; id?: string; all?: boolean },
    context: ToolExecutionContext
  ): Promise<Result<ToolExecutionResult, OpenCodeError>> {
    return withToolExecution(context, async () => {
      const { subcommand, content, id, all } = parameters

      switch (subcommand) {
        case 'add':
          if (!content) return createToolError('Missing "content" for "add" subcommand.')
          const newId = `todo_${Date.now()}`
          const result = this.db.addTodo({
            id: newId,
            content,
            session_id: context.sessionId || null,
            metadata: JSON.stringify({}),
          })
          if (!result.success) return createToolError(result.error.message)
          return createToolSuccess(`Added todo: ${newId}`, { id: newId })

        case 'list':
          const listResult = this.db.listTodos(all ? undefined : context.sessionId, 'pending')
          if (!listResult.success) return createToolError(listResult.error.message)
          const output = listResult.data.map(t => `- [ ] ${t.id}: ${t.content}`).join('\n')
          return createToolSuccess(output || 'No pending todos.', { count: listResult.data.length })

        case 'complete':
          if (!id) return createToolError('Missing "id" for "complete" subcommand.')
          const completeResult = this.db.updateTodoStatus(id, 'completed')
          if (!completeResult.success) return createToolError(completeResult.error.message)
          return createToolSuccess(`Completed todo: ${id}`, { id })

        default:
          return createToolError(`Unknown subcommand: ${subcommand}. Available: add, list, complete.`)
      }
    })
  }
} 