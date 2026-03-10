'use client';

import React, { type RefObject } from 'react';
import type { TranscriptSegment } from '@clawlive/shared';
import { cn, formatTime, speakerColor } from '@/lib/utils';

interface TranscriptPanelProps {
  segments: TranscriptSegment[];
  scrollRef: RefObject<HTMLDivElement | null>;
}

export function TranscriptPanel({ segments, scrollRef }: TranscriptPanelProps) {
  if (segments.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-text-muted">
        <div>
          <p>Transcript will appear here</p>
          <p className="mt-1 text-xs">Start speaking to see real-time captions</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef as React.RefObject<HTMLDivElement>}
      className="flex-1 overflow-y-auto p-4 scrollbar-hidden"
    >
      <div className="flex flex-col gap-3">
        {segments.map((seg) => {
          const color = speakerColor(seg.speakerId);
          return (
            <div key={`${seg.id}-${seg.isFinal}`} className="animate-fade-in">
              <div className="flex items-baseline gap-2">
                <span
                  className="text-xs font-semibold"
                  style={{ color }}
                >
                  {seg.speakerName}
                </span>
                <span className="text-[10px] text-text-muted">
                  {formatTime(seg.timestamp)}
                </span>
              </div>
              <p
                className={cn(
                  'mt-0.5 text-sm leading-relaxed',
                  seg.isFinal ? 'text-text-primary' : 'text-text-muted italic',
                )}
              >
                {seg.text}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
