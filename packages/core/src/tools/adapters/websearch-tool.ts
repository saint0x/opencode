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
  toolError,
  ErrorCode,
} from '@opencode/types'
import {
  ToolParam,
  createToolDefinition,
  createToolError,
  withToolExecution,
  createToolSuccess,
} from '../helpers'

interface SerperSearchResult {
  title: string
  link: string
  snippet: string
  position: number
}

export class WebSearchTool implements Tool {
  definition = createToolDefinition(
    'websearch',
    'Perform a web search using the Serper.dev API.',
    'search',
    [
      { name: 'query', type: 'string', description: 'The search query.', required: true },
    ],
    [
      {
        description: 'Search for the latest TypeScript features.',
        parameters: { query: 'TypeScript latest features' },
      },
    ]
  )

  async execute(
    parameters: { query: string },
    context: ToolExecutionContext
  ): Promise<Result<ToolExecutionResult, OpenCodeError>> {
    const apiKey = process.env.SERPER_API_KEY
    if (!apiKey) {
      return err(toolError(
        ErrorCode.CONFIGURATION_ERROR,
        'SERPER_API_KEY environment variable is not set.'
      ))
    }

    return withToolExecution(context, async () => {
      try {
        const response = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ q: parameters.query }),
        })

        if (!response.ok) {
          return createToolError(`Serper API error: ${response.status} ${response.statusText}`)
        }

        const data = await response.json() as any
        const results = data.organic as SerperSearchResult[]

        if (!results || results.length === 0) {
          return createToolSuccess('No search results found.', { query: parameters.query })
        }

        const output = results
          .map(r => `[${r.title}](${r.link})\n${r.snippet}`)
          .join('\n\n')

        return createToolSuccess(
          output,
          {
            query: parameters.query,
            count: results.length,
          }
        )
      } catch (error: any) {
        return createToolError(`Web search failed: ${error.message}`)
      }
    })
  }
} 