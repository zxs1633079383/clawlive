'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, type MeetingSummary } from '@/lib/api';
import type { Meeting, TranscriptSegment } from '@clawlive/shared';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatTime } from '@/lib/utils';

function getDecisionText(
  decision: string | { decision: string; timestamp: string; participants: string[] },
): { text: string; timestamp?: string; participants?: string[] } {
  if (typeof decision === 'string') {
    return { text: decision };
  }
  return {
    text: decision.decision,
    timestamp: decision.timestamp,
    participants: decision.participants,
  };
}

function getActionItemInfo(
  item: string | { action: string; assignee: string; deadline?: string; status: string },
): { text: string; assignee?: string; deadline?: string; status?: string } {
  if (typeof item === 'string') {
    return { text: item };
  }
  return {
    text: item.action,
    assignee: item.assignee,
    deadline: item.deadline,
    status: item.status,
  };
}

export default function SummaryPage() {
  const params = useParams();
  const meetingId = params.id as string;

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        // Get userId from session for personalized summary
        const userId = typeof window !== 'undefined'
          ? sessionStorage.getItem('clawlive-user-id') ?? ''
          : '';
        const [meetingData, summaryData, transcriptData] = await Promise.all([
          api.meetings.get(meetingId),
          api.meetings.getSummary(meetingId, userId).catch(() => null),
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

  const handleCopyToClipboard = useCallback(async () => {
    if (!summary || !meeting) return;

    const globalText = summary.globalSummary || summary.summary || '';
    const decisionsText = summary.keyDecisions
      .map((d) => {
        const info = getDecisionText(d);
        const parts = [info.text];
        if (info.participants && info.participants.length > 0) {
          parts.push(`(${info.participants.join(', ')})`);
        }
        return `  - ${parts.join(' ')}`;
      })
      .join('\n');

    const actionsText = summary.actionItems
      .map((a) => {
        const info = getActionItemInfo(a);
        const parts = [info.text];
        if (info.assignee) parts.push(`[${info.assignee}]`);
        if (info.deadline) parts.push(`due: ${info.deadline}`);
        return `  - ${parts.join(' ')}`;
      })
      .join('\n');

    const transcriptText = transcript
      .map((seg) => `[${formatTime(seg.timestamp)}] ${seg.speakerName}: ${seg.text}`)
      .join('\n');

    const fullText = [
      `# ${meeting.title}`,
      meeting.description ? `${meeting.description}\n` : '',
      '## Summary',
      globalText,
      '',
      summary.keyDecisions.length > 0 ? '## Key Decisions\n' + decisionsText : '',
      summary.actionItems.length > 0 ? '## Action Items\n' + actionsText : '',
      transcript.length > 0 ? '## Transcript\n' + transcriptText : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    try {
      await navigator.clipboard.writeText(fullText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // Fallback: select-all on a textarea
      const textarea = document.createElement('textarea');
      textarea.value = fullText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  }, [summary, meeting, transcript]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-3 animate-pulse-soft text-3xl">🦞</div>
          <span className="text-text-muted">Loading summary...</span>
        </div>
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

  const globalSummaryText = summary?.globalSummary || summary?.summary || '';
  const personalSummaryText = summary?.personalSummary;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 print:px-0 print:py-4">
      {/* Header */}
      <div className="mb-8">
        <Link href="/lobby" className="text-sm text-text-muted hover:text-text-secondary print:hidden">
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

        {/* Export options */}
        <div className="mt-4 flex items-center gap-2 print:hidden">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyToClipboard}
          >
            {copySuccess ? (
              <span className="flex items-center gap-1.5">
                <CheckIcon /> Copied!
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <CopyIcon /> Copy to clipboard
              </span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.print()}
          >
            Print
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Personalized Summary (from your lobster) */}
        {personalSummaryText && (
          <Card className="border-lobster/20">
            <CardHeader>
              <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
                <span>🦞</span> Your Personalized Summary
              </h2>
              <p className="mt-0.5 text-xs text-text-muted">
                Tailored by your lobster based on your participation
              </p>
            </CardHeader>
            <CardBody>
              <div className="rounded-lg border border-lobster/10 bg-lobster-muted/30 p-4">
                <p className="text-sm leading-relaxed text-text-secondary whitespace-pre-wrap">
                  {personalSummaryText}
                </p>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Global AI Summary */}
        {summary ? (
          <Card>
            <CardHeader>
              <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
                <span>🦞🦞</span> Global Summary
              </h2>
              <p className="mt-0.5 text-xs text-text-muted">
                Combined analysis from all lobsters
              </p>
            </CardHeader>
            <CardBody>
              <p className="text-sm leading-relaxed text-text-secondary whitespace-pre-wrap">
                {globalSummaryText}
              </p>
            </CardBody>
          </Card>
        ) : (
          <Card className="p-8 text-center">
            <div className="mb-3 text-3xl">🦞</div>
            <p className="text-sm text-text-muted">
              Summary is being generated...
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Your lobsters are collaborating to create a comprehensive summary.
            </p>
          </Card>
        )}

        {/* Key Decisions */}
        {summary && summary.keyDecisions.length > 0 && (
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-text-primary">
                Key Decisions
              </h2>
            </CardHeader>
            <CardBody>
              <ul className="flex flex-col gap-3">
                {summary.keyDecisions.map((decision, i) => {
                  const info = getDecisionText(decision);
                  return (
                    <li
                      key={i}
                      className="rounded-lg border border-white/5 bg-surface-700/30 p-3"
                    >
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 text-lobster">&#x2022;</span>
                        <div className="flex-1">
                          <p className="text-sm text-text-secondary">
                            {info.text}
                          </p>
                          <div className="mt-1.5 flex items-center gap-2">
                            {info.timestamp && (
                              <span className="text-[10px] text-text-muted">
                                {new Date(info.timestamp).toLocaleTimeString()}
                              </span>
                            )}
                            {info.participants && info.participants.length > 0 && (
                              <div className="flex items-center gap-1">
                                {info.participants.map((name) => (
                                  <span
                                    key={name}
                                    className="rounded-full bg-surface-600 px-1.5 py-0.5 text-[10px] text-text-muted"
                                  >
                                    {name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardBody>
          </Card>
        )}

        {/* Action Items */}
        {summary && summary.actionItems.length > 0 && (
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-text-primary">
                Action Items
              </h2>
            </CardHeader>
            <CardBody>
              <ul className="flex flex-col gap-2">
                {summary.actionItems.map((item, i) => {
                  const info = getActionItemInfo(item);
                  return (
                    <li
                      key={i}
                      className="flex items-start gap-3 rounded-lg border border-white/5 bg-surface-700/30 p-3"
                    >
                      <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded border border-white/20 text-[10px] text-text-muted">
                        &#x25A1;
                      </span>
                      <div className="flex-1">
                        <p className="text-sm text-text-secondary">
                          {info.text}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2">
                          {info.assignee && (
                            <Badge variant="default">
                              {info.assignee}
                            </Badge>
                          )}
                          {info.deadline && (
                            <span className="text-[10px] text-amber-400">
                              Due: {info.deadline}
                            </span>
                          )}
                          {info.status && (
                            <Badge
                              variant={info.status === 'pending' ? 'warning' : 'success'}
                            >
                              {info.status}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardBody>
          </Card>
        )}

        {/* Full Transcript Accordion */}
        {transcript.length > 0 && (
          <Card>
            <button
              onClick={() => setIsTranscriptOpen((prev) => !prev)}
              className="flex w-full items-center justify-between border-b border-white/5 px-5 py-4 text-left transition-colors hover:bg-surface-700/30"
            >
              <h2 className="text-base font-semibold text-text-primary">
                Full Transcript
                <span className="ml-2 text-xs font-normal text-text-muted">
                  ({transcript.length} segments)
                </span>
              </h2>
              <svg
                className={`h-4 w-4 text-text-muted transition-transform duration-200 ${isTranscriptOpen ? 'rotate-180' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {isTranscriptOpen && (
              <CardBody className="max-h-[500px] overflow-y-auto">
                <div className="flex flex-col gap-2.5">
                  {transcript.map((seg) => (
                    <div key={seg.id} className="group">
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
            )}
          </Card>
        )}
      </div>

      {/* Back button */}
      <div className="mt-8 text-center print:hidden">
        <Link href="/lobby">
          <Button variant="secondary">Back to Lobby</Button>
        </Link>
      </div>
    </main>
  );
}

function CopyIcon() {
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
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function CheckIcon() {
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
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
