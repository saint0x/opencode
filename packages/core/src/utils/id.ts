import { z } from 'zod'

// Simple ID generation using timestamp + random for uniqueness
export function generateId(prefix?: string): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  const id = `${timestamp}${random}`
  
  return prefix ? `${prefix}_${id}` : id
}

// Generate ascending IDs (newer = larger)
export function generateAscendingId(prefix?: string): string {
  return generateId(prefix)
}

// Generate descending IDs (newer = smaller, for reverse chronological order)
export function generateDescendingId(prefix?: string): string {
  const timestamp = (Number.MAX_SAFE_INTEGER - Date.now()).toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  const id = `${timestamp}${random}`
  
  return prefix ? `${prefix}_${id}` : id
}

// Zod schema for validating IDs
export function createIdSchema(prefix?: string) {
  if (prefix) {
    return z.string().regex(new RegExp(`^${prefix}_[a-z0-9]+$`))
  }
  return z.string().regex(/^[a-z0-9]+$/)
}

// Legacy compatibility exports
export const Identifier = {
  ascending: generateAscendingId,
  descending: generateDescendingId,
  schema: createIdSchema,
} 