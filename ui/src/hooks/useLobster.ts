'use client';

import { useCallback, useState } from 'react';
import type { LobsterDialogueTurn } from '@clawlive/shared';

/**
 * Hook for tracking lobster dialogue turns.
 * Humans are observers — they watch lobsters discuss among themselves.
 */
export function useLobster() {
  const [dialogues, setDialogues] = useState<LobsterDialogueTurn[]>([]);

  const addDialogue = useCallback((turn: LobsterDialogueTurn) => {
    setDialogues((prev) => [...prev, turn]);
  }, []);

  const clearDialogues = useCallback(() => {
    setDialogues([]);
  }, []);

  return {
    dialogues,
    addDialogue,
    clearDialogues,
  };
}
