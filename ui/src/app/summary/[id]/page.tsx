'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, type MeetingSummary } from '@/lib/api';
import type { Meeting, TranscriptSegment } from '@clawlive/shared';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatTime } from '@/lib/utils';

export default function SummaryPage() {
  const params = useParams();
  const meetingId = params.id as string;

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const [meetingData, summaryData, transcriptData] = await Promise.all([
          api.meetings.get(meetingId),
          api.meetings.getSummary(meetingId).catch(() => null),
          api.meetings.getTranscript(meetingId).catch(() => []),
        ]);
        setMeeting(meetingData);
        setSummary(summaryData);
        setTranscript(transcriptData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load summary');
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [meetingId]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="animate-pulse-soft text-text-muted">
          Loading summary...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-4xl">🦞</div>
          <p className="text-sm text-red-400">{error}</p>
          <Link href="/lobby" className="mt-4 inline-block text-sm text-lobster hover:underline">
            Back to lobby
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      {/* Header */}
      <div className="mb-8">
        <Link href="/lobby" className="text-sm text-text-muted hover:text-text-secondary">
          &larr; Back to meetings
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-text-primary">
          {meeting?.title ?? 'Meeting Summary'}
        </h1>
        {meeting?.description && (
          <p className="mt-1 text-sm text-text-secondary">
            {meeting.description}
          </p>
        )}
        <div className="mt-3 flex items-center gap-3 text-xs text-text-muted">
          <Badge variant="lobster">Summary</Badge>
          {meeting?.startedAt && (
            <span>Started: {new Date(meeting.startedAt).toLocaleString()}</span>
          )}
          {meeting?.endedAt && (
            <span>Ended: {new Date(meeting.endedAt).toLocaleString()}</span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* AI Summary */}
        {summary && (
          <Card>
            <CardHeader>
              <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
                <span>🦞</span> AI Summary
              </h2>
            </CardHeader>
            <CardBody>
              <p className="text-sm leading-relaxed text-text-secondary">
                {summary.summary}
              </p>

              {summary.keyDecisions.length > 0 && (
                <div className="mt-5">
                  <h3 className="text-sm font-semibold text-text-primary">
                    Key Decisions
                  </h3>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {summary.keyDecisions.map((decision, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-text-secondary"
                      >
                        <span className="mt-0.5 text-lobster">&#x2022;</span>
                        {decision}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {summary.actionItems.length > 0 && (
                <div className="mt-5">
                  <h3 className="text-sm font-semibold text-text-primary">
                    Action Items
                  </h3>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {summary.actionItems.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-text-secondary"
                      >
                        <span className="mt-0.5 text-lobster">&#x25A1;</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardBody>
          </Card>
        )}

        {/* No summary yet */}
        {!summary && (
          <Card className="p-8 text-center">
            <div className="mb-3 text-3xl">🦞</div>
            <p className="text-sm text-text-muted">
              Summary is being generated...
            </p>
          </Card>
        )}

        {/* Full Transcript */}
        {transcript.length > 0 && (
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-text-primary">
                Full Transcript
              </h2>
            </CardHeader>
            <CardBody className="max-h-96 overflow-y-auto">
              <div className="flex flex-col gap-2.5">
                {transcript.map((seg) => (
                  <div key={seg.id}>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-blue-400">
                        {seg.speakerName}
                      </span>
                      <span className="text-[10px] text-text-muted">
                        {formatTime(seg.timestamp)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm leading-relaxed text-text-secondary">
                      {seg.text}
                    </p>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}
      </div>

      {/* Back button */}
      <div className="mt-8 text-center">
        <Link href="/lobby">
          <Button variant="secondary">Back to Lobby</Button>
        </Link>
      </div>
    </main>
  );
}
