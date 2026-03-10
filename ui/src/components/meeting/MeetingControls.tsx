'use client';

import { Button } from '@/components/ui/Button';
import { Badge, MeetingStatusBadge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { MeetingStatus } from '@clawlive/shared';

interface MeetingControlsProps {
  meetingTitle: string;
  meetingStatus?: MeetingStatus;
  isConnected: boolean;
  isMuted: boolean;
  isListening: boolean;
  onToggleMute: () => void;
  onLeave: () => void;
}

export function MeetingControls({
  meetingTitle,
  meetingStatus,
  isConnected,
  isMuted,
  isListening,
  onToggleMute,
  onLeave,
}: MeetingControlsProps) {
  return (
    <header className="flex items-center justify-between border-b border-white/5 bg-surface-800/90 px-5 py-3 backdrop-blur-md">
      {/* Left: Meeting info */}
      <div className="flex items-center gap-3">
        <span className="text-xl">🦞</span>
        <div>
          <h1 className="text-sm font-semibold text-text-primary">
            {meetingTitle}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className={cn(
                'inline-block h-1.5 w-1.5 rounded-full',
                isConnected ? 'bg-emerald-400' : 'bg-red-400',
              )}
            />
            <span className="text-xs text-text-muted">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
            {meetingStatus && (
              <MeetingStatusBadge status={meetingStatus} />
            )}
          </div>
        </div>
      </div>

      {/* Center: Status indicators */}
      <div className="flex items-center gap-2">
        {isListening && (
          <Badge variant="success" className="animate-pulse-soft">
            <span className="mr-1">●</span> Listening
          </Badge>
        )}
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-2">
        <Button
          variant={isMuted ? 'danger' : 'secondary'}
          size="sm"
          onClick={onToggleMute}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <span className="flex items-center gap-1.5">
              <MicOffIcon /> Unmute
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <MicIcon /> Mute
            </span>
          )}
        </Button>

        <Button variant="danger" size="sm" onClick={onLeave}>
          Leave
        </Button>
      </div>
    </header>
  );
}

function MicIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="2" x2="22" y1="2" y2="22" />
      <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
      <path d="M5 10v2a7 7 0 0 0 12 5.29" />
      <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}
