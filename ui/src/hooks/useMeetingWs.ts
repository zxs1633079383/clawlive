'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMessage, ServerMessage } from '@clawlive/shared';

const WS_BASE =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001')
    : 'ws://localhost:3001';

const MAX_RECONNECT_DELAY = 30_000;
const INITIAL_RECONNECT_DELAY = 1_000;

interface UseMeetingWsOptions {
  onMessage?: (msg: ServerMessage) => void;
}

export function useMeetingWs(
  meetingId: string,
  userId: string,
  options?: UseMeetingWsOptions,
) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelay = useRef(INITIAL_RECONNECT_DELAY);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(options?.onMessage);
  onMessageRef.current = options?.onMessage;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const url = `${WS_BASE}/ws?meetingId=${encodeURIComponent(meetingId)}&userId=${encodeURIComponent(userId)}`;
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setIsConnected(true);
      setLastError(null);
      reconnectDelay.current = INITIAL_RECONNECT_DELAY;
    };

    ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);
        onMessageRef.current?.(msg);
      } catch {
        console.error('[ws] Failed to parse message:', event.data);
      }
    };

    ws.onerror = () => {
      setLastError('WebSocket connection error');
    };

    ws.onclose = (event) => {
      setIsConnected(false);
      wsRef.current = null;

      // Don't reconnect on intentional close (code 1000)
      if (event.code === 1000) return;

      reconnectTimer.current = setTimeout(() => {
        reconnectDelay.current = Math.min(
          reconnectDelay.current * 2,
          MAX_RECONNECT_DELAY,
        );
        connect();
      }, reconnectDelay.current);
    };

    wsRef.current = ws;
  }, [meetingId, userId]);

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('[ws] Cannot send - not connected');
      return;
    }
    ws.send(JSON.stringify(msg));
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    wsRef.current?.close(1000, 'User left');
    wsRef.current = null;
    setIsConnected(false);
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { send, isConnected, lastError, disconnect };
}
