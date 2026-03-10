import type { STTProvider, STTStream } from './stt-provider.js';
import type { TranscriptSegment } from '../realtime/types.js';

/**
 * Configuration for Deepgram streaming STT.
 */
interface DeepgramStreamConfig {
  language: string;
  model?: string;
  interimResults?: boolean;
}

/**
 * Deepgram streaming STT provider (Phase 2 upgrade).
 * Receives raw audio via WebSocket, streams transcript segments back.
 */
export class DeepgramProvider implements STTProvider {
  readonly name = 'deepgram';
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  startStream(
    speakerId: string,
    onSegment: (segment: TranscriptSegment) => void,
    config?: DeepgramStreamConfig,
  ): STTStream {
    // TODO: Phase 2 implementation
    // 1. Open WebSocket to Deepgram streaming API:
    //    wss://api.deepgram.com/v1/listen?model=nova-2&language=<lang>&interim_results=true
    // 2. Authenticate with Authorization header using this.apiKey
    // 3. Configure model, language, interim results from config
    // 4. In feedAudio(): pipe audio chunks to the Deepgram WebSocket
    // 5. In the Deepgram WebSocket onmessage handler:
    //    - Parse the JSON response
    //    - Extract transcript text and is_final flag
    //    - Construct TranscriptSegment and call onSegment()
    // 6. In close(): send CloseStream message, close WebSocket

    console.warn(
      `[stt] DeepgramProvider.startStream called for speaker ${speakerId}. ` +
      'This is a stub -- Deepgram integration is not yet implemented.',
    );

    return {
      feedAudio(_data: Buffer): void {
        throw new Error('Deepgram provider not yet implemented. Use Web Speech API (browser-side) for Phase 1.');
      },
      async close(): Promise<void> {
        // No-op for stub
      },
    };
  }
}
