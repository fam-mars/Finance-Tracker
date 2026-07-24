/**
 * SyncContext — the one place session state lives.
 *
 * Model: load once → edit an in-memory draft → "Opslaan" PUTs the whole
 * document. No local persistence, no partial patches. A 409 conflict
 * re-fetches and asks the user to redo their change on fresh data (rare in a
 * two-person household; correctness beats cleverness).
 */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import type { ReactNode } from "react";
import type { FinancialState } from "../domain/types";
import { ConflictError, fetchState, saveState } from "../api/client";

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
      setDirty(false);
      setStatus("ready");
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Onbekende fout");
      setStatus("error");
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
      setDirty(false);
      setStatus("ready");
    } catch (e) {
      if (e instanceof ConflictError) {
        setStatus("conflict");
        setErrorMessage(
          "Iemand anders heeft intussen opgeslagen. Herlaad om de nieuwste versie te zien; voer je wijziging daarna opnieuw in.",
        );
      } else {
        setStatus("error");
        setErrorMessage(e instanceof Error ? e.message : "Opslaan mislukt");
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
