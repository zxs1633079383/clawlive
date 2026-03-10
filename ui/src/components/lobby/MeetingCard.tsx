'use client';

import Link from 'next/link';
import type { Meeting } from '@clawlive/shared';
import { Card } from '@/components/ui/Card';
import { MeetingStatusBadge } from '@/components/ui/Badge';
import { formatRelativeTime } from '@/lib/utils';

interface MeetingCardProps {
  meeting: Meeting;
}

export function MeetingCard({ meeting }: MeetingCardProps) {
  return (
    <Link href={`/meeting/${meeting.id}`}>
      <Card className="glass-hover cursor-pointer p-5 transition-transform duration-150 hover:scale-[1.01]">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-text-primary">
              {meeting.title}
            </h3>
            {meeting.description && (
              <p className="mt-1 line-clamp-2 text-sm text-text-secondary">
                {meeting.description}
              </p>
            )}
          </div>
          <MeetingStatusBadge status={meeting.status} />
        </div>

        <div className="mt-4 flex items-center gap-4 text-xs text-text-muted">
          <span>Created by {meeting.createdBy}</span>
          <span>{formatRelativeTime(meeting.createdAt)}</span>
        </div>
      </Card>
    </Link>
  );
}
