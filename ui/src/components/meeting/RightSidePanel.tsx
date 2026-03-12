'use client';

import type { RefObject } from 'react';
import type { TranscriptSegment, LobsterDialogueTurn } from '@clawlive/shared';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { TranscriptPanel } from './TranscriptPanel';
import { LobsterDialoguePanel } from './LobsterDialoguePanel';

interface RightSidePanelProps {
  segments: TranscriptSegment[];
  scrollRef: RefObject<HTMLDivElement | null>;
  dialogues: LobsterDialogueTurn[];
  isDialogueThinking?: boolean;
}

export function RightSidePanel({
  segments,
  scrollRef,
  dialogues,
  isDialogueThinking = false,
}: RightSidePanelProps) {
  return (
    <Tabs defaultValue="dialogue" className="flex h-full flex-col">
      <TabsList>
        <TabsTrigger value="dialogue">
          Lobster Discussion
          {dialogues.length > 0 && (
            <span className="ml-1.5 rounded-full bg-lobster-muted px-1.5 py-0.5 text-[10px] text-lobster">
              {dialogues.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="transcript">
          Transcript
          {segments.length > 0 && (
            <span className="ml-1.5 rounded-full bg-surface-600 px-1.5 py-0.5 text-[10px]">
              {segments.length}
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="dialogue" className="flex flex-1 flex-col overflow-hidden">
        <LobsterDialoguePanel
          dialogues={dialogues}
          isThinking={isDialogueThinking}
        />
      </TabsContent>

      <TabsContent value="transcript" className="flex flex-1 flex-col overflow-hidden">
        <TranscriptPanel segments={segments} scrollRef={scrollRef} />
      </TabsContent>
    </Tabs>
  );
}
