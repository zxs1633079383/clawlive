'use client';

import { cn, speakerColor } from '@/lib/utils';
import { LobsterAvatar, getLobsterColor } from './LobsterAvatar';

interface ParticipantCardProps {
  displayName: string;
  odixesSpeakerId: string;
  isMuted: boolean;
  hasLobster: boolean;
  lobsterSkillId?: string;
  isCurrentUser?: boolean;
}

export function ParticipantCard({
  displayName,
  odixesSpeakerId: speakerId,
  isMuted,
  hasLobster,
  lobsterSkillId,
  isCurrentUser,
}: ParticipantCardProps) {
  const color = speakerColor(speakerId);

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center rounded-xl border p-6',
        'bg-surface-700/50 transition-all duration-200',
        isCurrentUser
          ? 'border-lobster/30 lobster-glow'
          : 'border-white/5 hover:border-white/10',
      )}
    >
      {/* Avatar */}
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-white"
        style={{ backgroundColor: `${color}30`, color }}
      >
        {displayName.charAt(0).toUpperCase()}
      </div>

      {/* Name */}
      <p className="mt-3 text-sm font-medium text-text-primary">
        {displayName}
        {isCurrentUser && (
          <span className="ml-1 text-xs text-text-muted">(you)</span>
        )}
      </p>

      {/* Mute indicator */}
      {isMuted && (
        <span className="mt-1 text-xs text-red-400/80">Muted</span>
      )}

      {/* Lobster indicator with role badge */}
      {hasLobster && (
        <div className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border border-lobster/30 bg-surface-800 text-sm">
          🦞
        </div>
      )}

      {/* Lobster role badge */}
      {lobsterSkillId && (
        <div className="mt-2 flex items-center gap-1.5 rounded-full px-2 py-0.5"
          style={{
            backgroundColor: `${getLobsterColor(lobsterSkillId)}15`,
            border: `1px solid ${getLobsterColor(lobsterSkillId)}30`,
          }}
        >
          <LobsterAvatar skillName={lobsterSkillId} size="sm" />
          <span
            className="text-[10px] font-medium"
            style={{ color: getLobsterColor(lobsterSkillId) }}
          >
            {lobsterSkillId}
          </span>
        </div>
      )}
    </div>
  );
}
