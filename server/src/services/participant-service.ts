import type { Participant, JoinMeetingRequest } from '../realtime/types.js';

// In-memory store until @clawlive/db Drizzle schema is implemented
// Key: `${meetingId}:${userId}`
const participants = new Map<string, Participant>();

function key(meetingId: string, userId: string): string {
  return `${meetingId}:${userId}`;
}

export function joinMeeting(meetingId: string, req: JoinMeetingRequest): Participant {
  const k = key(meetingId, req.userId);
  const existing = participants.get(k);
  if (existing) {
    // Re-join: update display name and skill, reset mute
    const updated: Participant = {
      ...existing,
      displayName: req.displayName,
      skillName: req.skillName ?? existing.skillName,
      isMuted: false,
    };
    participants.set(k, updated);
    return updated;
  }

  const participant: Participant = {
    userId: req.userId,
    meetingId,
    displayName: req.displayName,
    skillName: req.skillName ?? null,
    isMuted: false,
    joinedAt: Date.now(),
  };
  participants.set(k, participant);
  return participant;
}

export function removeMeetingParticipant(meetingId: string, userId: string): void {
  participants.delete(key(meetingId, userId));
}

export function getParticipants(meetingId: string): readonly Participant[] {
  const result: Participant[] = [];
  for (const [k, p] of participants) {
    if (k.startsWith(`${meetingId}:`)) {
      result.push(p);
    }
  }
  return result;
}

export function getParticipant(meetingId: string, userId: string): Participant | null {
  return participants.get(key(meetingId, userId)) ?? null;
}

export function updateMuteStatus(meetingId: string, userId: string, isMuted: boolean): Participant {
  const k = key(meetingId, userId);
  const participant = participants.get(k);
  if (!participant) {
    throw new ParticipantNotFoundError(meetingId, userId);
  }
  const updated: Participant = { ...participant, isMuted };
  participants.set(k, updated);
  return updated;
}

export class ParticipantNotFoundError extends Error {
  constructor(meetingId: string, userId: string) {
    super(`Participant not found: user ${userId} in meeting ${meetingId}`);
    this.name = 'ParticipantNotFoundError';
  }
}
