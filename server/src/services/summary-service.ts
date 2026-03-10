import type { LLMProvider } from '../llm/llm-provider.js';
import type { TranscriptSegment, LobsterMessage, LobsterDialogueTurn } from '../realtime/types.js';

interface KeyDecision {
  decision: string;
  timestamp: Date;
  participants: string[];
}

interface ActionItem {
  action: string;
  assignee: string;
  deadline?: string;
  status: 'pending';
}

export interface MeetingSummary {
  meetingId: string;
  globalSummary: string;
  keyDecisions: KeyDecision[];
  actionItems: ActionItem[];
  personalSummaries: Map<string, string>; // userId -> personalized summary
  generatedAt: Date;
}

export class SummaryService {
  constructor(private readonly llmProvider: LLMProvider) {}

  async generateMeetingSummary(
    meetingId: string,
    title: string,
    transcript: readonly TranscriptSegment[],
    lobsterMessages: readonly LobsterMessage[],
    lobsterDialogue: readonly LobsterDialogueTurn[],
    participantIds: readonly string[],
  ): Promise<MeetingSummary> {
    // Build transcript text
    const transcriptText = transcript
      .filter((s) => s.isFinal)
      .map((s) => `[${new Date(s.timestamp).toLocaleTimeString()}] ${s.speakerId}: ${s.text}`)
      .join('\n');

    if (transcriptText.trim().length === 0) {
      return {
        meetingId,
        globalSummary: 'No transcript was recorded during this meeting.',
        keyDecisions: [],
        actionItems: [],
        personalSummaries: new Map(),
        generatedAt: new Date(),
      };
    }

    // Generate global summary
    const globalSummary = await this.llmProvider.chat(
      [
        {
          role: 'system',
          content:
            'You are a meeting summarizer. Provide a comprehensive yet concise summary of the meeting. Include key topics discussed, decisions made, and overall outcomes. Format with markdown headers and bullet points.',
        },
        {
          role: 'user',
          content: `Meeting: ${title}\n\nTranscript:\n${transcriptText}\n\nPlease provide a comprehensive meeting summary.`,
        },
      ],
      { maxTokens: 1000 },
    );

    // Extract decisions and action items
    const extractionResult = await this.llmProvider.chat(
      [
        {
          role: 'system',
          content: `Extract key decisions and action items from this meeting transcript. Return as JSON:
{
  "decisions": [{"decision": "...", "participants": ["name1", "name2"]}],
  "actionItems": [{"action": "...", "assignee": "name", "deadline": "if mentioned or null"}]
}`,
        },
        {
          role: 'user',
          content: transcriptText,
        },
      ],
      { maxTokens: 800 },
    );

    let keyDecisions: KeyDecision[] = [];
    let actionItems: ActionItem[] = [];

    try {
      // Try to parse JSON from response (may be wrapped in markdown code block)
      const jsonMatch = extractionResult.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        keyDecisions = (parsed.decisions ?? []).map((d: Record<string, unknown>) => ({
          decision: String(d.decision ?? ''),
          timestamp: new Date(),
          participants: Array.isArray(d.participants) ? d.participants.map(String) : [],
        }));
        actionItems = (parsed.actionItems ?? []).map((a: Record<string, unknown>) => ({
          action: String(a.action ?? ''),
          assignee: String(a.assignee ?? 'Unassigned'),
          deadline: a.deadline ? String(a.deadline) : undefined,
          status: 'pending' as const,
        }));
      }
    } catch {
      // If JSON parsing fails, include raw text as a single decision
      keyDecisions = [
        { decision: extractionResult, timestamp: new Date(), participants: [] },
      ];
    }

    // Generate personalized summaries for each participant
    const personalSummaries = new Map<string, string>();

    // Process participants in parallel for better performance
    const summaryPromises = participantIds.map(async (userId) => {
      const userMessages = lobsterMessages.filter((m) => m.ownerUserId === userId);
      const personalSummary = await this.llmProvider.chat(
        [
          {
            role: 'system',
            content:
              'Generate a brief personalized meeting summary for this participant. Focus on topics they discussed, decisions they were involved in, and action items assigned to them. Keep it concise - 2-4 paragraphs max.',
          },
          {
            role: 'user',
            content: `Meeting: ${title}\nParticipant: ${userId}\n\nFull transcript:\n${transcriptText}\n\nLobster suggestions for this person:\n${userMessages.map((m) => m.content).join('\n')}`,
          },
        ],
        { maxTokens: 500 },
      );
      return { userId, summary: personalSummary };
    });

    const personalResults = await Promise.allSettled(summaryPromises);
    for (const result of personalResults) {
      if (result.status === 'fulfilled') {
        personalSummaries.set(result.value.userId, result.value.summary);
      }
    }

    return {
      meetingId,
      globalSummary,
      keyDecisions,
      actionItems,
      personalSummaries,
      generatedAt: new Date(),
    };
  }
}
