import type { STTProvider, STTStream } from './stt-provider.js';
import type { TranscriptSegment } from '../realtime/types.js';

/**
 * Stub for the Web Speech API provider.
 *
 * In Phase 1, speech recognition runs entirely in the browser using the
 * Web Speech API. The browser client sends TranscriptSegment messages
 * over WebSocket directly -- no server-side audio processing is needed.
 *
 * This stub exists to satisfy the provider interface and serve as
 * documentation of the architecture. The actual implementation lives
 * in the client's useStt hook.
 */
export class WebSpeechProvider implements STTProvider {
  readonly name = 'web-speech-api';

  startStream(speakerId: string, onSegment: (segment: TranscriptSegment) => void): STTStream {
    console.warn(
      `[stt] WebSpeechProvider.startStream called for speaker ${speakerId}. ` +
      'This is a stub -- speech recognition runs in the browser.',
    );

    return {
      feedAudio(_data: Buffer): void {
        // No-op: browser handles audio capture and recognition
      },
      async close(): Promise<void> {
        // No-op
      },
    };
  }
}
