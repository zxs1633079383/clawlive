import type {
  Meeting,
  CreateMeetingRequest,
  JoinMeetingRequest,
  Participant,
  TranscriptSegment,
  LobsterSkill,
} from '@clawlive/shared';

function getApiBase(): string {
  if (typeof window === 'undefined') return 'http://localhost:3001';
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  const isHttps = window.location.protocol === 'https:';
  // HTTPS → API via SSL proxy on 3444; HTTP → API direct on 3001
  const apiPort = isHttps ? 3444 : 3001;
  return `${window.location.protocol}//${window.location.hostname}:${apiPort}`;
}

const API_BASE = getApiBase();

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => 'Unknown error');
    throw new Error(`API ${res.status}: ${body}`);
  }

  const json = await res.json();

  // 服务器返回 { success, data, error } 格式，解包 data
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    if (!json.success) {
      throw new Error(json.error ?? 'API request failed');
    }
    return json.data as T;
  }

  return json as T;
}

/** 龙虾对话轮次 (API 返回的 JSON，timestamp 为 number) */
export interface DialogueTurnData {
  fromLobsterId: string;
  toLobsterId?: string | null;
  content: string;
  timestamp: number;
}

/** 主龙虾摘要 (API 返回的 JSON，timestamp 为 number) */
export interface SummaryData {
  fromLobsterId: string;
  summary: string;
  keyDecisions: string[];
  actionItems: string[];
  timestamp: number;
}

/** 会议摘要数据 — 包含转录、龙虾讨论、主龙虾生成的摘要 */
export interface MeetingSummaryData {
  meetingId: string;
  title: string;
  description: string;
  startedAt: number | null;
  endedAt: number | null;
  participants: Array<{ userId: string; displayName: string }>;
  lobsters: Array<{ lobsterId: string; skillName: string; skillDescription: string; collaborationMode: string; ownerUserId: string }>;
  transcript: Array<{ speakerId: string; speakerName?: string; text: string; timestamp: number }>;
  dialogues: DialogueTurnData[];
  summary: SummaryData | null;
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

    getSummary: (id: string) =>
      request<MeetingSummaryData>(`/api/meetings/${id}/summary`),

    // Lobster reads SKILL.md from URL and joins meeting
    addLobster: (id: string, data: { ownerUserId: string; skillSource: string }) =>
      request<{ lobsterId: string; skillName: string; skillDescription: string; collaborationMode: string }>(
        `/api/meetings/${id}/lobster`,
        { method: 'POST', body: JSON.stringify(data) },
      ),
  },

  skills: {
    list: () => request<LobsterSkill[]>('/api/skills'),

    get: (name: string) => request<LobsterSkill>(`/api/skills/${name}`),
  },
};

/** PR Bot smoke test — verify GitNexus impact analysis fires */
export const _gitnexusSmokeTest = (id: string) => fetch(`/api/meetings/${id}/_smoke`);

/** Real code change to trigger detect_changes */
export const fetchUserById = (id: string) => fetch(`/api/users/${id}`).then(r => r.json());
