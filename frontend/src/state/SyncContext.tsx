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
import { ConflictError, HAS_BACKEND, MOCK_STATE, fetchState, saveState } from "../api/client";

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
    const json = JSON.stringify({ state, revision });
    console.log("Saving to localStorage, size:", json.length, "bytes");
    localStorage.setItem(STORAGE_KEY, json);
    console.log("✅ Successfully saved to localStorage");
  } catch (e) {
    console.error("❌ Could not save to localStorage:", e instanceof Error ? e.message : e);
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

  /**
   * Bron van waarheid zonder backend: localStorage. Mockdata is alléén het
   * zaadje voor de allereerste run en mag opgeslagen gegevens nooit
   * overschrijven. Met backend: eerst backend, bij falen localStorage.
   */
  const load = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(null);
    const local = getLocalState();

    if (!HAS_BACKEND) {
      const seed = local ?? { state: MOCK_STATE, revision: 1 };
      revisionRef.current = seed.revision;
      setState(seed.state);
      if (!local) saveLocalState(seed.state, seed.revision);
      setDirty(false);
      setStatus("ready");
      return;
    }

    try {
      const envl = await fetchState();
      revisionRef.current = envl.revision;
      setState(envl.state);
      saveLocalState(envl.state, envl.revision);
      setDirty(false);
      setStatus("ready");
    } catch (e) {
      if (local) {
        revisionRef.current = local.revision;
        setState(local.state);
        setErrorMessage("Backend niet bereikbaar — je werkt met de lokaal opgeslagen versie.");
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

  // Autosave: elke wijziging gaat direct naar localStorage, zodat er ook
  // zonder druk op Opslaan nooit iets verloren gaat (tab dicht, crash, etc.).
  useEffect(() => {
    if (state && status !== "loading") saveLocalState(state, revisionRef.current);
  }, [state, status]);

  const save = useCallback(async () => {
    if (!state) return;

    // Zonder backend is opslaan een lokale bevestiging — direct klaar.
    if (!HAS_BACKEND) {
      saveLocalState(state, revisionRef.current);
      setDirty(false);
      setStatus("ready");
      setErrorMessage(null);
      return;
    }

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
        setErrorMessage("Backend niet bereikbaar — wijziging lokaal opgeslagen.");
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
