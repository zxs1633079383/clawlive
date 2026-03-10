'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { TranscriptSegment } from '@clawlive/shared';

interface UseSttOptions {
  onSegment: (segment: TranscriptSegment) => void;
  speakerId: string;
  speakerName: string;
  meetingId: string;
  language?: string;
  continuous?: boolean;
}

interface UseSttReturn {
  isListening: boolean;
  isSupported: boolean;
  start: () => void;
  stop: () => void;
  error: string | null;
}

// Generate a simple unique ID
function generateSegmentId(): string {
  return `seg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function useStt(options: UseSttOptions): UseSttReturn {
  const { onSegment, speakerId, speakerName, meetingId, language = 'zh-CN', continuous = true } = options;

  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isStoppingRef = useRef(false);
  const currentSegmentIdRef = useRef<string>(generateSegmentId());

  // Check browser support
  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const createRecognition = useCallback(() => {
    if (!isSupported) return null;

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionAPI();

    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript.trim();

        if (!text) continue;

        const isFinal = result.isFinal;

        const segment: TranscriptSegment = {
          id: currentSegmentIdRef.current,
          meetingId,
          speakerId,
          speakerName,
          text,
          timestamp: new Date(),
          isFinal,
          language,
        };

        onSegment(segment);

        // Generate new ID for next segment when current one is final
        if (isFinal) {
          currentSegmentIdRef.current = generateSegmentId();
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // 'no-speech' and 'aborted' are non-critical
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }
      console.error('[useStt] Recognition error:', event.error);
      setError(`Speech recognition error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      // Auto-restart if not deliberately stopped
      if (!isStoppingRef.current) {
        try {
          recognition.start();
        } catch {
          // May fail if already started
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    };

    return recognition;
  }, [isSupported, continuous, language, meetingId, speakerId, speakerName, onSegment]);

  const start = useCallback(() => {
    if (!isSupported) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    // Stop existing recognition
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    isStoppingRef.current = false;
    const recognition = createRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setIsListening(true);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start speech recognition';
      setError(message);
    }
  }, [isSupported, createRecognition]);

  const stop = useCallback(() => {
    isStoppingRef.current = true;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isStoppingRef.current = true;
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  return { isListening, isSupported, start, stop, error };
}
