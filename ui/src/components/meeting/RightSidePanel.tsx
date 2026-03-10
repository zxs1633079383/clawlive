'use client';

import type { RefObject } from 'react';
import type { TranscriptSegment, LobsterMessage, LobsterDialogueTurn } from '@clawlive/shared';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { TranscriptPanel } from './TranscriptPanel';
import { LobsterPanel } from './LobsterPanel';
import { LobsterDialoguePanel } from './LobsterDialoguePanel';

interface RightSidePanelProps {
  segments: TranscriptSegment[];
  scrollRef: RefObject<HTMLDivElement | null>;
  suggestions: LobsterMessage[];
  dialogues: LobsterDialogueTurn[];
  onSendPrompt: (text: string) => void;
}

export function RightSidePanel({
  segments,
  scrollRef,
  suggestions,
  dialogues,
  onSendPrompt,
}: RightSidePanelProps) {
  return (
    <Tabs defaultValue="transcript" className="flex h-full flex-col">
      <TabsList>
        <TabsTrigger value="transcript">
          Transcript
          {segments.length > 0 && (
            <span className="ml-1.5 rounded-full bg-surface-600 px-1.5 py-0.5 text-[10px]">
              {segments.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="lobster">
          Lobster
          {suggestions.length > 0 && (
            <span className="ml-1.5 rounded-full bg-lobster-muted px-1.5 py-0.5 text-[10px] text-lobster">
              {suggestions.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="dialogue">
          Dialogue
          {dialogues.length > 0 && (
            <span className="ml-1.5 rounded-full bg-surface-600 px-1.5 py-0.5 text-[10px]">
              {dialogues.length}
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="transcript" className="flex flex-1 flex-col overflow-hidden">
        <TranscriptPanel segments={segments} scrollRef={scrollRef} />
      </TabsContent>

      <TabsContent value="lobster" className="flex flex-1 flex-col overflow-hidden">
        <LobsterPanel suggestions={suggestions} onSendPrompt={onSendPrompt} />
      </TabsContent>

      <TabsContent value="dialogue" className="flex flex-1 flex-col overflow-hidden">
        <LobsterDialoguePanel dialogues={dialogues} />
      </TabsContent>
    </Tabs>
  );
}
