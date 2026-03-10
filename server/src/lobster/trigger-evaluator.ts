import type { LobsterSkill, TranscriptSegment } from '../realtime/types.js';

interface TriggerResult {
  shouldTrigger: boolean;
  reason?: string;
  matchedConditions: string[];
}

/**
 * Evaluates whether a lobster should generate a suggestion based on
 * timing constraints, rate limits, and content-based trigger conditions.
 *
 * Maintains per-lobster state for:
 * - Time gating (triggerInterval)
 * - Rate limiting (maxSuggestionRate)
 * - Transcript accumulation for content analysis
 * - Topic keyword tracking for shift detection
 */
export class TriggerEvaluator {
  private readonly lastSuggestionTime = new Map<string, number>();
  private readonly lastTriggerCheckTime = new Map<string, number>();
  private readonly recentTranscripts = new Map<string, TranscriptSegment[]>();
  private readonly previousTopicKeywords = new Map<string, Set<string>>();

  /**
   * Evaluate whether a lobster should trigger based on a new transcript segment.
   *
   * Checks time gating, rate limiting, and content-based conditions.
   */
  evaluate(lobsterId: string, skill: LobsterSkill, segment: TranscriptSegment): TriggerResult {
    const now = Date.now();

    // Accumulate transcript
    const transcripts = this.recentTranscripts.get(lobsterId) ?? [];
    transcripts.push(segment);

    // Keep only last 5 minutes
    const fiveMinAgo = now - 5 * 60 * 1000;
    const recent = transcripts.filter(
      (t) => (typeof t.timestamp === 'number' ? t.timestamp : new Date(t.timestamp).getTime()) > fiveMinAgo,
    );
    this.recentTranscripts.set(lobsterId, recent);

    // Time gating: check interval (triggerInterval is in ms)
    const lastCheck = this.lastTriggerCheckTime.get(lobsterId) ?? 0;
    const triggerIntervalMs = skill.triggerInterval;
    if (now - lastCheck < triggerIntervalMs) {
      return { shouldTrigger: false, matchedConditions: [] };
    }
    this.lastTriggerCheckTime.set(lobsterId, now);

    // Rate limiting: maxSuggestionRate (in ms)
    const lastSuggestion = this.lastSuggestionTime.get(lobsterId) ?? 0;
    const maxSuggestionRateMs = skill.maxSuggestionRate;
    if (now - lastSuggestion < maxSuggestionRateMs) {
      return { shouldTrigger: false, matchedConditions: [] };
    }

    // Build combined text from final segments for content analysis
    const recentText = recent
      .filter((t) => t.isFinal)
      .map((t) => t.text)
      .join(' ')
      .toLowerCase();

    // Must have enough content to evaluate
    if (recentText.trim().length < 20) {
      return { shouldTrigger: false, matchedConditions: [] };
    }

    // Content-based conditions
    const conditions = skill.triggerConditions ?? [];
    const matchedConditions: string[] = [];

    for (const condition of conditions) {
      if (this.checkCondition(condition, recentText, lobsterId)) {
        matchedConditions.push(condition);
      }
    }

    // Trigger if at least one condition matched, or no conditions defined (periodic)
    const shouldTrigger = conditions.length === 0 || matchedConditions.length > 0;

    if (shouldTrigger) {
      this.lastSuggestionTime.set(lobsterId, now);
    }

    return {
      shouldTrigger,
      reason:
        matchedConditions.length > 0
          ? `Matched: ${matchedConditions.join(', ')}`
          : 'Periodic check',
      matchedConditions,
    };
  }

  /**
   * Legacy API preserved for backward compatibility.
   * Delegates to `evaluate()`.
   */
  shouldTrigger(lobsterId: string, skill: LobsterSkill, recentTranscript: string): boolean {
    const now = Date.now();

    // Check trigger interval
    const lastEval = this.lastTriggerCheckTime.get(lobsterId) ?? 0;
    if (now - lastEval < skill.triggerInterval) {
      return false;
    }
    this.lastTriggerCheckTime.set(lobsterId, now);

    // Check max suggestion rate
    const lastSuggestion = this.lastSuggestionTime.get(lobsterId) ?? 0;
    if (now - lastSuggestion < skill.maxSuggestionRate) {
      return false;
    }

    const trimmed = recentTranscript.trim();
    if (trimmed.length < 20) {
      return false;
    }

    if (skill.triggerConditions.length > 0) {
      const lower = trimmed.toLowerCase();
      for (const condition of skill.triggerConditions) {
        if (this.checkCondition(condition, lower, lobsterId)) {
          return true;
        }
      }
      return false;
    }

    return true;
  }

  private checkCondition(condition: string, recentText: string, lobsterId: string): boolean {
    switch (condition) {
      case 'new_topic_detected':
      case 'topic_change':
        return this.detectTopicShift(recentText, lobsterId);

      case 'decision_point_reached':
        return /\b(decide|decision|should we|let's decide|agree|let'?s go with|vote|choose|chosen|approved|confirm|what do you think|我们是否|决定|你觉得)\b/i.test(
          recentText,
        );

      case 'action_item_mentioned':
        return /\b(will do|i'?ll|by friday|by monday|by next week|deadline|todo|action item|assigned to|take care of|responsible for|follow up|待办|负责|跟进)\b/i.test(
          recentText,
        );

      case 'discussion_going_in_circles':
        return this.detectRepetition(recentText);

      case 'unanimous_agreement_without_discussion':
        return this.detectQuickAgreement(recentText);

      case 'assumption_stated_without_evidence':
        return this.detectUnbackedAssertions(recentText);

      case 'risk_not_addressed':
        return /\b(risk|concern|worry|problem|issue|blocker|danger|threat)\b/i.test(recentText);

      case 'time_limit_approaching':
        // Would need meeting duration context — not evaluable from transcript alone
        return false;

      case 'commitment_detected':
        return /\b(i'?ll|i will|i can|let me|i'?m going to|i promise|i commit)\b/i.test(recentText);

      default:
        // Custom condition: treat as keyword search
        return recentText.includes(condition.toLowerCase());
    }
  }

  /**
   * Detect topic shift by comparing current keyword set against previous.
   * Less than 30% overlap with at least 5 prior keywords suggests a shift.
   */
  private detectTopicShift(text: string, lobsterId: string): boolean {
    // Extract significant words (length > 4 to skip common words)
    const words = text.split(/\s+/).filter((w) => w.length > 4);
    const currentKeywords = new Set(words.slice(-20));
    const previousKeywords = this.previousTopicKeywords.get(lobsterId) ?? new Set();

    let overlap = 0;
    for (const word of currentKeywords) {
      if (previousKeywords.has(word)) overlap++;
    }

    const overlapRatio =
      previousKeywords.size > 0 ? overlap / Math.max(currentKeywords.size, 1) : 1;
    this.previousTopicKeywords.set(lobsterId, currentKeywords);

    return overlapRatio < 0.3 && previousKeywords.size > 5;
  }

  /**
   * Detect repetition by comparing recent sentences to earlier sentences.
   * Returns true if similarity > 60% between any recent/earlier pair.
   */
  private detectRepetition(text: string): boolean {
    const sentences = text
      .split(/[.!?。！？]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);
    if (sentences.length < 4) return false;

    const recentSentences = sentences.slice(-2);
    const earlierSentences = sentences.slice(0, -2);

    for (const r of recentSentences) {
      for (const e of earlierSentences) {
        if (this.simpleSimilarity(r, e) > 0.6) return true;
      }
    }
    return false;
  }

  /**
   * Detect quick agreement without substantive discussion.
   * Short text with agreement words and no questioning/debate markers.
   */
  private detectQuickAgreement(text: string): boolean {
    const hasAgreement = /\b(yeah|yes|agree|sure|sounds good|ok|right|exactly|absolutely|totally)\b/i.test(text);
    const hasDebate = /\b(but|however|disagree|concern|alternatively|what if|why|problem)\b/i.test(text);
    return hasAgreement && !hasDebate && text.length < 150;
  }

  /**
   * Detect assertions stated without evidence/backing.
   * Looks for definitive statements without qualifiers like "because", "data shows", etc.
   */
  private detectUnbackedAssertions(text: string): boolean {
    const hasAssertion = /\b(obviously|clearly|everyone knows|it'?s clear|always|never|definitely|certainly|without a doubt)\b/i.test(text);
    const hasBacking = /\b(because|data|research|evidence|study|according to|based on|shows that|proves|statistics)\b/i.test(text);
    return hasAssertion && !hasBacking;
  }

  /**
   * Simple word-overlap similarity between two strings. Returns 0..1.
   */
  private simpleSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    let common = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) common++;
    }
    return common / Math.max(wordsA.size, wordsB.size, 1);
  }

  /**
   * Record that a lobster produced a suggestion (updates rate-limit clock).
   */
  recordSuggestion(lobsterId: string): void {
    this.lastSuggestionTime.set(lobsterId, Date.now());
  }

  /**
   * Get accumulated transcripts for a lobster (useful for agent context building).
   */
  getRecentTranscripts(lobsterId: string): readonly TranscriptSegment[] {
    return this.recentTranscripts.get(lobsterId) ?? [];
  }

  /**
   * Reset all state for a single lobster (e.g., when removed from meeting).
   */
  reset(lobsterId: string): void {
    this.lastSuggestionTime.delete(lobsterId);
    this.lastTriggerCheckTime.delete(lobsterId);
    this.recentTranscripts.delete(lobsterId);
    this.previousTopicKeywords.delete(lobsterId);
  }

  /**
   * Reset all state for all lobsters (e.g., at meeting end).
   */
  resetAll(): void {
    this.lastSuggestionTime.clear();
    this.lastTriggerCheckTime.clear();
    this.recentTranscripts.clear();
    this.previousTopicKeywords.clear();
  }
}
