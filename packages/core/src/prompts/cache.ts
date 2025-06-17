import type { SystemPromptConfig } from './index.js'

export interface PromptCacheEntry {
  prompt: SystemPromptConfig
  lastUsed: number
  useCount: number
  hash: string
}

export class SystemPromptCache {
  private cache: Map<string, PromptCacheEntry> = new Map()
  private readonly MAX_CACHE_SIZE = parseInt(process.env.PROMPT_CACHE_MAX_SIZE || '100')
  private readonly TTL = parseInt(process.env.PROMPT_CACHE_TTL_MINUTES || '30') * 60 * 1000

  /**
   * Get a cached prompt by hash
   */
  get(hash: string): SystemPromptConfig | null {
    const entry = this.cache.get(hash)
    if (!entry) return null

    // Check if expired
    if (Date.now() - entry.lastUsed > this.TTL) {
      this.cache.delete(hash)
      return null
    }

    // Update usage stats
    entry.lastUsed = Date.now()
    entry.useCount++

    return entry.prompt
  }

  /**
   * Store a prompt in cache
   */
  set(prompt: SystemPromptConfig): string {
    const hash = this.createHash(prompt.content)
    
    // Cleanup if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictLeastUsed()
    }

    this.cache.set(hash, {
      prompt,
      lastUsed: Date.now(),
      useCount: 1,
      hash
    })

    return hash
  }

  /**
   * Check if a prompt is cached
   */
  has(content: string): boolean {
    const hash = this.createHash(content)
    const entry = this.cache.get(hash)
    
    if (!entry) return false
    
    // Check if expired
    if (Date.now() - entry.lastUsed > this.TTL) {
      this.cache.delete(hash)
      return false
    }

    return true
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number
    maxSize: number
    hitRate: number
    mostUsed: Array<{ id: string; name: string; useCount: number }>
  } {
    this.cleanup()
    
    const entries = Array.from(this.cache.values())
    const totalUses = entries.reduce((sum, entry) => sum + entry.useCount, 0)
    const mostUsed = entries
      .sort((a, b) => b.useCount - a.useCount)
      .slice(0, 5)
      .map(entry => ({
        id: entry.prompt.id,
        name: entry.prompt.name,
        useCount: entry.useCount
      }))

    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      hitRate: totalUses > 0 ? entries.filter(e => e.useCount > 1).length / entries.length : 0,
      mostUsed
    }
  }

  /**
   * Clear expired entries
   */
  cleanup(): number {
    const now = Date.now()
    let removed = 0
    
    for (const [hash, entry] of this.cache.entries()) {
      if (now - entry.lastUsed > this.TTL) {
        this.cache.delete(hash)
        removed++
      }
    }
    
    return removed
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Create a hash from prompt content
   */
  private createHash(content: string): string {
    // Simple hash function - in production you might want something more robust
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * Evict least recently used entries
   */
  private evictLeastUsed(): void {
    const entries = Array.from(this.cache.entries())
    entries.sort(([, a], [, b]) => a.lastUsed - b.lastUsed)
    
    // Remove oldest 10% of entries
    const toRemove = Math.max(1, Math.floor(entries.length * 0.1))
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0])
    }
  }
}

// Global cache instance
export const systemPromptCache = new SystemPromptCache() 