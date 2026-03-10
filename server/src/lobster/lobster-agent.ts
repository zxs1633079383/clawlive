import type { LLMProvider, ChatMessage } from '../llm/llm-provider.js';
import type {
  LobsterSkill,
  LobsterMessage,
  LobsterDialogueTurn,
  TranscriptSegment,
  Meeting,
  Participant,
} from '../realtime/types.js';
import { TriggerEvaluator } from './trigger-evaluator.js';
import { config } from '../config.js';

const NO_SUGGESTION_MARKER = '[NO_SUGGESTION]';

/** Simple word-based token estimation (avg ~0.75 tokens per word for English). */
function estimateTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).length * 1.33);
}

/**
 * Meeting metadata injected into the agent's context.
 */
export interface MeetingContext {
  title: string;
  description?: string;
  participants: readonly { displayName: string; userId: string }[];
}

/**
 * Callback invoked for each streamed token during suggestion generation.
 */
export type StreamCallback = (token: string) => void;

/**
 * A single lobster AI agent assigned to one participant in a meeting.
 *
 * Maintains a sliding window of transcript context and generates
 * suggestions when triggered. Supports:
 *
 * - Proper context window management with sliding window for transcripts
 * - System prompt construction from SKILL.md parsed content
 * - Meeting metadata injection
 * - Recent transcript buffer (configurable window, default 5 minutes)
 * - Lobster dialogue history in context
 * - Streaming response support
 * - Token counting estimation (simple word-based)
 */
export class LobsterAgent {
  private readonly triggerEvaluator: TriggerEvaluator;
  private readonly transcriptBuffer: TranscriptSegment[] = [];
  private readonly dialogueHistory: LobsterDialogueTurn[] = [];
  private readonly outputHistory: LobsterMessage[] = [];
  private meetingContext: MeetingContext | null = null;
  private readonly transcriptWindowMs: number;
  private readonly maxContextTokens: number;

  constructor(
    private readonly skill: LobsterSkill,
    private readonly ownerUserId: string,
    private readonly meetingId: string,
    private readonly llmProvider: LLMProvider,
    triggerEvaluator?: TriggerEvaluator,
    options?: {
      transcriptWindowMinutes?: number;
      maxContextTokens?: number;
    },
  ) {
    this.triggerEvaluator = triggerEvaluator ?? new TriggerEvaluator();
    this.transcriptWindowMs =
      (options?.transcriptWindowMinutes ?? config.TRANSCRIPT_WINDOW_MINUTES) *
      60 *
      1000;
    this.maxContextTokens = options?.maxContextTokens ?? 8000;
  }

  get lobsterId(): string {
    return `lobster:${this.meetingId}:${this.ownerUserId}`;
  }

  /**
   * Set meeting metadata so it can be injected into the system prompt.
   */
  setMeetingContext(ctx: MeetingContext): void {
    this.meetingContext = ctx;
  }

  /**
   * Feed a transcript segment. Returns a suggestion if the trigger evaluator
   * determines it's time to speak, or null otherwise.
   *
   * Uses the enhanced TriggerEvaluator.evaluate() API for content-aware triggering.
   */
  async processTranscript(
    segment: TranscriptSegment,
    onStream?: StreamCallback,
  ): Promise<LobsterMessage | null> {
    this.transcriptBuffer.push(segment);
    this.pruneTranscriptBuffer();

    // Only evaluate final (complete) segments
    if (!segment.isFinal) {
      return null;
    }

    const triggerResult = this.triggerEvaluator.evaluate(
      this.lobsterId,
      this.skill,
      segment,
    );

    if (!triggerResult.shouldTrigger) {
      return null;
    }

    try {
      const recentTranscript = this.formatRecentTranscript();
      const messages = this.buildSuggestionPrompt(recentTranscript);

      let response: string;
      if (onStream) {
        response = await this.streamResponse(messages, { maxTokens: this.skill.maxLength }, onStream);
      } else {
        response = await this.llmProvider.chat(messages, {
          maxTokens: this.skill.maxLength,
          temperature: 0.7,
        });
      }

      // If the model decided no suggestion is needed, return null
      if (response.trim().startsWith(NO_SUGGESTION_MARKER)) {
        return null;
      }

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
      console.error(
        `[lobster] Error generating suggestion for ${this.lobsterId}:`,
        err,
      );
      return null;
    }
  }

  /**
   * Handle a direct question from the owner user.
   * Supports optional streaming via callback.
   */
  async handleUserPrompt(
    prompt: string,
    onStream?: StreamCallback,
  ): Promise<LobsterMessage> {
    const recentTranscript = this.formatRecentTranscript();
    const messages = this.buildUserPromptMessages(prompt, recentTranscript);
    const opts = {
      maxTokens: this.skill.maxLength * 2,
      temperature: 0.7,
    };

    let response: string;
    if (onStream) {
      response = await this.streamResponse(messages, opts, onStream);
    } else {
      response = await this.llmProvider.chat(messages, opts);
    }

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
  async handleDialogue(
    turn: LobsterDialogueTurn,
  ): Promise<LobsterDialogueTurn | null> {
    this.dialogueHistory.push(turn);

    // Passive lobsters never engage in dialogue
    if (this.skill.collaborationMode === 'passive') {
      return null;
    }

    // Reactive lobsters only respond when directly addressed
    if (
      this.skill.collaborationMode === 'reactive' &&
      turn.toLobsterId !== this.lobsterId
    ) {
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
      console.error(
        `[lobster] Error in dialogue for ${this.lobsterId}:`,
        err,
      );
      return null;
    }
  }

  /**
   * Get estimated token count of the current context that would be sent to the LLM.
   */
  getContextTokenEstimate(): number {
    const systemPrompt = this.buildSystemPrompt();
    const transcript = this.formatRecentTranscript();
    const dialogue = this.formatRecentDialogue();
    return (
      estimateTokens(systemPrompt) +
      estimateTokens(transcript) +
      estimateTokens(dialogue)
    );
  }

  // ---------------------------------------------------------------------------
  // Prompt construction
  // ---------------------------------------------------------------------------

  /**
   * Build the system prompt from skill parsed content + meeting metadata.
   *
   * Structure:
   *   You are {skill.name} - {skill.description}
   *   {skill.identity}
   *   Rules: ...
   *   Meeting: {title} | Participants: {names}
   *   Output format / Max length / Language
   */
  private buildSystemPrompt(): string {
    const parts: string[] = [
      `You are ${this.skill.name} - ${this.skill.description}`,
      '',
      this.skill.identity,
      '',
      'Rules:',
      ...this.skill.rules.map((r) => `- ${r}`),
      '',
    ];

    // Meeting metadata injection
    if (this.meetingContext) {
      const participantNames = this.meetingContext.participants
        .map((p) => p.displayName)
        .join(', ');
      parts.push(
        `Meeting: ${this.meetingContext.title} | Participants: ${participantNames}`,
      );
      if (this.meetingContext.description) {
        parts.push(`Description: ${this.meetingContext.description}`);
      }
      parts.push('');
    }

    parts.push(
      `Output format: ${this.skill.preferredFormat}`,
      `Max length: ${this.skill.maxLength} tokens`,
      `Language: ${this.skill.language}`,
    );

    return parts.join('\n');
  }

  /**
   * Build suggestion prompt messages with:
   * 1. [SYSTEM] skill identity + meeting metadata
   * 2. [USER - TRANSCRIPT] recent transcript with timestamps
   * 3. [USER - LOBSTER DIALOGUE] recent dialogue turns
   * 4. [USER] explicit ask with NO_SUGGESTION escape
   */
  private buildSuggestionPrompt(recentTranscript: string): ChatMessage[] {
    const messages: ChatMessage[] = [
      { role: 'system', content: this.buildSystemPrompt() },
    ];

    // Transcript context (as user message)
    if (recentTranscript.length > 0) {
      const trimmedTranscript = this.trimToTokenBudget(
        recentTranscript,
        this.maxContextTokens * 0.6,
      );
      messages.push({
        role: 'user',
        content: `Last ${config.TRANSCRIPT_WINDOW_MINUTES} minutes of conversation:\n${trimmedTranscript}`,
      });
    }

    // Dialogue context
    const dialogue = this.formatRecentDialogue();
    if (dialogue.length > 0) {
      messages.push({
        role: 'user',
        content: `Recent lobster discussions:\n${dialogue}`,
      });
    }

    // Add previous suggestions as assistant turns for continuity
    for (const prev of this.outputHistory.slice(-3)) {
      messages.push({ role: 'assistant', content: prev.content });
    }

    // Final user prompt with opt-out mechanism
    messages.push({
      role: 'user',
      content: `Based on the above, should you provide a suggestion now?\nIf yes, provide your insight. If no, respond with ${NO_SUGGESTION_MARKER}.`,
    });

    return messages;
  }

  private buildUserPromptMessages(
    prompt: string,
    recentTranscript: string,
  ): ChatMessage[] {
    const messages: ChatMessage[] = [
      { role: 'system', content: this.buildSystemPrompt() },
    ];

    if (recentTranscript.length > 0) {
      const trimmedTranscript = this.trimToTokenBudget(
        recentTranscript,
        this.maxContextTokens * 0.6,
      );
      messages.push({
        role: 'user',
        content: `Meeting Transcript Context:\n${trimmedTranscript}`,
      });
    }

    // Conversation history
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
      ...this.dialogueHistory.slice(-5).map(
        (d): ChatMessage => ({
          role: d.fromLobsterId === this.lobsterId ? 'assistant' : 'user',
          content: `[${d.fromLobsterId}]: ${d.content}`,
        }),
      ),
      {
        role: 'user',
        content: `[${turn.fromLobsterId}]: ${turn.content}`,
      },
    ];
  }

  // ---------------------------------------------------------------------------
  // Transcript & dialogue formatting
  // ---------------------------------------------------------------------------

  private formatRecentTranscript(): string {
    const cutoff = Date.now() - this.transcriptWindowMs;

    return this.transcriptBuffer
      .filter((s) => s.timestamp >= cutoff && s.isFinal)
      .map((s) => {
        const time = new Date(s.timestamp).toISOString().slice(11, 19);
        return `[${time}] [${s.speakerId}]: ${s.text}`;
      })
      .join('\n');
  }

  private formatRecentDialogue(): string {
    if (this.dialogueHistory.length === 0) return '';

    return this.dialogueHistory
      .slice(-10)
      .map((d) => `[${d.fromLobsterId} -> ${d.toLobsterId ?? 'all'}]: ${d.content}`)
      .join('\n');
  }

  private pruneTranscriptBuffer(): void {
    const cutoff = Date.now() - this.transcriptWindowMs;

    while (
      this.transcriptBuffer.length > 0 &&
      this.transcriptBuffer[0].timestamp < cutoff
    ) {
      this.transcriptBuffer.shift();
    }
  }

  // ---------------------------------------------------------------------------
  // Token management & streaming
  // ---------------------------------------------------------------------------

  /**
   * Trim text to fit within a token budget by removing oldest lines first.
   */
  private trimToTokenBudget(text: string, maxTokens: number): string {
    const lines = text.split('\n');
    let result = text;

    while (estimateTokens(result) > maxTokens && lines.length > 1) {
      lines.shift();
      result = lines.join('\n');
    }

    return result;
  }

  /**
   * Stream a response from the LLM, calling onStream for each token,
   * and return the complete accumulated response.
   */
  private async streamResponse(
    messages: ChatMessage[],
    options: { maxTokens: number; temperature?: number },
    onStream: StreamCallback,
  ): Promise<string> {
    const chunks: string[] = [];

    for await (const token of this.llmProvider.chatStream(messages, {
      maxTokens: options.maxTokens,
      temperature: options.temperature ?? 0.7,
    })) {
      chunks.push(token);
      onStream(token);
    }

    return chunks.join('');
  }
}
