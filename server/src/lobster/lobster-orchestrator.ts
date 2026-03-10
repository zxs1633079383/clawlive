import { LobsterAgent, type MeetingContext, type StreamCallback } from './lobster-agent.js';
import { DialogueBus } from './dialogue-bus.js';
import { TriggerEvaluator } from './trigger-evaluator.js';
import type { LLMProvider } from '../llm/llm-provider.js';
import type {
  LobsterSkill,
  LobsterMessage,
  TranscriptSegment,
  LobsterDialogueTurn,
} from '../realtime/types.js';
import { ClaudeProvider } from '../llm/claude-provider.js';

// ---------------------------------------------------------------------------
// Global registry of orchestrators per meeting
// ---------------------------------------------------------------------------

const orchestrators = new Map<string, LobsterOrchestrator>();

export function getLobsterOrchestrator(
  meetingId: string,
): LobsterOrchestrator | undefined {
  return orchestrators.get(meetingId);
}

export function getOrCreateOrchestrator(
  meetingId: string,
): LobsterOrchestrator {
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

// ---------------------------------------------------------------------------
// Lifecycle hooks
// ---------------------------------------------------------------------------

export interface MeetingLifecycleHooks {
  onMeetingStart?: (meetingId: string) => void | Promise<void>;
  onMeetingEnd?: (meetingId: string, summary: string) => void | Promise<void>;
  onSuggestion?: (message: LobsterMessage) => void | Promise<void>;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Manages all lobster agents within a single meeting.
 *
 * Responsibilities:
 * - Create/remove lobster agents with proper dialogue bus wiring
 * - Distribute transcript segments to all agents concurrently
 * - Coordinate inter-lobster dialogue via DialogueBus
 * - Meeting lifecycle hooks (onMeetingStart, onMeetingEnd)
 * - Summary generation at meeting end
 * - Rate-limited concurrent lobster processing with Promise.allSettled
 */
export class LobsterOrchestrator {
  private readonly lobsters = new Map<string, LobsterAgent>();
  private readonly skills = new Map<string, LobsterSkill>();
  private readonly dialogueBus: DialogueBus;
  private readonly triggerEvaluator: TriggerEvaluator;
  private readonly llmProvider: LLMProvider;
  private meetingContext: MeetingContext | null = null;
  private readonly transcriptHistory: TranscriptSegment[] = [];
  private readonly hooks: MeetingLifecycleHooks;
  private meetingStartedAt: number | null = null;
  private meetingEndedAt: number | null = null;

  constructor(
    public readonly meetingId: string,
    options?: {
      llmProvider?: LLMProvider;
      hooks?: MeetingLifecycleHooks;
      maxDialogueHistory?: number;
    },
  ) {
    this.llmProvider = options?.llmProvider ?? new ClaudeProvider();
    this.hooks = options?.hooks ?? {};
    this.dialogueBus = new DialogueBus({
      maxHistorySize: options?.maxDialogueHistory ?? 20,
    });
    this.triggerEvaluator = new TriggerEvaluator();
  }

  // -------------------------------------------------------------------------
  // Meeting lifecycle
  // -------------------------------------------------------------------------

  /**
   * Signal that the meeting has started.
   * Sets meeting context on all agents and invokes onMeetingStart hook.
   */
  async onMeetingStart(context: MeetingContext): Promise<void> {
    this.meetingStartedAt = Date.now();
    this.meetingContext = context;

    // Propagate context to existing agents
    for (const agent of this.lobsters.values()) {
      agent.setMeetingContext(context);
    }

    console.log(
      `[orchestrator] Meeting started: ${this.meetingId} "${context.title}"`,
    );

    if (this.hooks.onMeetingStart) {
      await this.hooks.onMeetingStart(this.meetingId);
    }
  }

  /**
   * Signal that the meeting has ended.
   * Generates a summary via LLM and invokes onMeetingEnd hook.
   */
  async onMeetingEnd(): Promise<string> {
    this.meetingEndedAt = Date.now();

    console.log(`[orchestrator] Meeting ended: ${this.meetingId}`);

    const summary = await this.generateMeetingSummary();

    if (this.hooks.onMeetingEnd) {
      await this.hooks.onMeetingEnd(this.meetingId, summary);
    }

    // Clean up trigger evaluator state
    this.triggerEvaluator.resetAll();

    return summary;
  }

  // -------------------------------------------------------------------------
  // Lobster management
  // -------------------------------------------------------------------------

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

    // Inject meeting context if already available
    if (this.meetingContext) {
      agent.setMeetingContext(this.meetingContext);
    }

    this.lobsters.set(userId, agent);
    this.skills.set(userId, skill);

    // Subscribe to dialogue bus with the skill's collaboration mode
    this.dialogueBus.subscribe(
      agent.lobsterId,
      (turn: LobsterDialogueTurn) => {
        agent
          .handleDialogue(turn)
          .then((reply) => {
            if (reply) {
              this.dialogueBus.publish(reply);
            }
          })
          .catch((err) => {
            console.error(
              `[orchestrator] Dialogue error for ${agent.lobsterId}:`,
              err,
            );
          });
      },
      skill.collaborationMode,
    );

    console.log(
      `[orchestrator] Created lobster for user ${userId} with skill "${skill.name}" in meeting ${this.meetingId}`,
    );
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
      this.skills.delete(userId);
      console.log(
        `[orchestrator] Removed lobster for user ${userId} in meeting ${this.meetingId}`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Transcript distribution
  // -------------------------------------------------------------------------

  /**
   * Distribute a transcript segment to all lobster agents concurrently.
   * Uses Promise.allSettled so one agent failure does not block others.
   * Returns any suggestions that were generated.
   */
  async distributeTranscript(
    segment: TranscriptSegment,
    onStream?: StreamCallback,
  ): Promise<readonly LobsterMessage[]> {
    // Keep a copy for summary generation
    if (segment.isFinal) {
      this.transcriptHistory.push(segment);
    }

    const results = await Promise.allSettled(
      Array.from(this.lobsters.values()).map((agent) =>
        agent.processTranscript(segment, onStream),
      ),
    );

    const suggestions: LobsterMessage[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value !== null) {
        suggestions.push(result.value);

        // Notify hook
        if (this.hooks.onSuggestion) {
          Promise.resolve(this.hooks.onSuggestion(result.value)).catch(
            (err) => {
              console.error('[orchestrator] onSuggestion hook error:', err);
            },
          );
        }
      } else if (result.status === 'rejected') {
        console.error(
          '[orchestrator] Transcript processing error:',
          result.reason,
        );
      }
    }

    return suggestions;
  }

  // -------------------------------------------------------------------------
  // User interaction
  // -------------------------------------------------------------------------

  /**
   * Handle a direct prompt from a user to their lobster.
   */
  async handleUserPrompt(
    userId: string,
    prompt: string,
    onStream?: StreamCallback,
  ): Promise<LobsterMessage> {
    const agent = this.lobsters.get(userId);
    if (!agent) {
      throw new Error(
        `No lobster agent found for user ${userId} in meeting ${this.meetingId}`,
      );
    }
    return agent.handleUserPrompt(prompt, onStream);
  }

  // -------------------------------------------------------------------------
  // Query methods
  // -------------------------------------------------------------------------

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
   * Get the meeting context if set.
   */
  getMeetingContext(): MeetingContext | null {
    return this.meetingContext;
  }

  // -------------------------------------------------------------------------
  // Summary generation
  // -------------------------------------------------------------------------

  /**
   * Generate a meeting summary using the LLM based on accumulated transcript.
   */
  private async generateMeetingSummary(): Promise<string> {
    if (this.transcriptHistory.length === 0) {
      return 'No transcript data available for summary.';
    }

    const transcriptText = this.transcriptHistory
      .map((s) => {
        const time = new Date(s.timestamp).toISOString().slice(11, 19);
        return `[${time}] [${s.speakerId}]: ${s.text}`;
      })
      .join('\n');

    // Trim to reasonable size for summary
    const maxChars = 20_000;
    const trimmedTranscript =
      transcriptText.length > maxChars
        ? `...\n${transcriptText.slice(-maxChars)}`
        : transcriptText;

    const durationMs =
      (this.meetingEndedAt ?? Date.now()) -
      (this.meetingStartedAt ?? Date.now());
    const durationMin = Math.round(durationMs / 60_000);

    const meetingTitle = this.meetingContext?.title ?? 'Untitled Meeting';
    const participantNames =
      this.meetingContext?.participants
        .map((p) => p.displayName)
        .join(', ') ?? 'unknown';

    const dialogueHistory = this.dialogueBus.getRecentHistory(50);
    const lobsterInsights =
      dialogueHistory.length > 0
        ? dialogueHistory
            .map((d) => `[${d.fromLobsterId}]: ${d.content}`)
            .join('\n')
        : 'None';

    try {
      const response = await this.llmProvider.chat(
        [
          {
            role: 'system',
            content: [
              'You are a meeting summarizer. Produce a concise, actionable summary.',
              'Include: key decisions, action items with owners, open questions, and notable insights from lobster AI assistants.',
              'Format with markdown headers and bullet points.',
            ].join('\n'),
          },
          {
            role: 'user',
            content: [
              `Meeting: ${meetingTitle}`,
              `Duration: ${durationMin} minutes`,
              `Participants: ${participantNames}`,
              '',
              '## Transcript',
              trimmedTranscript,
              '',
              '## Lobster AI Insights',
              lobsterInsights,
              '',
              'Please summarize this meeting.',
            ].join('\n'),
          },
        ],
        { maxTokens: 1024, temperature: 0.3 },
      );

      return response;
    } catch (err) {
      console.error('[orchestrator] Failed to generate meeting summary:', err);
      return `Meeting "${meetingTitle}" lasted ${durationMin} minutes with ${this.lobsters.size} active lobsters. Summary generation failed.`;
    }
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  /**
   * Clean up all resources.
   */
  destroy(): void {
    for (const [userId] of this.lobsters) {
      this.removeLobster(userId);
    }
    this.dialogueBus.clear();
    this.triggerEvaluator.resetAll();
    this.transcriptHistory.length = 0;
    console.log(
      `[orchestrator] Destroyed orchestrator for meeting ${this.meetingId}`,
    );
  }
}
