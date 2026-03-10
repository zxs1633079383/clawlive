import type { LLMProvider, ChatMessage } from '../llm/llm-provider.js';
import type { LobsterSkill, LobsterMessage, LobsterDialogueTurn, TranscriptSegment } from '../realtime/types.js';
import { TriggerEvaluator } from './trigger-evaluator.js';
import { config } from '../config.js';

/**
 * A single lobster AI agent assigned to one participant in a meeting.
 *
 * Maintains a sliding window of transcript context and generates
 * suggestions when triggered.
 */
export class LobsterAgent {
  private readonly triggerEvaluator: TriggerEvaluator;
  private readonly transcriptBuffer: TranscriptSegment[] = [];
  private readonly dialogueHistory: LobsterDialogueTurn[] = [];
  private readonly outputHistory: LobsterMessage[] = [];

  constructor(
    private readonly skill: LobsterSkill,
    private readonly ownerUserId: string,
    private readonly meetingId: string,
    private readonly llmProvider: LLMProvider,
    triggerEvaluator?: TriggerEvaluator,
  ) {
    this.triggerEvaluator = triggerEvaluator ?? new TriggerEvaluator();
  }

  get lobsterId(): string {
    return `lobster:${this.meetingId}:${this.ownerUserId}`;
  }

  /**
   * Feed a transcript segment. Returns a suggestion if the trigger evaluator
   * determines it's time to speak.
   */
  async processTranscript(segment: TranscriptSegment): Promise<LobsterMessage | null> {
    this.transcriptBuffer.push(segment);
    this.pruneTranscriptBuffer();

    // Only evaluate final segments
    if (!segment.isFinal) {
      return null;
    }

    const recentTranscript = this.formatRecentTranscript();
    if (!this.triggerEvaluator.shouldTrigger(this.lobsterId, this.skill, recentTranscript)) {
      return null;
    }

    try {
      const messages = this.buildSuggestionPrompt(recentTranscript);
      const response = await this.llmProvider.chat(messages, {
        maxTokens: this.skill.maxLength,
        temperature: 0.7,
      });

      this.triggerEvaluator.recordSuggestion(this.lobsterId);

      const message: LobsterMessage = {
        lobsterId: this.lobsterId,
        ownerUserId: this.ownerUserId,
        meetingId: this.meetingId,
        content: response,
        type: 'suggestion',
        timestamp: Date.now(),
      };
      this.outputHistory.push(message);
      return message;
    } catch (err) {
      console.error(`[lobster] Error generating suggestion for ${this.lobsterId}:`, err);
      return null;
    }
  }

  /**
   * Handle a direct question from the owner user.
   */
  async handleUserPrompt(prompt: string): Promise<LobsterMessage> {
    const recentTranscript = this.formatRecentTranscript();
    const messages = this.buildUserPromptMessages(prompt, recentTranscript);

    const response = await this.llmProvider.chat(messages, {
      maxTokens: this.skill.maxLength * 2, // Allow longer responses for direct questions
      temperature: 0.7,
    });

    const message: LobsterMessage = {
      lobsterId: this.lobsterId,
      ownerUserId: this.ownerUserId,
      meetingId: this.meetingId,
      content: response,
      type: 'response',
      timestamp: Date.now(),
    };
    this.outputHistory.push(message);
    return message;
  }

  /**
   * Handle a dialogue message from another lobster.
   * Returns a reply if the skill's collaboration mode allows it.
   */
  async handleDialogue(turn: LobsterDialogueTurn): Promise<LobsterDialogueTurn | null> {
    this.dialogueHistory.push(turn);

    // Passive lobsters never engage in dialogue
    if (this.skill.collaborationMode === 'passive') {
      return null;
    }

    // Reactive lobsters only respond when directly addressed
    if (this.skill.collaborationMode === 'reactive' && turn.toLobsterId !== this.lobsterId) {
      return null;
    }

    try {
      const messages = this.buildDialogueMessages(turn);
      const response = await this.llmProvider.chat(messages, {
        maxTokens: this.skill.maxLength,
        temperature: 0.7,
      });

      const reply: LobsterDialogueTurn = {
        fromLobsterId: this.lobsterId,
        toLobsterId: turn.fromLobsterId,
        content: response,
        timestamp: Date.now(),
      };
      this.dialogueHistory.push(reply);
      return reply;
    } catch (err) {
      console.error(`[lobster] Error in dialogue for ${this.lobsterId}:`, err);
      return null;
    }
  }

  private buildSystemPrompt(): string {
    const parts = [
      `You are a lobster AI assistant named "${this.skill.name}".`,
      this.skill.description,
      '',
      '## Identity',
      this.skill.identity,
      '',
      '## Rules',
      ...this.skill.rules.map((r) => `- ${r}`),
      '',
      `## Output Format: ${this.skill.preferredFormat}`,
      `## Max Length: ${this.skill.maxLength} tokens`,
      `## Language: ${this.skill.language}`,
    ];
    return parts.join('\n');
  }

  private buildSuggestionPrompt(recentTranscript: string): ChatMessage[] {
    const messages: ChatMessage[] = [
      { role: 'system', content: this.buildSystemPrompt() },
    ];

    // Add recent dialogue history
    if (this.dialogueHistory.length > 0) {
      const recentDialogue = this.dialogueHistory.slice(-5)
        .map((d) => `[${d.fromLobsterId}]: ${d.content}`)
        .join('\n');
      messages.push({
        role: 'system',
        content: `## Recent Lobster Dialogue\n${recentDialogue}`,
      });
    }

    // Add previous suggestions as assistant turns
    for (const prev of this.outputHistory.slice(-3)) {
      messages.push({ role: 'assistant', content: prev.content });
    }

    messages.push({
      role: 'user',
      content: `Based on the following meeting transcript, provide a helpful suggestion for your owner.\n\n## Recent Transcript\n${recentTranscript}`,
    });

    return messages;
  }

  private buildUserPromptMessages(prompt: string, recentTranscript: string): ChatMessage[] {
    const messages: ChatMessage[] = [
      { role: 'system', content: this.buildSystemPrompt() },
    ];

    if (recentTranscript.length > 0) {
      messages.push({
        role: 'system',
        content: `## Meeting Transcript Context\n${recentTranscript}`,
      });
    }

    // Add conversation history
    for (const prev of this.outputHistory.slice(-5)) {
      messages.push({ role: 'assistant', content: prev.content });
    }

    messages.push({ role: 'user', content: prompt });

    return messages;
  }

  private buildDialogueMessages(turn: LobsterDialogueTurn): ChatMessage[] {
    return [
      {
        role: 'system',
        content: [
          this.buildSystemPrompt(),
          '',
          '## Dialogue Context',
          'Another lobster is communicating with you. Respond concisely and helpfully.',
          `Your collaboration mode: ${this.skill.collaborationMode}`,
        ].join('\n'),
      },
      ...this.dialogueHistory.slice(-5).map((d): ChatMessage => ({
        role: d.fromLobsterId === this.lobsterId ? 'assistant' : 'user',
        content: `[${d.fromLobsterId}]: ${d.content}`,
      })),
      {
        role: 'user',
        content: `[${turn.fromLobsterId}]: ${turn.content}`,
      },
    ];
  }

  private formatRecentTranscript(): string {
    const windowMs = config.TRANSCRIPT_WINDOW_MINUTES * 60 * 1000;
    const cutoff = Date.now() - windowMs;

    return this.transcriptBuffer
      .filter((s) => s.timestamp >= cutoff && s.isFinal)
      .map((s) => `[${s.speakerId}]: ${s.text}`)
      .join('\n');
  }

  private pruneTranscriptBuffer(): void {
    const windowMs = config.TRANSCRIPT_WINDOW_MINUTES * 60 * 1000;
    const cutoff = Date.now() - windowMs;

    while (this.transcriptBuffer.length > 0 && this.transcriptBuffer[0].timestamp < cutoff) {
      this.transcriptBuffer.shift();
    }
  }
}
