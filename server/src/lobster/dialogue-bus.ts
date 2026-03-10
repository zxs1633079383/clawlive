import type { LobsterDialogueTurn } from '../realtime/types.js';

type DialogueHandler = (turn: LobsterDialogueTurn) => void;

/**
 * EventEmitter-style bus for inter-lobster communication within a meeting.
 * Each meeting should have its own DialogueBus instance.
 */
export class DialogueBus {
  private readonly subscribers: Map<string, DialogueHandler> = new Map();
  private readonly history: LobsterDialogueTurn[] = [];
  private readonly maxHistorySize: number;

  constructor(maxHistorySize = 100) {
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Subscribe a lobster to receive dialogue messages.
   */
  subscribe(lobsterId: string, handler: DialogueHandler): void {
    this.subscribers.set(lobsterId, handler);
  }

  /**
   * Unsubscribe a lobster from dialogue messages.
   */
  unsubscribe(lobsterId: string): void {
    this.subscribers.delete(lobsterId);
  }

  /**
   * Publish a dialogue turn to the bus.
   * If toLobsterId is set, only that lobster receives it.
   * If toLobsterId is null, all lobsters except the sender receive it.
   */
  publish(turn: LobsterDialogueTurn): void {
    this.history.push(turn);
    if (this.history.length > this.maxHistorySize) {
      this.history.splice(0, this.history.length - this.maxHistorySize);
    }

    if (turn.toLobsterId) {
      // Direct message
      const handler = this.subscribers.get(turn.toLobsterId);
      if (handler) {
        handler(turn);
      }
    } else {
      // Broadcast to all except sender
      for (const [lobsterId, handler] of this.subscribers) {
        if (lobsterId !== turn.fromLobsterId) {
          handler(turn);
        }
      }
    }
  }

  /**
   * Get recent dialogue history.
   */
  getRecentHistory(limit = 20): readonly LobsterDialogueTurn[] {
    return this.history.slice(-limit);
  }

  /**
   * Clear all subscribers and history.
   */
  clear(): void {
    this.subscribers.clear();
    this.history.length = 0;
  }
}
