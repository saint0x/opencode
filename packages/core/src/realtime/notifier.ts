import { EventEmitter } from 'events'
import type { RealtimeEvent } from '@opencode/types'

/**
 * A type-safe event emitter for broadcasting real-time events
 * throughout the core application.
 */
export class RealtimeNotifier {
  private emitter = new EventEmitter()

  on(event: 'event', listener: (data: RealtimeEvent) => void): void {
    this.emitter.on(event, listener)
  }

  off(event: 'event', listener: (data: RealtimeEvent) => void): void {
    this.emitter.off(event, listener)
  }

  emit(data: RealtimeEvent): void {
    this.emitter.emit('event', data)
  }
}

// Create a singleton instance to be used across the application
export const realtimeNotifier = new RealtimeNotifier() 