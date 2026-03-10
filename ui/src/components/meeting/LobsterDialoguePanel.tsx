'use client';

import { useEffect, useRef } from 'react';
import type { LobsterDialogueTurn } from '@clawlive/shared';
import { formatTime } from '@/lib/utils';
import { LobsterAvatar, getLobsterColor } from './LobsterAvatar';
import { Badge } from '@/components/ui/Badge';

interface LobsterDialoguePanelProps {
  dialogues: LobsterDialogueTurn[];
  isThinking?: boolean;
}

/** Extract the skill name from a lobsterId like "lobster:meetingId:userId" */
function extractSkillHint(lobsterId: string): string {
  // The lobsterId format is "lobster:<meetingId>:<userId>"
  // We use the last segment as a display label
  const parts = lobsterId.split(':');
  return parts[parts.length - 1] ?? lobsterId;
}

/** Infer a collaboration mode badge from the dialogue context */
function getModeBadge(turn: LobsterDialogueTurn): { label: string; className: string } | null {
  if (!turn.toLobsterId) {
    return { label: 'proactive', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
  }
  return { label: 'reactive', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
}

export function LobsterDialoguePanel({
  dialogues,
  isThinking = false,
}: LobsterDialoguePanelProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new dialogues arrive
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, [dialogues.length, isThinking]);

  if (dialogues.length === 0 && !isThinking) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-text-muted">
        <div>
          <div className="mb-3 text-3xl">🦞🦞</div>
          <p className="font-medium">Inter-lobster dialogue</p>
          <p className="mt-1 text-xs leading-relaxed">
            When multiple lobsters are active in a meeting, they collaborate
            behind the scenes to give you better insights. Their conversation
            will appear here in real time.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto p-4 scrollbar-hidden"
    >
      <div className="flex flex-col gap-3">
        {dialogues.map((turn) => {
          const skillHint = extractSkillHint(turn.fromLobsterId);
          const color = getLobsterColor(skillHint);
          const modeBadge = getModeBadge(turn);

          return (
            <div
              key={turn.id}
              className="animate-slide-up rounded-lg border border-white/5 bg-surface-700/50 p-3"
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <LobsterAvatar skillName={skillHint} size="sm" />
                  <span
                    className="text-xs font-semibold"
                    style={{ color }}
                  >
                    {turn.fromLobsterId}
                  </span>

                  {turn.toLobsterId ? (
                    <>
                      <span className="text-[10px] text-text-muted">→</span>
                      <LobsterAvatar
                        skillName={extractSkillHint(turn.toLobsterId)}
                        size="sm"
                      />
                      <span
                        className="text-xs font-semibold"
                        style={{
                          color: getLobsterColor(extractSkillHint(turn.toLobsterId)),
                        }}
                      >
                        {turn.toLobsterId}
                      </span>
                    </>
                  ) : (
                    <span className="rounded bg-surface-600 px-1.5 py-0.5 text-[10px] text-text-muted">
                      broadcast
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {modeBadge && (
                    <span
                      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${modeBadge.className}`}
                    >
                      {modeBadge.label}
                    </span>
                  )}
                  <span className="text-[10px] text-text-muted">
                    {formatTime(turn.timestamp)}
                  </span>
                </div>
              </div>

              {/* Message bubble */}
              <div
                className="mt-2 rounded-lg px-3 py-2 text-sm leading-relaxed text-text-secondary"
                style={{
                  backgroundColor: `${color}08`,
                  borderLeft: `3px solid ${color}40`,
                }}
              >
                {turn.content}
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {isThinking && (
          <div className="animate-slide-up rounded-lg border border-white/5 bg-surface-700/50 p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">🦞</span>
              <span className="text-xs text-text-muted">
                Lobsters are discussing...
              </span>
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-lobster/60" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-lobster/60" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-lobster/60" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
