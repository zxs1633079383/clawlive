'use client';

import React, { type RefObject, useEffect, useRef, useState } from 'react';
import type { TranscriptSegment } from '@clawlive/shared';
import { cn, formatTime, speakerColor } from '@/lib/utils';

interface TranscriptPanelProps {
  segments: TranscriptSegment[];
  scrollRef: RefObject<HTMLDivElement | null>;
}

export function TranscriptPanel({ segments, scrollRef }: TranscriptPanelProps) {
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Determine if any segments are still streaming (interim)
  const hasInterim = segments.some((seg) => !seg.isFinal);

  // Smooth auto-scroll to bottom when new segments arrive
  useEffect(() => {
    if (isAutoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [segments, isAutoScroll]);

  // Detect manual scroll to disable auto-scroll
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    function handleScroll() {
      if (!container) return;
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
      setIsAutoScroll(isAtBottom);
    }

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [scrollRef]);

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
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* Live indicator */}
      {hasInterim && (
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-red-400">
            Live
          </span>
        </div>
      )}

      {/* Transcript content */}
      <div
        ref={scrollRef as React.RefObject<HTMLDivElement>}
        className="flex-1 overflow-y-auto p-4 scrollbar-hidden"
      >
        <div className="flex flex-col gap-3">
          {segments.map((seg) => {
            const color = speakerColor(seg.speakerId);
            return (
              <div
                key={`${seg.id}-${seg.isFinal}`}
                className={cn(
                  'animate-fade-in rounded-md px-3 py-2 transition-colors duration-300',
                  seg.isFinal
                    ? 'bg-transparent'
                    : 'bg-white/[0.02]',
                )}
              >
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
                  {!seg.isFinal && (
                    <span className="text-[10px] italic text-text-muted">
                      typing...
                    </span>
                  )}
                </div>
                <p
                  className={cn(
                    'mt-0.5 text-sm leading-relaxed transition-all duration-300',
                    seg.isFinal
                      ? 'text-text-primary'
                      : 'text-text-muted italic opacity-80',
                  )}
                >
                  {seg.text}
                </p>
              </div>
            );
          })}
          {/* Scroll anchor */}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Scroll-to-bottom button */}
      {!isAutoScroll && (
        <button
          onClick={() => {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
            setIsAutoScroll(true);
          }}
          className="absolute bottom-4 right-4 rounded-full bg-surface-700 px-3 py-1.5 text-[10px] text-text-secondary shadow-lg transition-colors hover:bg-surface-600"
        >
          Scroll to latest
        </button>
      )}
    </div>
  );
}
