import type {
  Meeting,
  CreateMeetingRequest,
  JoinMeetingRequest,
  Participant,
  TranscriptSegment,
  LobsterSkill,
} from '@clawlive/shared';

const API_BASE =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001')
    : 'http://localhost:3001';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => 'Unknown error');
    throw new Error(`API ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

export interface MeetingSummary {
  meetingId: string;
  summary: string;
  globalSummary: string;
  personalSummary?: string;
  actionItems: Array<string | { action: string; assignee: string; deadline?: string; status: string }>;
  keyDecisions: Array<string | { decision: string; timestamp: string; participants: string[] }>;
  generatedAt: string;
}

export const api = {
  meetings: {
    create: (data: CreateMeetingRequest) =>
      request<Meeting>('/api/meetings', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    list: () => request<Meeting[]>('/api/meetings'),

    get: (id: string) => request<Meeting>(`/api/meetings/${id}`),

    join: (id: string, data: JoinMeetingRequest) =>
      request<Participant>(`/api/meetings/${id}/join`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    start: (id: string) =>
      request<Meeting>(`/api/meetings/${id}/start`, { method: 'POST' }),

    end: (id: string) =>
      request<Meeting>(`/api/meetings/${id}/end`, { method: 'POST' }),

    getTranscript: (id: string) =>
      request<TranscriptSegment[]>(`/api/meetings/${id}/transcript`),

    getSummary: (id: string, userId?: string) => {
      const params = userId ? `?userId=${encodeURIComponent(userId)}` : '';
      return request<MeetingSummary>(`/api/meetings/${id}/summary${params}`);
    },
  },

  skills: {
    list: () => request<LobsterSkill[]>('/api/skills'),

    get: (name: string) => request<LobsterSkill>(`/api/skills/${name}`),
  },
};
