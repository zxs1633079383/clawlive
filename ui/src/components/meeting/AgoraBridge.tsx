'use client';

import { useEffect } from 'react';
import { useAgora } from '@/hooks/useAgora';
import { useStt } from '@/hooks/useStt';
import type { TranscriptSegment } from '@clawlive/shared';

interface AgoraBridgeProps {
  meetingId: string;
  userId: string;
  userName: string;
  agoraAppId: string;
  isMuted: boolean;
  onTranscriptSegment: (segment: TranscriptSegment) => void;
  onAudioStateChange?: (state: { isJoined: boolean; isAudioEnabled: boolean }) => void;
}

export function AgoraBridge({
  meetingId,
  userId,
  userName,
  agoraAppId,
  isMuted,
  onTranscriptSegment,
  onAudioStateChange,
}: AgoraBridgeProps) {
  const agora = useAgora({
    appId: agoraAppId,
    channel: meetingId,
    uid: userId,
  });

  const stt = useStt({
    onSegment: onTranscriptSegment,
    speakerId: userId,
    speakerName: userName,
    meetingId,
  });

  // Auto-join audio channel on mount
  useEffect(() => {
    agora.join();
    return () => { agora.leave(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start STT when joined
  useEffect(() => {
    if (agora.isJoined && !stt.isListening) {
      stt.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agora.isJoined]);

  // Sync mute state
  useEffect(() => {
    if (agora.isAudioEnabled === isMuted) {
      agora.toggleAudio();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMuted]);

  // Notify parent of audio state changes
  useEffect(() => {
    onAudioStateChange?.({ isJoined: agora.isJoined, isAudioEnabled: agora.isAudioEnabled });
  }, [agora.isJoined, agora.isAudioEnabled, onAudioStateChange]);

  // Stop STT when muted, restart when unmuted
  useEffect(() => {
    if (isMuted && stt.isListening) {
      stt.stop();
    } else if (!isMuted && agora.isJoined && !stt.isListening) {
      stt.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMuted]);

  // Render nothing - this is a logic-only bridge component
  return null;
}
