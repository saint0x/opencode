import {
  Tool,
  ToolExecutionContext,
  ToolExecutionResult,
} from '../registry.js'
import { Result, ok, err, type OpenCodeError } from '@opencode/types'
import {
  ToolParam,
  createToolDefinition,
  createToolSuccess,
  createToolError,
  ToolTimer,
  extractParameters,
  withToolExecution,
} from '../helpers.js'
import type { OpenCodeDatabase } from '../../database/client.js'

export class TodoTool implements Tool {
  definition = createToolDefinition(
    'todo',
    'Manage a todo list. Todos can be session-specific or global.',
    'management',
    [
      ToolParam.content(
        'subcommand',
        'The action to perform: "add", "list", or "complete".'
      ),
      ToolParam.content('content', 'The todo content (for "add").'),
      ToolParam.content('id', 'The ID of the todo to complete (for "complete").'),
      ToolParam.flag(
        'all',
        'List all todos, not just from the current session.',
        false
      ),
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
    parameters: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<Result<ToolExecutionResult, OpenCodeError>> {
    return withToolExecution(context, async () => {
      const timer = new ToolTimer()
      const { subcommand, content, id, all } = parameters

      switch (subcommand) {
        case 'add':
          if (!content) return createToolError('Missing "content" for "add" subcommand.', {}, timer.elapsed())
          const newId = `todo_${Date.now()}`
          const result = this.db.addTodo({
            id: newId,
            content,
            session_id: context.sessionId || null,
            metadata: JSON.stringify({}),
          })
          if (!result.success) return createToolError(result.error.message, {}, timer.elapsed())
          return createToolSuccess(`Added todo: ${newId}`, { id: newId }, timer.elapsed())

        case 'list':
          const listResult = this.db.listTodos(all ? undefined : context.sessionId, 'pending')
          if (!listResult.success) return createToolError(listResult.error.message, {}, timer.elapsed())
          const output = listResult.data.map(t => `- [ ] ${t.id}: ${t.content}`).join('\n')
          return createToolSuccess(output || 'No pending todos.', { count: listResult.data.length }, timer.elapsed())

        case 'complete':
          if (!id) return createToolError('Missing "id" for "complete" subcommand.', {}, timer.elapsed())
          const completeResult = this.db.updateTodoStatus(id, 'completed')
          if (!completeResult.success) return createToolError(completeResult.error.message, {}, timer.elapsed())
          return createToolSuccess(`Completed todo: ${id}`, { id }, timer.elapsed())

        default:
          return createToolError(`Unknown subcommand: ${subcommand}. Available: add, list, complete.`, {}, timer.elapsed())
      }
    }).then(result => {
      if (result.success) {
        return ok(result.data)
      } else {
        const toolExecResult = createToolError(result.error.message, result.error.context)
        return ok(toolExecResult)
      }
    })
  }
} 