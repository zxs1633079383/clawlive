'use client';

import { useCallback, useState } from 'react';
import type { LobsterMessage, LobsterDialogueTurn } from '@clawlive/shared';

export function useLobster() {
  const [suggestions, setSuggestions] = useState<LobsterMessage[]>([]);
  const [dialogues, setDialogues] = useState<LobsterDialogueTurn[]>([]);

  const addSuggestion = useCallback((msg: LobsterMessage) => {
    setSuggestions((prev) => [...prev, msg]);
  }, []);

  const addDialogue = useCallback((turn: LobsterDialogueTurn) => {
    setDialogues((prev) => [...prev, turn]);
  }, []);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
  }, []);

  const clearDialogues = useCallback(() => {
    setDialogues([]);
  }, []);

  return {
    suggestions,
    dialogues,
    addSuggestion,
    addDialogue,
    clearSuggestions,
    clearDialogues,
  };
}
