// WebSocket protocol types
// These mirror the shared types but are kept here for server-side use
// until @clawlive/shared is fully implemented.

export interface TranscriptSegment {
  speakerId: string;
  text: string;
  timestamp: number;
  isFinal: boolean;
}

export interface LobsterMessage {
  lobsterId: string;
  ownerUserId: string;
  meetingId: string;
  content: string;
  type: 'suggestion' | 'response' | 'dialogue';
  timestamp: number;
}

export interface LobsterDialogueTurn {
  fromLobsterId: string;
  toLobsterId: string | null; // null = broadcast to all lobsters
  content: string;
  timestamp: number;
}

/**
 * 会议摘要 — 由主龙虾（会议主持人）在会议结束后生成
 */
export interface MeetingSummaryPayload {
  fromLobsterId: string;
  summary: string;              // 会议整体摘要
  keyDecisions: string[];       // 关键决策
  actionItems: string[];        // 行动项
  timestamp: number;
}

// Client -> Server
// Humans send: transcript + control
// Lobsters send: dialogue + summary (lobster is an external WebSocket client with its own LLM)
export type ClientMessage =
  | { channel: 'transcript'; type: 'segment'; payload: TranscriptSegment }
  | { channel: 'lobster'; type: 'dialogue'; payload: LobsterDialogueTurn }
  | { channel: 'lobster'; type: 'summary'; payload: MeetingSummaryPayload }
  | { channel: 'control'; type: 'mute' | 'unmute' | 'leave' };

// Server -> Client (broadcast to all: humans observe, lobsters receive transcript)
export type ServerMessage =
  | { channel: 'transcript'; type: 'segment'; payload: TranscriptSegment }
  | { channel: 'lobster'; type: 'dialogue'; payload: LobsterDialogueTurn }
  | { channel: 'lobster'; type: 'summary'; payload: MeetingSummaryPayload }
  | { channel: 'control'; type: 'participant_joined' | 'participant_left' | 'meeting_state_changed' | 'meeting_ended' | 'error'; payload: unknown };

export type MeetingStatus = 'lobby' | 'active' | 'ended';

export interface Meeting {
  id: string;
  title: string;
  description: string;
  status: MeetingStatus;
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
}

export interface Participant {
  userId: string;
  meetingId: string;
  displayName: string;
  lobsterSkillId: string | null;
  isMuted: boolean;
  joinedAt: number;
}

export interface LobsterSkill {
  name: string;
  description: string;
  version: string;
  identity: string;
  rules: string[];
  triggerInterval: number;
  maxSuggestionRate: number;
  triggerConditions: string[];
  collaborationMode: 'passive' | 'reactive' | 'proactive';
  preferredFormat: string;
  maxLength: number;
  language: string;
  rawContent: string;
}

export interface CreateMeetingRequest {
  title: string;
  description?: string;
}

export interface JoinMeetingRequest {
  userId: string;
  displayName: string;
  lobsterSkillId?: string;
}
