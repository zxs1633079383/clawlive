import type { LobsterDialogueTurn, MeetingSummaryPayload } from './lobster.js';

export interface TranscriptSegment {
  id: string;
  meetingId: string;
  speakerId: string;
  speakerName: string;
  text: string;
  timestamp: Date;
  isFinal: boolean;
  language?: string;
}

// Client -> Server
// Humans send: transcript + control
// Lobsters send: dialogue + summary (lobster is an external agent with its own LLM)
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
