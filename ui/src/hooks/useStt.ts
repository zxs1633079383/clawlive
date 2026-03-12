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
  stage: string;
}

// Generate a simple unique ID
function generateSegmentId(): string {
  return `seg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function useStt(options: UseSttOptions): UseSttReturn {
  const { onSegment, speakerId, speakerName, meetingId, language = 'zh-CN', continuous = true } = options;

  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState('idle');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isStoppingRef = useRef(false);
  const currentSegmentIdRef = useRef<string>(generateSegmentId());
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioActiveRef = useRef(false);

  // Check browser support
  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  console.log('[useStt] Browser support:', {
    isSupported,
    hasSpeechRecognition: typeof window !== 'undefined' && 'SpeechRecognition' in window,
    hasWebkit: typeof window !== 'undefined' && 'webkitSpeechRecognition' in window,
  });

  const createRecognition = useCallback(() => {
    if (!isSupported) {
      console.warn('[useStt] SpeechRecognition not supported in this browser');
      return null;
    }

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionAPI();

    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.maxAlternatives = 1;

    console.log('[useStt] Recognition created:', { continuous, language });

    recognition.onaudiostart = () => {
      console.log('[useStt] 🎤 Audio capture started — microphone is active');
      audioActiveRef.current = true;
      if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
      setStage('🎤 ready');
    };

    recognition.onaudioend = () => {
      console.log('[useStt] 🎤 Audio capture ended');
      // Don't update stage — will auto-restart, avoid flicker
    };

    recognition.onsoundstart = () => {
      console.log('[useStt] 🔊 Sound detected');
    };

    recognition.onsoundend = () => {
      console.log('[useStt] 🔇 Sound ended');
    };

    recognition.onspeechstart = () => {
      console.log('[useStt] 🗣️ Speech detected');
      setStage('🗣️ listening...');
    };

    recognition.onspeechend = () => {
      console.log('[useStt] 🗣️ Speech ended');
    };

    recognition.onstart = () => {
      console.log('[useStt] ✅ Recognition started successfully');
      audioActiveRef.current = false;
      setStage('⏳ connecting mic...');

      // Watchdog: if mic doesn't activate in 5s, recreate
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
      watchdogRef.current = setTimeout(() => {
        if (!audioActiveRef.current && !isStoppingRef.current) {
          console.warn('[useStt] ⏰ Watchdog: mic not active after 5s, recreating...');
          setStage('⏰ restarting...');
          recognition.abort();
        }
      }, 5000);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      console.log('[useStt] 📝 Result received:', {
        resultIndex: event.resultIndex,
        totalResults: event.results.length,
      });

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript.trim();

        if (!text) continue;

        const isFinal = result.isFinal;

        console.log(`[useStt] 📝 Text: "${text}" | final: ${isFinal} | confidence: ${result[0].confidence.toFixed(2)}`);
        setStage(`📝 "${text.slice(0, 20)}${text.length > 20 ? '...' : ''}"`)

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
      console.error('[useStt] ❌ Error:', event.error, event.message);

      // 'no-speech' and 'aborted' are non-critical
      if (event.error === 'no-speech' || event.error === 'aborted') {
        console.log('[useStt] (non-critical error, continuing)');
        return;
      }
      if (event.error === 'not-allowed') {
        console.error('[useStt] ❌ Microphone permission denied! Check browser permissions or HTTPS requirement.');
      }
      setStage(`❌ ${event.error}`);
      setError(`Speech recognition error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      console.log('[useStt] Recognition ended, isStopping:', isStoppingRef.current);
      if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
      // Auto-restart if not deliberately stopped — recreate fresh instance
      if (!isStoppingRef.current) {
        console.log('[useStt] Auto-restarting with fresh instance...');
        setTimeout(() => {
          if (isStoppingRef.current) return;
          const fresh = createRecognition();
          if (fresh) {
            recognitionRef.current = fresh;
            try { fresh.start(); } catch { setIsListening(false); }
          } else {
            setIsListening(false);
          }
        }, 300);
      } else {
        setIsListening(false);
      }
    };

    return recognition;
  }, [isSupported, continuous, language, meetingId, speakerId, speakerName, onSegment]);

  const start = useCallback(() => {
    console.log('[useStt] 🚀 start() called, isSupported:', isSupported);

    if (!isSupported) {
      setError('Speech recognition not supported in this browser');
      console.error('[useStt] ❌ Not supported, aborting start');
      return;
    }

    // Stop existing recognition
    if (recognitionRef.current) {
      console.log('[useStt] Stopping existing recognition...');
      recognitionRef.current.abort();
    }

    isStoppingRef.current = false;
    const recognition = createRecognition();
    if (!recognition) {
      console.error('[useStt] ❌ Failed to create recognition');
      return;
    }

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setIsListening(true);
      setError(null);
      console.log('[useStt] ✅ recognition.start() called successfully');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start speech recognition';
      console.error('[useStt] ❌ Failed to start:', message);
      setError(message);
    }
  }, [isSupported, createRecognition]);

  const stop = useCallback(() => {
    console.log('[useStt] 🛑 stop() called');
    isStoppingRef.current = true;
    if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isStoppingRef.current = true;
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  return { isListening, isSupported, start, stop, error, stage };
}
