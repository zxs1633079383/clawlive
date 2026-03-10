'use client';

import { useCallback, useRef, useState } from 'react';
import type { TranscriptSegment } from '@clawlive/shared';

export function useTranscript() {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const addSegment = useCallback((segment: TranscriptSegment) => {
    setSegments((prev) => {
      // If segment with same id exists, update it (interim -> final)
      const existingIdx = prev.findIndex((s) => s.id === segment.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = segment;
        return updated;
      }
      return [...prev, segment];
    });

    // Auto-scroll after state update
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    });
  }, []);

  const clearSegments = useCallback(() => {
    setSegments([]);
  }, []);

  return { segments, addSegment, clearSegments, scrollRef };
}
