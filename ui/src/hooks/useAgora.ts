'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface AgoraConfig {
  appId: string;
  channel: string;
  token?: string;
  uid?: string | number;
}

interface AgoraState {
  isJoined: boolean;
  isAudioEnabled: boolean;
  remoteUsers: string[];
  error: string | null;
}

interface UseAgoraReturn extends AgoraState {
  join: () => Promise<void>;
  leave: () => Promise<void>;
  toggleAudio: () => Promise<void>;
  isSupported: boolean;
}

export function useAgora(config: AgoraConfig): UseAgoraReturn {
  const [state, setState] = useState<AgoraState>({
    isJoined: false,
    isAudioEnabled: true,
    remoteUsers: [],
    error: null,
  });

  // Dynamic import of Agora SDK - graceful degradation if not available
  const clientRef = useRef<any>(null);
  const localTrackRef = useRef<any>(null);
  const isSupported = typeof window !== 'undefined';

  const join = useCallback(async () => {
    try {
      // Try to dynamically import Agora SDK
      let AgoraRTC: any;
      try {
        AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
      } catch {
        // Agora SDK not installed - use fallback mode
        console.warn('[useAgora] Agora SDK not available. Using local audio only mode.');
        setState(prev => ({ ...prev, isJoined: true, error: null }));
        return;
      }

      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      clientRef.current = client;

      // Subscribe to remote user events
      client.on('user-published', async (user: any, mediaType: string) => {
        await client.subscribe(user, mediaType);
        if (mediaType === 'audio') {
          user.audioTrack?.play();
        }
        setState(prev => ({
          ...prev,
          remoteUsers: [...new Set([...prev.remoteUsers, String(user.uid)])],
        }));
      });

      client.on('user-unpublished', (user: any) => {
        setState(prev => ({
          ...prev,
          remoteUsers: prev.remoteUsers.filter(id => id !== String(user.uid)),
        }));
      });

      client.on('user-left', (user: any) => {
        setState(prev => ({
          ...prev,
          remoteUsers: prev.remoteUsers.filter(id => id !== String(user.uid)),
        }));
      });

      // Join channel
      await client.join(config.appId, config.channel, config.token || null, config.uid || null);

      // Create and publish local audio track
      const localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      localTrackRef.current = localAudioTrack;
      await client.publish([localAudioTrack]);

      setState(prev => ({ ...prev, isJoined: true, isAudioEnabled: true, error: null }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to join audio channel';
      setState(prev => ({ ...prev, error: message }));
      console.error('[useAgora] Join error:', err);
    }
  }, [config.appId, config.channel, config.token, config.uid]);

  const leave = useCallback(async () => {
    try {
      localTrackRef.current?.close();
      localTrackRef.current = null;
      await clientRef.current?.leave();
      clientRef.current = null;
      setState({ isJoined: false, isAudioEnabled: true, remoteUsers: [], error: null });
    } catch (err: unknown) {
      console.error('[useAgora] Leave error:', err);
    }
  }, []);

  const toggleAudio = useCallback(async () => {
    const track = localTrackRef.current;
    if (track) {
      await track.setEnabled(!track.enabled);
      setState(prev => ({ ...prev, isAudioEnabled: track.enabled }));
    } else {
      // Fallback mode - just toggle state
      setState(prev => ({ ...prev, isAudioEnabled: !prev.isAudioEnabled }));
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      localTrackRef.current?.close();
      clientRef.current?.leave();
    };
  }, []);

  return { ...state, join, leave, toggleAudio, isSupported };
}
