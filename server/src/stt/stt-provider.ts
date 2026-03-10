import type { TranscriptSegment } from '../realtime/types.js';

export type TranscriptCallback = (segment: TranscriptSegment) => void;

export interface SttConfig {
  language: string;
  model?: string;
  interimResults?: boolean;
}

/**
 * Pluggable STT provider interface.
 * Phase 1: Browser-side Web Speech API (no server implementation needed)
 * Phase 2: Server-side Deepgram streaming
 */
export interface SttProvider {
  startStreaming(config: SttConfig, onTranscript: TranscriptCallback): Promise<void>;
  stopStreaming(): Promise<void>;
}

/**
 * Interface for speech-to-text providers (stream-oriented).
 *
 * Phase 1: Web Speech API runs in the browser; the server receives
 * TranscriptSegment messages over WebSocket. No server-side STT needed.
 *
 * Phase 2: Deepgram or other server-side STT can implement this interface
 * to process raw audio streams on the server.
 */
export interface STTProvider {
  readonly name: string;

  /**
   * Start processing an audio stream for a given speaker.
   */
  startStream(speakerId: string, onSegment: (segment: TranscriptSegment) => void): STTStream;
}

export interface STTStream {
  /**
   * Feed raw audio data (PCM or codec-specific) to the STT engine.
   */
  feedAudio(data: Buffer): void;

  /**
   * Signal end of audio input and finalize remaining text.
   */
  close(): Promise<void>;
}
