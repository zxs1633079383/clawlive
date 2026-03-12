export type CollaborationMode = 'passive' | 'reactive' | 'proactive';

export interface LobsterSkill {
  name: string;
  description: string;
  version: string;
  identity: string;
  rules: string[];
  triggerInterval: number; // seconds
  maxSuggestionRate: number; // seconds between suggestions
  triggerConditions: string[];
  collaborationMode: CollaborationMode;
  preferredFormat: string;
  maxLength: number; // tokens
  language: string;
  rawContent: string; // full markdown
}

export interface LobsterMessage {
  id: string;
  meetingId: string;
  lobsterId: string;
  ownerUserId: string;
  type: 'suggestion' | 'response' | 'dialogue';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface LobsterDialogueTurn {
  id: string;
  meetingId: string;
  fromLobsterId: string;
  toLobsterId?: string; // null = broadcast to all lobsters
  content: string;
  timestamp: Date;
}

/**
 * 会议摘要 — 由主龙虾（会议主持人）在会议结束后生成
 */
export interface MeetingSummaryPayload {
  fromLobsterId: string;
  summary: string;              // 会议整体摘要
  keyDecisions: string[];       // 关键决策
  actionItems: string[];        // 行动项
  timestamp: Date;
}
