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
  const [isLobsterLoading, setIsLobsterLoading] = useState(false);
  const [isDialogueThinking, setIsDialogueThinking] = useState(false);

  const { segments, addSegment, scrollRef } = useTranscript();
  const { suggestions, dialogues, addSuggestion, addDialogue } = useLobster();

  // Handle incoming WebSocket messages
  const handleWsMessage = useCallback(
    (msg: ServerMessage) => {
      switch (msg.channel) {
        case 'transcript':
          if (msg.type === 'segment') {
            addSegment(msg.payload);
          }
          break;

        case 'lobster':
          if (msg.type === 'suggestion') {
            // Only show suggestions targeted to this user
            if (msg.targetUserId === userId) {
              addSuggestion(msg.payload);
              setIsLobsterLoading(false);
            }
          } else if (msg.type === 'dialogue') {
            addDialogue(msg.payload);
            setIsDialogueThinking(false);
          }
          break;

        case 'control':
          if (msg.type === 'participant_joined' || msg.type === 'participant_left') {
            // Refresh participant list
            api.meetings.get(meetingId).then((m) => {
              setMeeting(m);
            }).catch(() => { /* ignore */ });
          } else if (msg.type === 'meeting_state_changed') {
            const payload = msg.payload as { status?: string };
            if (payload?.status) {
              setMeeting((prev) =>
                prev ? { ...prev, status: payload.status as Meeting['status'] } : prev,
              );
            }
            if (payload?.status === 'ended') {
              router.push(`/summary/${meetingId}`);
            }
          }
          break;
      }
    },
    [userId, meetingId, addSegment, addSuggestion, addDialogue, router],
  );

  const { send, isConnected, disconnect } = useMeetingWs(
    meetingId,
    userId,
    { onMessage: handleWsMessage },
  );

  // STT: send transcript segments via WebSocket
  const handleSttSegment = useCallback(
    (segment: TranscriptSegment) => {
      addSegment(segment);
      send({ channel: 'transcript', type: 'segment', payload: segment });
    },
    [addSegment, send],
  );

  // Determine whether to use Agora bridge or direct STT
  const useAgoraBridge = Boolean(AGORA_APP_ID);

  // Direct STT (used when Agora is not configured)
  const { isListening, start: startStt, stop: stopStt } = useStt({
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

        // Auto-join the meeting
        const participant = await api.meetings.join(meetingId, {
          userId,
          displayName: userName,
        });
        setParticipants((prev) =>
          prev.some((p) => p.id === participant.id)
            ? prev
            : [...prev, participant],
        );
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
      // Direct STT mode - manage STT manually
      if (newMuted) {
        stopStt();
        send({ channel: 'control', type: 'mute' });
      } else {
        startStt();
        send({ channel: 'control', type: 'unmute' });
      }
    } else {
      // Agora bridge mode - AgoraBridge handles STT sync via isMuted prop
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

  // Send lobster prompt
  function handleSendPrompt(text: string) {
    setIsLobsterLoading(true);
    send({ channel: 'lobster', type: 'user_prompt', payload: { text } });
  }

  // Find current user's lobster skill
  const currentParticipant = participants.find((p) => p.userId === userId);
  const lobsterSkillName = currentParticipant?.lobsterSkillId;

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

        {/* Right: Tabbed panel */}
        <div className="flex w-[400px] flex-col bg-surface-800/50">
          <RightSidePanel
            segments={segments}
            scrollRef={scrollRef}
            suggestions={suggestions}
            dialogues={dialogues}
            onSendPrompt={handleSendPrompt}
            lobsterSkillName={lobsterSkillName}
            isLobsterLoading={isLobsterLoading}
            isDialogueThinking={isDialogueThinking}
          />
        </div>
      </div>
    </div>
  );
}
