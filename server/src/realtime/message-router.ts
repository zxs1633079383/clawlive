import type { MeetingRoom } from './meeting-room.js';
import type { ClientMessage, ServerMessage } from './types.js';
import { getLobsterOrchestrator } from '../lobster/lobster-orchestrator.js';
import { updateMuteStatus, removeMeetingParticipant } from '../services/participant-service.js';

export function routeMessage(room: MeetingRoom, userId: string, message: ClientMessage): void {
  switch (message.channel) {
    case 'transcript':
      handleTranscript(room, userId, message);
      break;
    case 'lobster':
      handleLobster(room, userId, message);
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
  userId: string,
  message: Extract<ClientMessage, { channel: 'transcript' }>,
): void {
  // Broadcast transcript segment to all participants
  const serverMsg: ServerMessage = {
    channel: 'transcript',
    type: 'segment',
    payload: message.payload,
  };
  room.broadcast(serverMsg);

  // Feed to lobster orchestrator
  const orchestrator = getLobsterOrchestrator(room.meetingId);
  if (orchestrator) {
    orchestrator.distributeTranscript(message.payload).then((suggestions) => {
      for (const suggestion of suggestions) {
        const lobsterMsg: ServerMessage = {
          channel: 'lobster',
          type: 'suggestion',
          payload: suggestion,
          targetUserId: suggestion.ownerUserId,
        };
        room.sendToUser(suggestion.ownerUserId, lobsterMsg);
      }
    }).catch((err) => {
      console.error(`[router] Error distributing transcript in meeting ${room.meetingId}:`, err);
    });
  }
}

function handleLobster(
  room: MeetingRoom,
  userId: string,
  message: Extract<ClientMessage, { channel: 'lobster' }>,
): void {
  const orchestrator = getLobsterOrchestrator(room.meetingId);
  if (!orchestrator) {
    const errorMsg: ServerMessage = {
      channel: 'control',
      type: 'error',
      payload: { message: 'No lobster orchestrator for this meeting' },
    };
    room.sendToUser(userId, errorMsg);
    return;
  }

  orchestrator.handleUserPrompt(userId, message.payload.text).then((response) => {
    const lobsterMsg: ServerMessage = {
      channel: 'lobster',
      type: 'suggestion',
      payload: response,
      targetUserId: userId,
    };
    room.sendToUser(userId, lobsterMsg);
  }).catch((err) => {
    console.error(`[router] Error handling lobster prompt for user ${userId}:`, err);
    const errorMsg: ServerMessage = {
      channel: 'control',
      type: 'error',
      payload: { message: 'Failed to process lobster prompt' },
    };
    room.sendToUser(userId, errorMsg);
  });
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
      // The WebSocket close handler in ws-server.ts handles broadcasting + cleanup
      break;
  }
}
