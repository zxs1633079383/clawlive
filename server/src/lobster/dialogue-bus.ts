import type { LobsterDialogueTurn } from '../realtime/types.js';

type DialogueHandler = (turn: LobsterDialogueTurn) => void;

interface LobsterSubscription {
  handler: DialogueHandler;
  collaborationMode: 'passive' | 'reactive' | 'proactive';
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

/**
 * EventEmitter-style bus for inter-lobster communication within a meeting.
 *
 * Features:
 * - Per-meeting isolation (each meeting has its own DialogueBus)
 * - Configurable history buffer with max turns (default 20)
 * - Collaboration mode enforcement:
 *   - passive: never receives broadcasts
 *   - reactive: only receives direct messages (toLobsterId matches)
 *   - proactive: receives all broadcasts and direct messages
 * - Rate limiting per lobster to prevent message flooding
 */
export class DialogueBus {
  private readonly subscribers = new Map<string, LobsterSubscription>();
  private readonly history: LobsterDialogueTurn[] = [];
  private readonly maxHistorySize: number;
  private readonly rateLimits = new Map<string, RateLimitEntry>();
  private readonly maxMessagesPerWindow: number;
  private readonly rateLimitWindowMs: number;

  constructor(options?: {
    maxHistorySize?: number;
    maxMessagesPerWindow?: number;
    rateLimitWindowMs?: number;
  }) {
    this.maxHistorySize = options?.maxHistorySize ?? 20;
    this.maxMessagesPerWindow = options?.maxMessagesPerWindow ?? 10;
    this.rateLimitWindowMs = options?.rateLimitWindowMs ?? 60_000;
  }

  /**
   * Subscribe a lobster to receive dialogue messages.
   * The collaborationMode determines which messages the lobster receives.
   */
  subscribe(
    lobsterId: string,
    handler: DialogueHandler,
    collaborationMode: 'passive' | 'reactive' | 'proactive' = 'reactive',
  ): void {
    this.subscribers.set(lobsterId, { handler, collaborationMode });
  }

  /**
   * Unsubscribe a lobster from dialogue messages.
   */
  unsubscribe(lobsterId: string): void {
    this.subscribers.delete(lobsterId);
    this.rateLimits.delete(lobsterId);
  }

  /**
   * Publish a dialogue turn to the bus.
   *
   * Rate-limits the sender. Then dispatches based on collaboration mode:
   * - If toLobsterId is set, only that lobster receives it (direct message).
   * - If toLobsterId is null, broadcast to all eligible lobsters except sender.
   *   Eligibility depends on collaboration mode:
   *   - passive lobsters do NOT receive broadcasts
   *   - reactive lobsters do NOT receive broadcasts (only direct messages)
   *   - proactive lobsters receive broadcasts
   *
   * Returns false if the sender was rate-limited.
   */
  publish(turn: LobsterDialogueTurn): boolean {
    // Rate limit check for sender
    if (!this.checkRateLimit(turn.fromLobsterId)) {
      console.warn(
        `[dialogue-bus] Rate limited lobster ${turn.fromLobsterId}`,
      );
      return false;
    }

    // Record in history
    this.history.push(turn);
    if (this.history.length > this.maxHistorySize) {
      this.history.splice(0, this.history.length - this.maxHistorySize);
    }

    if (turn.toLobsterId) {
      // Direct message — deliver regardless of collaboration mode
      const sub = this.subscribers.get(turn.toLobsterId);
      if (sub) {
        sub.handler(turn);
      }
    } else {
      // Broadcast — only proactive lobsters receive broadcasts
      for (const [lobsterId, sub] of this.subscribers) {
        if (lobsterId === turn.fromLobsterId) continue;

        if (sub.collaborationMode === 'proactive') {
          sub.handler(turn);
        }
        // passive and reactive lobsters skip broadcasts
      }
    }

    return true;
  }

  /**
   * Get recent dialogue history.
   */
  getRecentHistory(limit?: number): readonly LobsterDialogueTurn[] {
    const effectiveLimit = limit ?? this.maxHistorySize;
    return this.history.slice(-effectiveLimit);
  }

  /**
   * Get dialogue history filtered to a specific lobster
   * (turns they sent or received).
   */
  getHistoryForLobster(
    lobsterId: string,
    limit = 10,
  ): readonly LobsterDialogueTurn[] {
    return this.history
      .filter(
        (t) =>
          t.fromLobsterId === lobsterId ||
          t.toLobsterId === lobsterId ||
          t.toLobsterId === null,
      )
      .slice(-limit);
  }

  /**
   * Get the number of active subscribers.
   */
  get subscriberCount(): number {
    return this.subscribers.size;
  }

  /**
   * Clear all subscribers and history.
   */
  clear(): void {
    this.subscribers.clear();
    this.history.length = 0;
    this.rateLimits.clear();
  }

  /**
   * Check and update rate limit for a lobster.
   * Returns true if the message is allowed, false if rate-limited.
   */
  private checkRateLimit(lobsterId: string): boolean {
    const now = Date.now();
    const entry = this.rateLimits.get(lobsterId);

    if (!entry || now - entry.windowStart > this.rateLimitWindowMs) {
      // Start a new window
      this.rateLimits.set(lobsterId, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= this.maxMessagesPerWindow) {
      return false;
    }

    entry.count++;
    return true;
  }
}
