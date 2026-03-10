import { type Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { config } from '../config.js';
import { MeetingRoom } from './meeting-room.js';
import { routeMessage } from './message-router.js';
import type { ClientMessage, ServerMessage } from './types.js';

const rooms = new Map<string, MeetingRoom>();

export function getRoom(meetingId: string): MeetingRoom | undefined {
  return rooms.get(meetingId);
}

export function getOrCreateRoom(meetingId: string): MeetingRoom {
  const existing = rooms.get(meetingId);
  if (existing) return existing;
  const room = new MeetingRoom(meetingId);
  rooms.set(meetingId, room);
  return room;
}

export function removeRoom(meetingId: string): void {
  rooms.delete(meetingId);
}

export function createWsServer(httpServer: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const meetingId = url.searchParams.get('meetingId');
    const userId = url.searchParams.get('userId');

    if (!meetingId || !userId) {
      ws.close(4001, 'Missing meetingId or userId query parameter');
      return;
    }

    const room = getOrCreateRoom(meetingId);
    room.addConnection(userId, ws);

    console.log(`[ws] User ${userId} joined meeting ${meetingId} (${room.getParticipantIds().length} participants)`);

    // Notify others
    const joinMessage: ServerMessage = {
      channel: 'control',
      type: 'participant_joined',
      payload: { userId, timestamp: Date.now() },
    };
    room.broadcast(joinMessage, userId);

    // Heartbeat
    let alive = true;
    const heartbeatInterval = setInterval(() => {
      if (!alive) {
        ws.terminate();
        return;
      }
      alive = false;
      ws.ping();
    }, config.WS_HEARTBEAT_INTERVAL_MS);

    ws.on('pong', () => {
      alive = true;
    });

    ws.on('message', (raw) => {
      try {
        const message: ClientMessage = JSON.parse(raw.toString());
        routeMessage(room, userId, message);
      } catch (err) {
        const errorMessage: ServerMessage = {
          channel: 'control',
          type: 'error',
          payload: { message: 'Invalid message format' },
        };
        ws.send(JSON.stringify(errorMessage));
      }
    });

    ws.on('close', () => {
      clearInterval(heartbeatInterval);
      room.removeConnection(userId);

      console.log(`[ws] User ${userId} left meeting ${meetingId} (${room.getParticipantIds().length} remaining)`);

      const leaveMessage: ServerMessage = {
        channel: 'control',
        type: 'participant_left',
        payload: { userId, timestamp: Date.now() },
      };
      room.broadcast(leaveMessage);

      if (room.getParticipantIds().length === 0) {
        removeRoom(meetingId);
        console.log(`[ws] Room ${meetingId} removed (empty)`);
      }
    });

    ws.on('error', (err) => {
      console.error(`[ws] Error for user ${userId} in meeting ${meetingId}:`, err.message);
    });
  });

  console.log('[ws] WebSocket server attached');
  return wss;
}
