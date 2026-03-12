'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, type MeetingSummaryData } from '@/lib/api';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { speakerColor } from '@/lib/utils';

function formatTs(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN');
}

export default function SummaryPage() {
  const params = useParams();
  const meetingId = params.id as string;

  const [data, setData] = useState<MeetingSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [isDialogueOpen, setIsDialogueOpen] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);

  // 轮询摘要（主龙虾可能还在生成中）
  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    async function fetchData() {
      try {
        setIsLoading(true);
        const result = await api.meetings.getSummary(meetingId);
        if (cancelled) return;
        setData(result);

        // 如果主龙虾还没生成摘要，5秒后再查一次
        if (!result.summary && !cancelled) {
          pollTimer = setTimeout(fetchData, 5000);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载失败');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchData();

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [meetingId]);

  const handleCopy = useCallback(async () => {
    if (!data) return;

    const lines: string[] = [
      `# ${data.title}`,
      data.description ? `${data.description}\n` : '',
    ];

    if (data.summary) {
      lines.push('## 会议摘要');
      lines.push(data.summary.summary);
      lines.push('');

      if (data.summary.keyDecisions.length > 0) {
        lines.push('## 关键决策');
        data.summary.keyDecisions.forEach((d) => lines.push(`- ${d}`));
        lines.push('');
      }

      if (data.summary.actionItems.length > 0) {
        lines.push('## 行动项');
        data.summary.actionItems.forEach((a) => lines.push(`- ${a}`));
        lines.push('');
      }
    }

    if (data.dialogues.length > 0) {
      lines.push('## 龙虾讨论记录');
      data.dialogues.forEach((d) => {
        const target = d.toLobsterId ? ` → ${d.toLobsterId}` : '';
        lines.push(`[${formatTs(d.timestamp)}] ${d.fromLobsterId}${target}: ${d.content}`);
      });
      lines.push('');
    }

    if (data.transcript.length > 0) {
      lines.push('## 会议转录');
      data.transcript.forEach((seg) => {
        const name = seg.speakerName ?? seg.speakerId;
        lines.push(`[${formatTs(seg.timestamp)}] ${name}: ${seg.text}`);
      });
    }

    const fullText = lines.filter(Boolean).join('\n');

    try {
      await navigator.clipboard.writeText(fullText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = fullText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-3 animate-pulse-soft text-3xl">&#x1F99E;</div>
          <span className="text-text-muted">加载会议摘要...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-4xl">&#x1F99E;</div>
          <p className="text-sm text-red-400">{error}</p>
          <Link href="/lobby" className="mt-4 inline-block text-sm text-lobster hover:underline">
            返回大厅
          </Link>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const durationMin = data.startedAt && data.endedAt
    ? Math.round((data.endedAt - data.startedAt) / 60_000)
    : null;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 print:px-0 print:py-4">
      {/* Header */}
      <div className="mb-8">
        <Link href="/lobby" className="text-sm text-text-muted hover:text-text-secondary print:hidden">
          &larr; 返回会议列表
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-text-primary">
          {data.title}
        </h1>
        {data.description && (
          <p className="mt-1 text-sm text-text-secondary">{data.description}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-text-muted">
          <Badge variant="lobster">会议摘要</Badge>
          {data.startedAt && <span>开始: {formatDateTime(data.startedAt)}</span>}
          {data.endedAt && <span>结束: {formatDateTime(data.endedAt)}</span>}
          {durationMin !== null && <span>时长: {durationMin} 分钟</span>}
        </div>

        {/* 参与者 */}
        <div className="mt-3 flex flex-wrap gap-2">
          {data.participants.map((p) => (
            <span key={p.userId} className="rounded-full bg-surface-700 px-2 py-0.5 text-xs text-text-secondary">
              {p.displayName}
            </span>
          ))}
          {data.lobsters.map((l) => (
            <span key={l.lobsterId} className="rounded-full bg-lobster-muted/30 px-2 py-0.5 text-xs text-lobster">
              &#x1F99E; {l.skillName}
            </span>
          ))}
        </div>

        {/* 导出 */}
        <div className="mt-4 flex items-center gap-2 print:hidden">
          <Button variant="secondary" size="sm" onClick={handleCopy}>
            {copySuccess ? '已复制!' : '复制到剪贴板'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => window.print()}>
            打印
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* 主龙虾生成的摘要 */}
        {data.summary ? (
          <>
            <Card className="border-lobster/20">
              <CardHeader>
                <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
                  <span>&#x1F99E;</span> 会议摘要
                </h2>
                <p className="mt-0.5 text-xs text-text-muted">
                  由主龙虾 {data.summary.fromLobsterId} 生成
                </p>
              </CardHeader>
              <CardBody>
                <p className="text-sm leading-relaxed text-text-secondary whitespace-pre-wrap">
                  {data.summary.summary}
                </p>
              </CardBody>
            </Card>

            {/* 关键决策 */}
            {data.summary.keyDecisions.length > 0 && (
              <Card>
                <CardHeader>
                  <h2 className="text-base font-semibold text-text-primary">关键决策</h2>
                </CardHeader>
                <CardBody>
                  <ul className="flex flex-col gap-2">
                    {data.summary.keyDecisions.map((decision, i) => (
                      <li key={i} className="flex items-start gap-2 rounded-lg border border-white/5 bg-surface-700/30 p-3">
                        <span className="mt-0.5 text-lobster">&#x2022;</span>
                        <p className="text-sm text-text-secondary">{decision}</p>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            )}

            {/* 行动项 */}
            {data.summary.actionItems.length > 0 && (
              <Card>
                <CardHeader>
                  <h2 className="text-base font-semibold text-text-primary">行动项</h2>
                </CardHeader>
                <CardBody>
                  <ul className="flex flex-col gap-2">
                    {data.summary.actionItems.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 rounded-lg border border-white/5 bg-surface-700/30 p-3">
                        <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded border border-white/20 text-[10px] text-text-muted">
                          &#x25A1;
                        </span>
                        <p className="text-sm text-text-secondary">{item}</p>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            )}
          </>
        ) : (
          <Card className="p-8 text-center border-lobster/20">
            <div className="mb-3 animate-pulse-soft text-3xl">&#x1F99E;</div>
            <p className="text-sm text-text-muted">
              等待主龙虾生成会议摘要...
            </p>
            <p className="mt-1 text-xs text-text-muted">
              主龙虾正在分析会议内容并生成摘要，请稍候。
            </p>
          </Card>
        )}

        {/* 龙虾讨论记录 */}
        {data.dialogues.length > 0 && (
          <Card>
            <button
              onClick={() => setIsDialogueOpen((prev) => !prev)}
              className="flex w-full items-center justify-between border-b border-white/5 px-5 py-4 text-left transition-colors hover:bg-surface-700/30"
            >
              <h2 className="text-base font-semibold text-text-primary">
                &#x1F99E; 龙虾讨论记录
                <span className="ml-2 text-xs font-normal text-text-muted">
                  ({data.dialogues.length} 条)
                </span>
              </h2>
              <svg
                className={`h-4 w-4 text-text-muted transition-transform duration-200 ${isDialogueOpen ? 'rotate-180' : ''}`}
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
            {isDialogueOpen && (
              <CardBody className="max-h-[600px] overflow-y-auto">
                <div className="flex flex-col gap-3">
                  {data.dialogues.map((d, i) => (
                    <div key={i} className="group">
                      <div className="flex items-baseline gap-2">
                        <span
                          className="text-xs font-semibold"
                          style={{ color: speakerColor(d.fromLobsterId) }}
                        >
                          &#x1F99E; {d.fromLobsterId}
                        </span>
                        {d.toLobsterId && (
                          <span className="text-[10px] text-text-muted">
                            &rarr; {d.toLobsterId}
                          </span>
                        )}
                        <span className="text-[10px] text-text-muted">
                          {formatTs(d.timestamp)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm leading-relaxed text-text-secondary">
                        {d.content}
                      </p>
                    </div>
                  ))}
                </div>
              </CardBody>
            )}
          </Card>
        )}

        {/* 会议转录 */}
        {data.transcript.length > 0 && (
          <Card>
            <button
              onClick={() => setIsTranscriptOpen((prev) => !prev)}
              className="flex w-full items-center justify-between border-b border-white/5 px-5 py-4 text-left transition-colors hover:bg-surface-700/30"
            >
              <h2 className="text-base font-semibold text-text-primary">
                会议转录
                <span className="ml-2 text-xs font-normal text-text-muted">
                  ({data.transcript.length} 段)
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
                  {data.transcript.map((seg, i) => (
                    <div key={i} className="group">
                      <div className="flex items-baseline gap-2">
                        <span
                          className="text-xs font-semibold"
                          style={{ color: speakerColor(seg.speakerId) }}
                        >
                          {seg.speakerName ?? seg.speakerId}
                        </span>
                        <span className="text-[10px] text-text-muted">
                          {formatTs(seg.timestamp)}
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

      {/* 返回 */}
      <div className="mt-8 text-center print:hidden">
        <Link href="/lobby">
          <Button variant="secondary">返回大厅</Button>
        </Link>
      </div>
    </main>
  );
}
