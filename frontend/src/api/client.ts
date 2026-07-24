/**
 * API client — full-document sync only.
 *
 * The frontend is stateless: it holds the document in memory for the session,
 * never persists locally, and syncs by GETting/PUTting the whole document.
 * Optimistic concurrency via the revision number in ETag / If-Match.
 */

import type { FinancialState, StateEnvelope } from "../domain/types";

const BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const API_KEY = import.meta.env.VITE_API_KEY ?? "";

export class ConflictError extends Error {
  constructor(public currentRevision: number) {
    super("Sync conflict: state changed on the server");
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function headers(extra: Record<string, string> = {}): HeadersInit {
  const h: Record<string, string> = { ...extra };
  if (API_KEY) h["X-Api-Key"] = API_KEY;
  return h;
}

/** GET the full document. */
export async function fetchState(): Promise<StateEnvelope> {
  const res = await fetch(`${BASE}/api/state`, { headers: headers() });
  if (!res.ok) throw new ApiError(res.status, `Laden mislukt (${res.status})`);
  return (await res.json()) as StateEnvelope;
}

/**
 * PUT the full document, based on `baseRevision`.
 * Throws ConflictError on 409 — caller should re-fetch, let the user confirm,
 * and retry against the new revision.
 */
export async function saveState(state: FinancialState, baseRevision: number): Promise<StateEnvelope> {
  const res = await fetch(`${BASE}/api/state`, {
    method: "PUT",
    headers: headers({
      "Content-Type": "application/json",
      "If-Match": `"${baseRevision}"`,
    }),
    body: JSON.stringify(state),
  });
  if (res.status === 409) {
    const body = (await res.json().catch(() => null)) as { currentRevision?: number } | null;
    throw new ConflictError(body?.currentRevision ?? -1);
  }
  if (res.status === 422) {
    const body = (await res.json().catch(() => null)) as { problems?: string[] } | null;
    throw new ApiError(422, `Validatie mislukt: ${(body?.problems ?? []).join("; ")}`);
  }
  if (!res.ok) throw new ApiError(res.status, `Opslaan mislukt (${res.status})`);
  return (await res.json()) as StateEnvelope;
}
