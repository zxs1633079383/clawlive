import type { MeetingRoom } from './meeting-room.js';
import type { ClientMessage, ServerMessage } from './types.js';
import { updateMuteStatus, removeMeetingParticipant } from '../services/participant-service.js';
import { appendTranscript, appendDialogue, saveSummary } from '../services/meeting-service.js';

/**
 * Route incoming WebSocket messages.
 *
 * The server is a pure message broker — no LLM calls.
 * - Humans send transcript (STT) and control messages.
 * - Lobsters (external agents with their own LLM) send dialogue messages.
 * - All messages are broadcast to everyone in the room.
 */
export function routeMessage(room: MeetingRoom, userId: string, message: ClientMessage): void {
  switch (message.channel) {
    case 'transcript':
      handleTranscript(room, userId, message);
      break;
    case 'lobster':
      if (message.type === 'summary') {
        handleLobsterSummary(room, userId, message as Extract<ClientMessage, { channel: 'lobster'; type: 'summary' }>);
      } else {
        handleLobsterDialogue(room, userId, message as Extract<ClientMessage, { channel: 'lobster'; type: 'dialogue' }>);
      }
      break;
    case 'control':
      handleControl(room, userId, message);
      break;
    default:
      console.warn(`[router] Unknown channel from user ${userId}:`, message);
  }
}

function handleTranscript(
  room: MeetingRoom,
  _userId: string,
  message: Extract<ClientMessage, { channel: 'transcript' }>,
): void {
  const { payload } = message;

  console.log(`[router] 🗣️ Transcript from ${payload.speakerId}: "${payload.text}" (final: ${payload.isFinal})`);

  // 持久化转录段，会议结束后可用于摘要
  appendTranscript(room.meetingId, {
    speakerId: payload.speakerId,
    speakerName: (payload as unknown as { speakerName?: string }).speakerName,
    text: payload.text,
    timestamp: payload.timestamp,
  });

  // Broadcast transcript to all participants:
  // - Humans see the transcript
  // - Lobsters (external agents) receive it and decide whether to respond
  const serverMsg: ServerMessage = {
    channel: 'transcript',
    type: 'segment',
    payload,
  };
  room.broadcast(serverMsg);
}

/**
 * A lobster (external agent) sends a dialogue turn.
 * Broadcast it to everyone so humans can observe and other lobsters can react.
 */
function handleLobsterDialogue(
  room: MeetingRoom,
  userId: string,
  message: Extract<ClientMessage, { channel: 'lobster'; type: 'dialogue' }>,
): void {
  console.log(`[router] Lobster dialogue from ${userId} in meeting ${room.meetingId}`);

  // 持久化龙虾对话，会议结束后可用于讨论结果
  appendDialogue(room.meetingId, message.payload);

  const serverMsg: ServerMessage = {
    channel: 'lobster',
    type: 'dialogue',
    payload: message.payload,
  };
  // Broadcast to all (humans observe, other lobsters may react)
  room.broadcast(serverMsg, userId);
}

/**
 * 主龙虾（会议主持人）发送会议摘要。
 * 存储摘要并广播给所有人。
 */
function handleLobsterSummary(
  room: MeetingRoom,
  userId: string,
  message: Extract<ClientMessage, { channel: 'lobster'; type: 'summary' }>,
): void {
  console.log(`[router] Meeting summary from host lobster ${userId} in meeting ${room.meetingId}`);

  // 持久化摘要
  saveSummary(room.meetingId, message.payload);

  const serverMsg: ServerMessage = {
    channel: 'lobster',
    type: 'summary',
    payload: message.payload,
  };
  // 广播给所有人（人类在 Summary 页面看到）
  room.broadcast(serverMsg);
}

function handleControl(
  room: MeetingRoom,
  userId: string,
  message: Extract<ClientMessage, { channel: 'control' }>,
): void {
  switch (message.type) {
    case 'mute':
      try {
        updateMuteStatus(room.meetingId, userId, true);
      } catch (err: unknown) {
        console.error(`[router] Error muting user ${userId}:`, err);
      }
      room.broadcast(
        { channel: 'control', type: 'meeting_state_changed', payload: { userId, isMuted: true } },
        userId,
      );
      break;

    case 'unmute':
      try {
        updateMuteStatus(room.meetingId, userId, false);
      } catch (err: unknown) {
        console.error(`[router] Error unmuting user ${userId}:`, err);
      }
      room.broadcast(
        { channel: 'control', type: 'meeting_state_changed', payload: { userId, isMuted: false } },
        userId,
      );
      break;

    case 'leave':
      try {
        removeMeetingParticipant(room.meetingId, userId);
      } catch (err: unknown) {
        console.error(`[router] Error removing participant ${userId}:`, err);
      }
      break;
  }
}
