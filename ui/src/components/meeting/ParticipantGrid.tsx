'use client';

import type { Participant } from '@clawlive/shared';
import { ParticipantCard } from './ParticipantCard';

interface ParticipantGridProps {
  participants: Participant[];
  currentUserId: string;
}

export function ParticipantGrid({
  participants,
  currentUserId,
}: ParticipantGridProps) {
  if (participants.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-text-muted">
        <div className="text-center">
          <div className="mb-3 text-4xl">🦞</div>
          <p className="text-sm">Waiting for participants...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {participants.map((p) => (
          <ParticipantCard
            key={p.id}
            displayName={p.displayName}
            odixesSpeakerId={p.userId}
            isMuted={p.isMuted}
            hasLobster={!!p.lobsterSkillId}
            lobsterSkillId={p.lobsterSkillId}
            isCurrentUser={p.userId === currentUserId}
          />
        ))}
      </div>
    </div>
  );
}
