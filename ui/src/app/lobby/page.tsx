'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Meeting } from '@clawlive/shared';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { MeetingCard } from '@/components/lobby/MeetingCard';
import { CreateMeetingDialog } from '@/components/lobby/CreateMeetingDialog';

export default function LobbyPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMeetings = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.meetings.list();
      setMeetings(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load meetings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  async function handleCreate(data: { title: string; description: string }) {
    try {
      setIsCreating(true);
      const meeting = await api.meetings.create({
        title: data.title,
        description: data.description || undefined,
        createdBy: 'anonymous',
      });
      setIsDialogOpen(false);
      router.push(`/meeting/${meeting.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create meeting');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Meetings <span className="ml-1">🦞</span>
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Create or join a meeting to get started.
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>+ New Meeting</Button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20 text-text-muted">
          <span className="animate-pulse-soft">Loading meetings...</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && meetings.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 text-5xl">🦞</div>
          <h2 className="text-lg font-semibold text-text-primary">
            No meetings yet
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Create your first meeting to get started.
          </p>
          <Button className="mt-6" onClick={() => setIsDialogOpen(true)}>
            Create Meeting
          </Button>
        </div>
      )}

      {/* Meeting List */}
      {!isLoading && meetings.length > 0 && (
        <div className="flex flex-col gap-3">
          {meetings.map((meeting) => (
            <MeetingCard key={meeting.id} meeting={meeting} />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <CreateMeetingDialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onCreate={handleCreate}
        isLoading={isCreating}
      />
    </main>
  );
}
