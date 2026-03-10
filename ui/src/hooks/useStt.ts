'use client';

import { useCallback, useRef, useState } from 'react';
import type { TranscriptSegment } from '@clawlive/shared';
import { generateId } from '@/lib/utils';

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

interface UseSttOptions {
  meetingId: string;
  speakerId: string;
  speakerName: string;
  onSegment: (segment: TranscriptSegment) => void;
  language?: string;
}

function getSpeechRecognitionClass():
  | (new () => SpeechRecognitionInstance)
  | null {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function useStt(options: UseSttOptions) {
  const { meetingId, speakerId, speakerName, onSegment, language = 'en-US' } =
    options;

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const segmentIdRef = useRef<string>(generateId());
  const isSupported = getSpeechRecognitionClass() !== null;

  const start = useCallback(() => {
    const SpeechRecognition = getSpeechRecognitionClass();
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim();
        if (!transcript) continue;

        const isFinal = result.isFinal;

        const segment: TranscriptSegment = {
          id: segmentIdRef.current,
          meetingId,
          speakerId,
          speakerName,
          text: transcript,
          timestamp: new Date(),
          isFinal,
          language,
        };

        onSegment(segment);

        if (isFinal) {
          segmentIdRef.current = generateId();
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('[stt] Error:', event.error);
      if (event.error === 'not-allowed') {
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      // Auto-restart unless manually stopped
      if (recognitionRef.current) {
        try {
          recognition.start();
        } catch {
          setIsListening(false);
        }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [meetingId, speakerId, speakerName, language, onSegment]);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    recognition?.stop();
    setIsListening(false);
  }, []);

  return { isListening, start, stop, isSupported };
}
