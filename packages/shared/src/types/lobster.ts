export type CollaborationMode = 'passive' | 'reactive' | 'proactive';

export interface LobsterSkill {
  name: string;
  description: string;
  version: string;
  identity: string;
  rules: string[];
  triggerInterval: number; // seconds
  maxSuggestionRate: number; // seconds between suggestions
  triggerConditions: string[];
  collaborationMode: CollaborationMode;
  preferredFormat: string;
  maxLength: number; // tokens
  language: string;
  rawContent: string; // full markdown
}

export interface LobsterMessage {
  id: string;
  meetingId: string;
  lobsterId: string;
  ownerUserId: string;
  type: 'suggestion' | 'response' | 'dialogue';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface LobsterDialogueTurn {
  id: string;
  meetingId: string;
  fromLobsterId: string;
  toLobsterId?: string; // null = broadcast to all lobsters
  content: string;
  timestamp: Date;
}
