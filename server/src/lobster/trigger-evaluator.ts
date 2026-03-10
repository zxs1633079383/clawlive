import type { LobsterSkill } from '../realtime/types.js';

/**
 * Evaluates whether a lobster should generate a suggestion based on
 * timing constraints and transcript content.
 */
export class TriggerEvaluator {
  // lobsterId -> timestamp of last suggestion
  private readonly lastSuggestionTime: Map<string, number> = new Map();

  // lobsterId -> timestamp of last evaluation
  private readonly lastEvalTime: Map<string, number> = new Map();

  /**
   * Determine if a lobster should trigger (produce a suggestion) right now.
   *
   * Checks:
   * 1. Enough time since last evaluation (triggerInterval)
   * 2. Enough time since last suggestion (maxSuggestionRate)
   * 3. Transcript has meaningful content worth responding to
   */
  shouldTrigger(lobsterId: string, skill: LobsterSkill, recentTranscript: string): boolean {
    const now = Date.now();

    // Check trigger interval (minimum time between evaluations)
    const lastEval = this.lastEvalTime.get(lobsterId) ?? 0;
    if (now - lastEval < skill.triggerInterval) {
      return false;
    }
    this.lastEvalTime.set(lobsterId, now);

    // Check max suggestion rate (minimum time between actual suggestions)
    const lastSuggestion = this.lastSuggestionTime.get(lobsterId) ?? 0;
    if (now - lastSuggestion < skill.maxSuggestionRate) {
      return false;
    }

    // Check if transcript has enough content to be worth evaluating
    const trimmed = recentTranscript.trim();
    if (trimmed.length < 20) {
      return false;
    }

    // Check trigger conditions if specified
    if (skill.triggerConditions.length > 0) {
      return matchesTriggerCondition(skill.triggerConditions, trimmed);
    }

    // Default: trigger if there's enough content
    return true;
  }

  /**
   * Record that a lobster produced a suggestion.
   */
  recordSuggestion(lobsterId: string): void {
    this.lastSuggestionTime.set(lobsterId, Date.now());
  }

  /**
   * Reset all state for a lobster (e.g., when removed from meeting).
   */
  reset(lobsterId: string): void {
    this.lastSuggestionTime.delete(lobsterId);
    this.lastEvalTime.delete(lobsterId);
  }
}

/**
 * Simple keyword-based trigger condition matching.
 * In production, this could use the LLM for smarter evaluation.
 */
function matchesTriggerCondition(conditions: readonly string[], transcript: string): boolean {
  const lower = transcript.toLowerCase();

  for (const condition of conditions) {
    switch (condition) {
      case 'new_topic_detected':
        // Heuristic: look for topic-change indicators
        if (lower.includes('let\'s talk about') || lower.includes('moving on') ||
            lower.includes('next topic') || lower.includes('另一个') ||
            lower.includes('接下来') || lower.includes('换个话题')) {
          return true;
        }
        break;

      case 'decision_point_reached':
        if (lower.includes('should we') || lower.includes('let\'s decide') ||
            lower.includes('what do you think') || lower.includes('agree') ||
            lower.includes('我们是否') || lower.includes('决定') ||
            lower.includes('你觉得')) {
          return true;
        }
        break;

      case 'action_item_mentioned':
        if (lower.includes('action item') || lower.includes('todo') ||
            lower.includes('follow up') || lower.includes('responsible') ||
            lower.includes('待办') || lower.includes('负责') ||
            lower.includes('跟进')) {
          return true;
        }
        break;

      default:
        // Custom condition: treat as keyword search
        if (lower.includes(condition.toLowerCase())) {
          return true;
        }
    }
  }

  return false;
}
