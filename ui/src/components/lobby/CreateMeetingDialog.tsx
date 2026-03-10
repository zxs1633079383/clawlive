'use client';

import { useState, type FormEvent } from 'react';
import { Dialog, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface CreateMeetingDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: { title: string; description: string }) => void;
  isLoading?: boolean;
}

export function CreateMeetingDialog({
  open,
  onClose,
  onCreate,
  isLoading,
}: CreateMeetingDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate({ title: title.trim(), description: description.trim() });
    setTitle('');
    setDescription('');
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Create a Meeting</DialogTitle>
      <DialogDescription>
        Start a new meeting and invite participants to join.
      </DialogDescription>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <Input
          label="Meeting Title"
          placeholder="Weekly standup..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
        />
        <Input
          label="Description (optional)"
          placeholder="Brief description of the meeting..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!title.trim() || isLoading}>
            {isLoading ? 'Creating...' : 'Create Meeting'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
