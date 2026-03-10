import type { TranscriptSegment } from '../realtime/types.js';

/**
 * Interface for speech-to-text providers.
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
