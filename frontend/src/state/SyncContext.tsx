/**
 * SyncContext — the one place session state lives.
 *
 * Model: load once → edit an in-memory draft → "Opslaan" PUTs the whole
 * document. Falls back to localStorage when backend unavailable.
 */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import type { ReactNode } from "react";
import type { FinancialState } from "../domain/types";
import { ConflictError, fetchState, saveState } from "../api/client";

const STORAGE_KEY = "finance-tracker-state";

function getLocalState(): { state: FinancialState; revision: number } | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function saveLocalState(state: FinancialState, revision: number) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, revision }));
  } catch (e) {
    console.warn("Could not save to localStorage:", e);
  }
}

type Status = "loading" | "ready" | "saving" | "error" | "conflict";

interface SyncValue {
  status: Status;
  errorMessage: string | null;
  state: FinancialState | null;
  revision: number;
  dirty: boolean;
  /** Apply an immutable update to the draft. */
  update: (fn: (draft: FinancialState) => FinancialState) => void;
  /** Save the whole draft to the backend. */
  save: () => Promise<void>;
  /** Discard the draft and reload from the backend. */
  reload: () => Promise<void>;
}

const Ctx = createContext<SyncValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [state, setState] = useState<FinancialState | null>(null);
  const [dirty, setDirty] = useState(false);
  const revisionRef = useRef(0);

  const load = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(null);
    try {
      const envl = await fetchState();
      revisionRef.current = envl.revision;
      setState(envl.state);
      saveLocalState(envl.state, envl.revision);
      setDirty(false);
      setStatus("ready");
    } catch (e) {
      const localData = getLocalState();
      if (localData) {
        revisionRef.current = localData.revision;
        setState(localData.state);
        setErrorMessage("Backend niet bereikbaar. Gebruik locale opslag.");
        setStatus("ready");
      } else {
        setErrorMessage(e instanceof Error ? e.message : "Onbekende fout");
        setStatus("error");
      }
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const update = useCallback((fn: (draft: FinancialState) => FinancialState) => {
    setState((prev) => (prev ? fn(prev) : prev));
    setDirty(true);
  }, []);

  const save = useCallback(async () => {
    if (!state) return;
    setStatus("saving");
    setErrorMessage(null);
    try {
      const envl = await saveState(state, revisionRef.current);
      revisionRef.current = envl.revision;
      setState(envl.state);
      saveLocalState(envl.state, envl.revision);
      setDirty(false);
      setStatus("ready");
    } catch (e) {
      if (e instanceof ConflictError) {
        setStatus("conflict");
        setErrorMessage(
          "Iemand anders heeft intussen opgeslagen. Herlaad om de nieuwste versie te zien; voer je wijziging daarna opnieuw in.",
        );
      } else {
        saveLocalState(state, revisionRef.current);
        setDirty(false);
        setStatus("ready");
        setErrorMessage("Backend niet bereikbaar. Wijziging opgeslagen lokaal.");
      }
    }
  }, [state]);

  const value = useMemo<SyncValue>(() => ({
    status, errorMessage, state,
    revision: revisionRef.current,
    dirty, update, save, reload: load,
  }), [status, errorMessage, state, dirty, update, save, load]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSync(): SyncValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSync must be used inside <SyncProvider>");
  return v;
}
