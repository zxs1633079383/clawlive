export type MeetingStatus = 'created' | 'lobby' | 'active' | 'ended' | 'summary';

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  status: MeetingStatus;
  createdBy: string;
  createdAt: Date;
  startedAt?: Date;
  endedAt?: Date;
}

export interface Participant {
  id: string;
  meetingId: string;
  userId: string;
  displayName: string;
  lobsterSkillId?: string;
  joinedAt: Date;
  leftAt?: Date;
  isMuted: boolean;
}

export interface CreateMeetingRequest {
  title: string;
  description?: string;
  createdBy: string;
}

export interface JoinMeetingRequest {
  userId: string;
  displayName: string;
  lobsterSkillId?: string;
}
