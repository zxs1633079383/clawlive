'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Meeting, Participant, ServerMessage } from '@clawlive/shared';
import { api } from '@/lib/api';
import { generateId } from '@/lib/utils';
import { useMeetingWs } from '@/hooks/useMeetingWs';
import { useStt } from '@/hooks/useStt';
import { useTranscript } from '@/hooks/useTranscript';
import { useLobster } from '@/hooks/useLobster';
import { MeetingControls } from '@/components/meeting/MeetingControls';
import { ParticipantGrid } from '@/components/meeting/ParticipantGrid';
import { RightSidePanel } from '@/components/meeting/RightSidePanel';

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
            }
          } else if (msg.type === 'dialogue') {
            addDialogue(msg.payload);
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
    (segment: Parameters<typeof addSegment>[0]) => {
      addSegment(segment);
      send({ channel: 'transcript', type: 'segment', payload: segment });
    },
    [addSegment, send],
  );

  const { isListening, start: startStt, stop: stopStt } = useStt({
    meetingId,
    speakerId: userId,
    speakerName: userName,
    onSegment: handleSttSegment,
  });

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

    if (newMuted) {
      stopStt();
      send({ channel: 'control', type: 'mute' });
    } else {
      startStt();
      send({ channel: 'control', type: 'unmute' });
    }
  }

  // Auto-start STT when connected
  useEffect(() => {
    if (isConnected && !isMuted && !isListening) {
      startStt();
    }
  }, [isConnected, isMuted, isListening, startStt]);

  // Leave meeting
  function handleLeave() {
    stopStt();
    send({ channel: 'control', type: 'leave' });
    disconnect();
    router.push('/lobby');
  }

  // Send lobster prompt
  function handleSendPrompt(text: string) {
    send({ channel: 'lobster', type: 'user_prompt', payload: { text } });
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-4xl">🦞</div>
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
      {/* Top controls */}
      <MeetingControls
        meetingTitle={meeting?.title ?? 'Loading...'}
        isConnected={isConnected}
        isMuted={isMuted}
        isListening={isListening}
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
          />
        </div>
      </div>
    </div>
  );
}
