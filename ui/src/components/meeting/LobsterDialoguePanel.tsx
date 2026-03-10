'use client';

import type { LobsterDialogueTurn } from '@clawlive/shared';
import { formatTime, speakerColor } from '@/lib/utils';

interface LobsterDialoguePanelProps {
  dialogues: LobsterDialogueTurn[];
}

export function LobsterDialoguePanel({
  dialogues,
}: LobsterDialoguePanelProps) {
  if (dialogues.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-text-muted">
        <div>
          <div className="mb-3 text-3xl">🦞🦞</div>
          <p>Inter-lobster dialogue</p>
          <p className="mt-1 text-xs">
            Watch your lobsters collaborate behind the scenes
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 scrollbar-hidden">
      <div className="flex flex-col gap-3">
        {dialogues.map((turn) => {
          const color = speakerColor(turn.fromLobsterId);
          return (
            <div
              key={turn.id}
              className="animate-slide-up rounded-lg border border-white/5 bg-surface-700/50 p-3"
            >
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm">🦞</span>
                  <span
                    className="text-xs font-semibold"
                    style={{ color }}
                  >
                    {turn.fromLobsterId}
                  </span>
                  {turn.toLobsterId && (
                    <>
                      <span className="text-[10px] text-text-muted">to</span>
                      <span className="text-sm">🦞</span>
                      <span
                        className="text-xs font-semibold"
                        style={{ color: speakerColor(turn.toLobsterId) }}
                      >
                        {turn.toLobsterId}
                      </span>
                    </>
                  )}
                  {!turn.toLobsterId && (
                    <span className="rounded bg-surface-600 px-1.5 py-0.5 text-[10px] text-text-muted">
                      broadcast
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-text-muted">
                  {formatTime(turn.timestamp)}
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                {turn.content}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
