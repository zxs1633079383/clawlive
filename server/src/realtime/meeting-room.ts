import { WebSocket } from 'ws';
import type { ServerMessage } from './types.js';

export class MeetingRoom {
  private readonly connections: Map<string, WebSocket> = new Map();

  constructor(public readonly meetingId: string) {}

  addConnection(userId: string, ws: WebSocket): void {
    const existing = this.connections.get(userId);
    if (existing && existing.readyState === WebSocket.OPEN) {
      existing.close(4002, 'Replaced by new connection');
    }
    this.connections.set(userId, ws);
  }

  removeConnection(userId: string): void {
    this.connections.delete(userId);
  }

  broadcast(message: ServerMessage, excludeUserId?: string): void {
    const payload = JSON.stringify(message);
    for (const [userId, ws] of this.connections) {
      if (userId === excludeUserId) continue;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  sendToUser(userId: string, message: ServerMessage): void {
    const ws = this.connections.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  getParticipantIds(): readonly string[] {
    return Array.from(this.connections.keys());
  }

  hasUser(userId: string): boolean {
    return this.connections.has(userId);
  }

  get size(): number {
    return this.connections.size;
  }
}
