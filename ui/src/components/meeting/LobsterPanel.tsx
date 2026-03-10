'use client';

import { useState, type FormEvent } from 'react';
import type { LobsterMessage } from '@clawlive/shared';
import { formatTime } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

interface LobsterPanelProps {
  suggestions: LobsterMessage[];
  onSendPrompt: (text: string) => void;
}

export function LobsterPanel({ suggestions, onSendPrompt }: LobsterPanelProps) {
  const [prompt, setPrompt] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    onSendPrompt(prompt.trim());
    setPrompt('');
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Suggestions list */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-hidden">
        {suggestions.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-12 text-center text-sm text-text-muted">
            <div>
              <div className="mb-3 text-3xl">🦞</div>
              <p>Your lobster is listening...</p>
              <p className="mt-1 text-xs">
                Suggestions will appear here as the conversation progresses
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {suggestions.map((msg) => (
              <div
                key={msg.id}
                className="animate-slide-up rounded-lg border border-lobster/20 bg-lobster-muted p-3"
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-semibold text-lobster">
                    🦞 {msg.lobsterId}
                  </span>
                  <span className="text-[10px] text-text-muted">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-text-primary">
                  {msg.content}
                </p>
              </div>
            ))}
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
          className="flex-1 rounded-lg border border-white/10 bg-surface-700 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-lobster/50 focus:outline-none focus:ring-1 focus:ring-lobster/30"
        />
        <Button type="submit" size="sm" disabled={!prompt.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
