import type { ChatMessage, ToolCall } from '../chat/service.js'

export interface ContextManagerConfig {
  maxTokens: number
  // A simple heuristic: average characters per token. 4 is a common estimate.
  charsPerToken?: number
}

/**
 * Manages the conversation context to stay within the LLM's token limit.
 * Implements a strategy that combines a sliding window with importance scoring
 * to preserve the most critical messages.
 */
export class ContextManager {
  private readonly config: Required<ContextManagerConfig>

  constructor(config: ContextManagerConfig) {
    this.config = {
      charsPerToken: 4,
      ...config,
    }
  }

  /**
   * Estimates the token count for a given message.
   * This is a simple heuristic and not perfectly accurate.
   */
  private estimateTokenCount(message: ChatMessage): number {
    let count = Math.ceil(message.content.length / this.config.charsPerToken)
    if (message.toolCalls) {
      // Add a rough estimate for the tool call overhead
      count += message.toolCalls.length * 20
    }
    return count
  }

  /**
   * Assigns an importance score to a message. Higher scores are more likely
   * to be kept.
   * @param message The message to score.
   * @param index The index of the message in the conversation.
   * @param totalMessages The total number of messages.
   */
  private getMessageImportance(
    message: ChatMessage,
    index: number,
    totalMessages: number
  ): number {
    // System prompt is always essential
    if (message.role === 'system') {
      return Infinity
    }
    // Recent messages are very important
    const recencyScore = (index + 1) / totalMessages
    let roleScore = 0
    switch (message.role) {
      case 'user':
        roleScore = 1.0 // User questions provide key context
        break
      case 'tool':
        roleScore = 0.9 // Tool results are important for follow-up
        break
      case 'assistant':
        roleScore = message.toolCalls ? 1.1 : 0.8 // Assistant messages with tool calls are very important
        break
    }
    // Combine scores, giving heavy weight to recency
    return roleScore + recencyScore * 2
  }

  /**
   * Builds the final context to be sent to the LLM, ensuring it fits
   * within the specified token limit.
   * @param messages The full history of chat messages.
   * @returns A pruned list of messages that fits the token limit.
   */
  public buildContext(messages: ChatMessage[]): ChatMessage[] {
    let currentTokenCount = 0
    const messageWithScores = messages.map((msg, i) => ({
      message: msg,
      score: this.getMessageImportance(msg, i, messages.length),
      tokenCount: this.estimateTokenCount(msg),
    }))

    // Always include the system message if it exists
    const systemMessage = messageWithScores.find(m => m.message.role === 'system')
    const otherMessages = messageWithScores.filter(m => m.message.role !== 'system')

    const context: typeof messageWithScores = []
    if (systemMessage) {
      context.push(systemMessage)
      currentTokenCount += systemMessage.tokenCount
    }

    // Sort other messages by importance score, descending
    otherMessages.sort((a, b) => b.score - a.score)

    // Add messages to the context until the token limit is reached
    for (const scoredMessage of otherMessages) {
      if (
        currentTokenCount + scoredMessage.tokenCount <=
        this.config.maxTokens
      ) {
        context.push(scoredMessage)
        currentTokenCount += scoredMessage.tokenCount
      }
    }

    // The context is built from most to least important. Now, sort it
    // back into chronological order for the LLM.
    context.sort(
      (a, b) =>
        (a.message.timestamp?.getTime() || 0) -
        (b.message.timestamp?.getTime() || 0)
    )

    return context.map(m => m.message)
  }
} 