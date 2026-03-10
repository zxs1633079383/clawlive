'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { LobsterMessage } from '@clawlive/shared';
import { formatTime } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { LobsterAvatar, getLobsterColor } from './LobsterAvatar';

interface LobsterPanelProps {
  suggestions: LobsterMessage[];
  onSendPrompt: (text: string) => void;
  lobsterSkillName?: string;
  lobsterDescription?: string;
  isLoading?: boolean;
}

/** Render simple markdown-like formatting: **bold**, bullet points */
function renderContent(content: string): React.ReactNode {
  const lines = content.split('\n');

  return lines.map((line, lineIdx) => {
    const trimmed = line.trim();

    // Bullet points
    const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ');
    const bulletContent = isBullet ? trimmed.slice(2) : trimmed;

    // Bold text: **text**
    const parts = bulletContent.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((part, partIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={partIdx} className="font-semibold text-text-primary">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={partIdx}>{part}</span>;
    });

    if (isBullet) {
      return (
        <div key={lineIdx} className="flex items-start gap-1.5 pl-1">
          <span className="mt-1 text-lobster/70 text-[10px]">&bull;</span>
          <span>{rendered}</span>
        </div>
      );
    }

    if (trimmed === '') {
      return <div key={lineIdx} className="h-1.5" />;
    }

    return (
      <div key={lineIdx}>{rendered}</div>
    );
  });
}

export function LobsterPanel({
  suggestions,
  onSendPrompt,
  lobsterSkillName,
  lobsterDescription,
  isLoading = false,
}: LobsterPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const visibleSuggestions = suggestions.filter((s) => !dismissedIds.has(s.id));

  // Auto-scroll on new suggestions
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, [visibleSuggestions.length, isLoading]);

  const handleDismiss = useCallback((id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]));
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;
    onSendPrompt(prompt.trim());
    setPrompt('');
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Skill header */}
      {lobsterSkillName && (
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2.5">
          <LobsterAvatar skillName={lobsterSkillName} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-text-primary">{lobsterSkillName}</p>
            {lobsterDescription && (
              <p className="truncate text-[10px] text-text-muted">{lobsterDescription}</p>
            )}
          </div>
        </div>
      )}

      {/* Suggestions list */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 scrollbar-hidden">
        {visibleSuggestions.length === 0 && !isLoading ? (
          <div className="flex flex-1 items-center justify-center py-12 text-center text-sm text-text-muted">
            <div>
              <div className="mb-3 text-3xl">🦞</div>
              <p className="font-medium">Your lobster is listening...</p>
              <p className="mt-1 text-xs leading-relaxed">
                Suggestions will appear here as the conversation progresses.
                You can also ask your lobster a direct question below.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {visibleSuggestions.map((msg) => {
              const skillHint = extractSkillFromLobsterId(msg.lobsterId);
              const color = getLobsterColor(skillHint);

              return (
                <div
                  key={msg.id}
                  className="animate-slide-up group rounded-lg border border-lobster/20 bg-lobster-muted p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <LobsterAvatar skillName={skillHint} size="sm" />
                      <span
                        className="text-xs font-semibold"
                        style={{ color }}
                      >
                        {skillHint}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-text-muted">
                        {formatTime(msg.timestamp)}
                      </span>
                      <button
                        onClick={() => handleDismiss(msg.id)}
                        className="hidden text-text-muted transition-colors hover:text-text-secondary group-hover:inline-flex"
                        title="Dismiss suggestion"
                        aria-label="Dismiss suggestion"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="mt-1.5 text-sm leading-relaxed text-text-primary">
                    {renderContent(msg.content)}
                  </div>
                </div>
              );
            })}

            {/* Loading indicator */}
            {isLoading && (
              <div className="animate-slide-up rounded-lg border border-lobster/10 bg-lobster-muted/50 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🦞</span>
                  <span className="text-xs text-text-muted">
                    Your lobster is thinking...
                  </span>
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-lobster/60" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-lobster/60" style={{ animationDelay: '150ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-lobster/60" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Prompt input */}
      <form
        onSubmit={handleSubmit}
        className="flex gap-2 border-t border-white/5 p-3"
      >
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask your lobster..."
          disabled={isLoading}
          className="flex-1 rounded-lg border border-white/10 bg-surface-700 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-lobster/50 focus:outline-none focus:ring-1 focus:ring-lobster/30 disabled:opacity-50"
        />
        <Button type="submit" size="sm" disabled={!prompt.trim() || isLoading}>
          {isLoading ? (
            <span className="flex items-center gap-1">
              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              ...
            </span>
          ) : (
            'Send'
          )}
        </Button>
      </form>
    </div>
  );
}

/** Extract a skill hint from a lobsterId like "lobster:meetingId:userId" */
function extractSkillFromLobsterId(lobsterId: string): string {
  const parts = lobsterId.split(':');
  return parts[parts.length - 1] ?? lobsterId;
}
