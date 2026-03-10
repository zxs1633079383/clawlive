import { nanoid } from 'nanoid';
import type { Meeting, MeetingStatus, CreateMeetingRequest } from '../realtime/types.js';

// In-memory store until @clawlive/db Drizzle schema is implemented
const meetings = new Map<string, Meeting>();

// Transcript storage: meetingId -> segments
const transcripts = new Map<string, Array<{ speakerId: string; text: string; timestamp: number }>>();

const VALID_TRANSITIONS: Record<MeetingStatus, readonly MeetingStatus[]> = {
  lobby: ['active'],
  active: ['ended'],
  ended: [],
};

function canTransition(from: MeetingStatus, to: MeetingStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function createMeeting(req: CreateMeetingRequest): Meeting {
  const meeting: Meeting = {
    id: nanoid(),
    title: req.title,
    description: req.description ?? '',
    status: 'lobby',
    createdAt: Date.now(),
    startedAt: null,
    endedAt: null,
  };
  meetings.set(meeting.id, meeting);
  transcripts.set(meeting.id, []);
  return meeting;
}

export function getMeeting(id: string): Meeting | null {
  return meetings.get(id) ?? null;
}

export function listMeetings(): readonly Meeting[] {
  return Array.from(meetings.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export function updateMeetingStatus(id: string, status: MeetingStatus): Meeting {
  const meeting = meetings.get(id);
  if (!meeting) {
    throw new MeetingNotFoundError(id);
  }
  if (!canTransition(meeting.status, status)) {
    throw new InvalidTransitionError(meeting.status, status);
  }

  const updated: Meeting = {
    ...meeting,
    status,
    startedAt: status === 'active' ? Date.now() : meeting.startedAt,
    endedAt: status === 'ended' ? Date.now() : meeting.endedAt,
  };
  meetings.set(id, updated);
  return updated;
}

export function startMeeting(id: string): Meeting {
  return updateMeetingStatus(id, 'active');
}

export function endMeeting(id: string): Meeting {
  return updateMeetingStatus(id, 'ended');
}

export function appendTranscript(
  meetingId: string,
  segment: { speakerId: string; text: string; timestamp: number },
): void {
  const segments = transcripts.get(meetingId);
  if (segments) {
    segments.push(segment);
  }
}

export function getTranscript(
  meetingId: string,
): readonly { speakerId: string; text: string; timestamp: number }[] {
  return transcripts.get(meetingId) ?? [];
}

export class MeetingNotFoundError extends Error {
  constructor(id: string) {
    super(`Meeting not found: ${id}`);
    this.name = 'MeetingNotFoundError';
  }
}

export class InvalidTransitionError extends Error {
  constructor(from: MeetingStatus, to: MeetingStatus) {
    super(`Invalid meeting status transition: ${from} -> ${to}`);
    this.name = 'InvalidTransitionError';
  }
}
