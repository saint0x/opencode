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
import TurndownService from 'turndown'

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024 // 5MB

export class WebFetchTool implements Tool {
  private turndownService: TurndownService

  constructor() {
    this.turndownService = new TurndownService()
  }

  definition = createToolDefinition(
    'webfetch',
    'Fetch content from a URL.',
    'search',
    [
      { name: 'url', type: 'string', description: 'The URL to fetch.', required: true },
      { name: 'format', type: 'string', description: 'The desired output format.', required: true },
    ],
    [
      {
        description: 'Fetch the text content of the example.com homepage.',
        parameters: { url: 'https://example.com', format: 'text' },
      },
    ]
  )

  async execute(
    parameters: { url: string; format: 'text' | 'markdown' | 'html' },
    context: ToolExecutionContext
  ): Promise<Result<ToolExecutionResult, OpenCodeError>> {
    return withToolExecution(context, async () => {
      try {
        const response = await fetch(parameters.url, {
          headers: { 'User-Agent': 'OpenCode-AI-Assistant/1.0' },
        })

        if (!response.ok) {
          return createToolError(`Request failed with status: ${response.status}`)
        }

        const contentLength = response.headers.get('content-length')
        if (contentLength && parseInt(contentLength) > MAX_RESPONSE_BYTES) {
          return createToolError('Response content is too large.')
        }

        const html = await response.text()
        let output = ''

        switch (parameters.format) {
          case 'html':
            output = html
            break
          case 'markdown':
            output = this.turndownService.turndown(html)
            break
          case 'text':
            output = html.replace(/<[^>]+>/g, '') // Basic strip tags
            break
        }

        return createToolSuccess(output, { url: parameters.url, format: parameters.format })
      } catch (error: any) {
        return createToolError(`Failed to fetch URL: ${error.message}`)
      }
    })
  }
} 