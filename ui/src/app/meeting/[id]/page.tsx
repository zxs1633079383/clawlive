'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Meeting, Participant, ServerMessage, TranscriptSegment } from '@clawlive/shared';
import { api } from '@/lib/api';
import { generateId } from '@/lib/utils';
import { useMeetingWs } from '@/hooks/useMeetingWs';
import { useStt } from '@/hooks/useStt';
import { useTranscript } from '@/hooks/useTranscript';
import { useLobster } from '@/hooks/useLobster';
import { MeetingControls } from '@/components/meeting/MeetingControls';
import { ParticipantGrid } from '@/components/meeting/ParticipantGrid';
import { RightSidePanel } from '@/components/meeting/RightSidePanel';
import { AgoraBridge } from '@/components/meeting/AgoraBridge';
import { LobsterJoinBar } from '@/components/meeting/LobsterJoinBar';

// Agora App ID from environment (optional - degrades gracefully if not set)
const AGORA_APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID ?? '';

// Simple user identity for demo purposes
function getOrCreateUserId(): string {
  if (typeof window === 'undefined') return '';
  let id = sessionStorage.getItem('clawlive-user-id');
  if (!id) {
    id = `user-${generateId()}`;
    sessionStorage.setItem('clawlive-user-id', id);
  }
  return id;
}

function getOrCreateUserName(): string {
  if (typeof window === 'undefined') return '';
  let name = sessionStorage.getItem('clawlive-user-name');
  if (!name) {
    const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
    name = names[Math.floor(Math.random() * names.length)];
    sessionStorage.setItem('clawlive-user-name', name);
  }
  return name;
}

export default function MeetingRoomPage() {
  const params = useParams();
  const router = useRouter();
  const meetingId = params.id as string;

  const [userId] = useState(getOrCreateUserId);
  const [userName] = useState(getOrCreateUserName);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioState, setAudioState] = useState({ isJoined: false, isAudioEnabled: true });
  const [isDialogueThinking, setIsDialogueThinking] = useState(false);
  const [lobsterCount, setLobsterCount] = useState(0);
  const [wsLog, setWsLog] = useState<string[]>([]);

  const pushLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setWsLog((prev) => [`[${ts}] ${msg}`, ...prev].slice(0, 20));
  }, []);

  const { segments, addSegment, scrollRef } = useTranscript();
  const { dialogues, addDialogue } = useLobster();

  // Handle incoming WebSocket messages
  // Humans are observers: they see transcript + lobster dialogue
  const handleWsMessage = useCallback(
    (msg: ServerMessage) => {
      switch (msg.channel) {
        case 'transcript':
          if (msg.type === 'segment') {
            const p = msg.payload as { speakerName?: string; text?: string; isFinal?: boolean };
            pushLog(`📥 transcript: "${(p.text ?? '').slice(0, 30)}" final=${p.isFinal}`);
            addSegment(msg.payload);
          }
          break;

        case 'lobster':
          // Lobster dialogue is broadcast to ALL observers
          if (msg.type === 'dialogue') {
            const p = msg.payload as { fromLobsterId?: string; content?: string };
            pushLog(`📥 lobster: [${p.fromLobsterId}] "${(p.content ?? '').slice(0, 40)}"`);
            addDialogue(msg.payload);
            setIsDialogueThinking(false);
          }
          break;

        case 'control':
          pushLog(`📥 control: ${msg.type} ${JSON.stringify(msg.payload).slice(0, 50)}`);
          if (msg.type === 'participant_joined' || msg.type === 'participant_left') {
            api.meetings.get(meetingId).then((m) => {
              setMeeting(m);
              // Update lobster count from participants with lobster- prefix
              const raw = m as Meeting & { participants?: Array<{ userId: string }> };
              if (raw.participants) {
                setLobsterCount(
                  raw.participants.filter((p) => p.userId.startsWith('lobster-')).length,
                );
              }
            }).catch(() => { /* ignore */ });
          } else if (msg.type === 'meeting_state_changed') {
            const payload = msg.payload as { status?: string };
            if (payload?.status) {
              setMeeting((prev) =>
                prev ? { ...prev, status: payload.status as Meeting['status'] } : prev,
              );
            }
          } else if (msg.type === 'meeting_ended') {
            // 会议结束 → 跳转到摘要页面
            // 主龙虾会在后台生成摘要，摘要页面会轮询获取
            router.push(`/summary/${meetingId}`);
          }
          break;
      }
    },
    [meetingId, addSegment, addDialogue, router, pushLog],
  );

  const { send, isConnected, disconnect } = useMeetingWs(
    meetingId,
    userId,
    { onMessage: handleWsMessage },
  );

  // STT: send transcript segments via WebSocket (humans speak, lobsters listen)
  const handleSttSegment = useCallback(
    (segment: TranscriptSegment) => {
      console.log(`[meeting] 📤 STT segment: "${segment.text}" (final: ${segment.isFinal})`);
      pushLog(`📤 send: "${segment.text.slice(0, 30)}" final=${segment.isFinal}`);
      addSegment(segment);
      send({ channel: 'transcript', type: 'segment', payload: segment });
    },
    [addSegment, send, pushLog],
  );

  // Determine whether to use Agora bridge or direct STT
  const useAgoraBridge = Boolean(AGORA_APP_ID);

  // Direct STT (used when Agora is not configured)
  const { isListening, isSupported: isSttSupported, error: sttError, stage: sttStage, start: startStt, stop: stopStt } = useStt({
    meetingId,
    speakerId: userId,
    speakerName: userName,
    onSegment: handleSttSegment,
  });

  // Handle audio state changes from AgoraBridge
  const handleAudioStateChange = useCallback(
    (state: { isJoined: boolean; isAudioEnabled: boolean }) => {
      setAudioState(state);
    },
    [],
  );

  // Fetch meeting data on mount
  useEffect(() => {
    async function init() {
      try {
        const m = await api.meetings.get(meetingId);
        setMeeting(m);

        // Auto-join the meeting as human observer
        const participant = await api.meetings.join(meetingId, {
          userId,
          displayName: userName,
        });
        setParticipants((prev) =>
          prev.some((p) => p.id === participant.id)
            ? prev
            : [...prev, participant],
        );

        // Auto-start meeting if still in lobby
        if (m.status === 'lobby') {
          try {
            const started = await api.meetings.start(meetingId);
            setMeeting(started);
          } catch {
            // Another participant may have already started it
          }
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to join meeting',
        );
      }
    }
    init();
  }, [meetingId, userId, userName]);

  // Toggle mute
  function handleToggleMute() {
    const newMuted = !isMuted;
    setIsMuted(newMuted);

    if (!useAgoraBridge) {
      if (newMuted) {
        stopStt();
        send({ channel: 'control', type: 'mute' });
      } else {
        startStt();
        send({ channel: 'control', type: 'unmute' });
      }
    } else {
      send({ channel: 'control', type: newMuted ? 'mute' : 'unmute' });
    }
  }

  // Auto-start STT when connected (direct mode only)
  useEffect(() => {
    if (!useAgoraBridge && isConnected && !isMuted && !isListening) {
      startStt();
    }
  }, [useAgoraBridge, isConnected, isMuted, isListening, startStt]);

  // Leave meeting
  function handleLeave() {
    if (!useAgoraBridge) {
      stopStt();
    }
    send({ channel: 'control', type: 'leave' });
    disconnect();
    router.push('/lobby');
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-4xl">&#x1F99E;</div>
          <h2 className="text-lg font-semibold text-text-primary">
            Unable to join meeting
          </h2>
          <p className="mt-2 text-sm text-text-secondary">{error}</p>
          <button
            onClick={() => router.push('/lobby')}
            className="mt-4 text-sm text-lobster hover:underline"
          >
            Back to lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface-900">
      {/* Agora Bridge (hidden audio + STT bridge component) */}
      {useAgoraBridge && (
        <AgoraBridge
          meetingId={meetingId}
          userId={userId}
          userName={userName}
          agoraAppId={AGORA_APP_ID}
          isMuted={isMuted}
          onTranscriptSegment={handleSttSegment}
          onAudioStateChange={handleAudioStateChange}
        />
      )}

      {/* Lobster invite URL — show link for lobsters to join */}
      <LobsterJoinBar meetingId={meetingId} lobsterCount={lobsterCount} />

      {/* Top controls */}
      <MeetingControls
        meetingTitle={meeting?.title ?? 'Loading...'}
        meetingStatus={meeting?.status}
        isConnected={isConnected}
        isMuted={isMuted}
        isListening={useAgoraBridge ? (audioState.isJoined && !isMuted) : isListening}
        onToggleMute={handleToggleMute}
        onLeave={handleLeave}
      />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Participant grid */}
        <div className="flex flex-1 flex-col border-r border-white/5">
          <ParticipantGrid
            participants={participants}
            currentUserId={userId}
          />
        </div>

        {/* Right: Lobster Discussion (primary) + Transcript (secondary) */}
        <div className="flex w-[400px] flex-col bg-surface-800/50">
          <RightSidePanel
            segments={segments}
            scrollRef={scrollRef}
            dialogues={dialogues}
            isDialogueThinking={isDialogueThinking}
          />
        </div>
      </div>

      {/* Debug panel — STT + WebSocket log */}
      {!useAgoraBridge && (
        <div className="border-t border-white/10 bg-surface-900 text-[10px] font-mono text-text-muted">
          <div suppressHydrationWarning className="flex items-center gap-3 px-4 py-1">
            <span suppressHydrationWarning>STT: {isSttSupported ? '✅' : '❌'}</span>
            <span>Listening: {isListening ? '🟢' : '🔴'}</span>
            <span>WS: {isConnected ? '🟢' : '🔴'}</span>
            <span>Muted: {isMuted ? 'yes' : 'no'}</span>
            <span>Seg: {segments.length}</span>
            <span className="text-yellow-400">{sttStage}</span>
            {sttError && <span className="text-red-400">{sttError}</span>}
          </div>
          {wsLog.length > 0 && (
            <div className="max-h-[120px] overflow-y-auto border-t border-white/5 px-4 py-1 space-y-0.5">
              {wsLog.map((line, i) => (
                <div key={i} className={line.includes('📤') ? 'text-blue-400' : line.includes('lobster') ? 'text-orange-400' : 'text-text-muted'}>
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
