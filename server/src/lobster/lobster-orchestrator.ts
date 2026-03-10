import { LobsterAgent } from './lobster-agent.js';
import { DialogueBus } from './dialogue-bus.js';
import { TriggerEvaluator } from './trigger-evaluator.js';
import type { LLMProvider } from '../llm/llm-provider.js';
import type { LobsterSkill, LobsterMessage, TranscriptSegment, LobsterDialogueTurn } from '../realtime/types.js';
import { ClaudeProvider } from '../llm/claude-provider.js';

// Global registry of orchestrators per meeting
const orchestrators = new Map<string, LobsterOrchestrator>();

export function getLobsterOrchestrator(meetingId: string): LobsterOrchestrator | undefined {
  return orchestrators.get(meetingId);
}

export function getOrCreateOrchestrator(meetingId: string): LobsterOrchestrator {
  const existing = orchestrators.get(meetingId);
  if (existing) return existing;
  const orchestrator = new LobsterOrchestrator(meetingId);
  orchestrators.set(meetingId, orchestrator);
  return orchestrator;
}

export function removeOrchestrator(meetingId: string): void {
  const orchestrator = orchestrators.get(meetingId);
  if (orchestrator) {
    orchestrator.destroy();
    orchestrators.delete(meetingId);
  }
}

/**
 * Manages all lobster agents within a single meeting.
 * Coordinates transcript distribution and inter-lobster dialogue.
 */
export class LobsterOrchestrator {
  private readonly lobsters: Map<string, LobsterAgent> = new Map();
  private readonly dialogueBus: DialogueBus = new DialogueBus();
  private readonly triggerEvaluator: TriggerEvaluator = new TriggerEvaluator();
  private readonly llmProvider: LLMProvider;

  constructor(
    public readonly meetingId: string,
    llmProvider?: LLMProvider,
  ) {
    this.llmProvider = llmProvider ?? new ClaudeProvider();
  }

  /**
   * Create a lobster agent for a user with the given skill.
   */
  createLobster(userId: string, skill: LobsterSkill): void {
    const agent = new LobsterAgent(
      skill,
      userId,
      this.meetingId,
      this.llmProvider,
      this.triggerEvaluator,
    );

    this.lobsters.set(userId, agent);

    // Subscribe to dialogue bus
    this.dialogueBus.subscribe(agent.lobsterId, (turn: LobsterDialogueTurn) => {
      agent.handleDialogue(turn).then((reply) => {
        if (reply) {
          this.dialogueBus.publish(reply);
        }
      }).catch((err) => {
        console.error(`[orchestrator] Dialogue error for ${agent.lobsterId}:`, err);
      });
    });

    console.log(`[orchestrator] Created lobster for user ${userId} with skill "${skill.name}" in meeting ${this.meetingId}`);
  }

  /**
   * Remove a lobster agent for a user.
   */
  removeLobster(userId: string): void {
    const agent = this.lobsters.get(userId);
    if (agent) {
      this.dialogueBus.unsubscribe(agent.lobsterId);
      this.triggerEvaluator.reset(agent.lobsterId);
      this.lobsters.delete(userId);
      console.log(`[orchestrator] Removed lobster for user ${userId} in meeting ${this.meetingId}`);
    }
  }

  /**
   * Distribute a transcript segment to all lobster agents.
   * Returns any suggestions that were generated.
   */
  async distributeTranscript(segment: TranscriptSegment): Promise<readonly LobsterMessage[]> {
    const promises = Array.from(this.lobsters.values()).map((agent) =>
      agent.processTranscript(segment),
    );

    const results = await Promise.allSettled(promises);
    const suggestions: LobsterMessage[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value !== null) {
        suggestions.push(result.value);
      } else if (result.status === 'rejected') {
        console.error('[orchestrator] Transcript processing error:', result.reason);
      }
    }

    return suggestions;
  }

  /**
   * Handle a direct prompt from a user to their lobster.
   */
  async handleUserPrompt(userId: string, prompt: string): Promise<LobsterMessage> {
    const agent = this.lobsters.get(userId);
    if (!agent) {
      throw new Error(`No lobster agent found for user ${userId} in meeting ${this.meetingId}`);
    }
    return agent.handleUserPrompt(prompt);
  }

  /**
   * Check if a user has an active lobster agent.
   */
  hasLobster(userId: string): boolean {
    return this.lobsters.has(userId);
  }

  /**
   * Get the number of active lobsters.
   */
  get size(): number {
    return this.lobsters.size;
  }

  /**
   * Get recent dialogue history from the bus.
   */
  getRecentDialogue(limit = 20): readonly LobsterDialogueTurn[] {
    return this.dialogueBus.getRecentHistory(limit);
  }

  /**
   * Clean up all resources.
   */
  destroy(): void {
    for (const [userId] of this.lobsters) {
      this.removeLobster(userId);
    }
    this.dialogueBus.clear();
    console.log(`[orchestrator] Destroyed orchestrator for meeting ${this.meetingId}`);
  }
}
