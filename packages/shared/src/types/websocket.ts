import type { LobsterDialogueTurn, LobsterMessage } from './lobster.js';

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
export type ClientMessage =
  | { channel: 'transcript'; type: 'segment'; payload: TranscriptSegment }
  | { channel: 'lobster'; type: 'user_prompt'; payload: { text: string } }
  | { channel: 'control'; type: 'mute' | 'unmute' | 'leave' };

// Server -> Client
export type ServerMessage =
  | { channel: 'transcript'; type: 'segment'; payload: TranscriptSegment }
  | { channel: 'lobster'; type: 'suggestion'; payload: LobsterMessage; targetUserId: string }
  | { channel: 'lobster'; type: 'dialogue'; payload: LobsterDialogueTurn }
  | { channel: 'control'; type: 'participant_joined' | 'participant_left' | 'meeting_state_changed' | 'error'; payload: unknown };
