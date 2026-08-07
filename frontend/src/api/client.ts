/**
 * API client — full-document sync only.
 *
 * The frontend is stateless: it holds the document in memory for the session,
 * never persists locally, and syncs by GETting/PUTting the whole document.
 * Optimistic concurrency via the revision number in ETag / If-Match.
 */

import type { FinancialState, StateEnvelope } from "../domain/types";
import type { DerivedBundle } from "../domain/engine";
import { setServerLogicEnabled } from "../domain/engine";

const BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const API_KEY = import.meta.env.VITE_API_KEY ?? "";

/** Is er een backend geconfigureerd? Zo niet, dan is localStorage de bron van waarheid. */
export const HAS_BACKEND = BASE.length > 0;

/**
 * Feature-flag: domeinlogica op de server. Staat aan zodra er een backend
 * geconfigureerd is; met VITE_BACKEND_LOGIC=off forceer je lokale berekeningen
 * (bijv. om de VPS te ontzien of een regressie te omzeilen). Zonder backend
 * (de huidige situatie tot de VPS er is) verandert er helemaal niets: de app
 * rekent en bewaart lokaal, precies zoals nu.
 */
export const USE_BACKEND_LOGIC = HAS_BACKEND && import.meta.env.VITE_BACKEND_LOGIC !== "off";
setServerLogicEnabled(USE_BACKEND_LOGIC);

/**
 * Lege startstaat — de app bevat geen echte huishoudcijfers meer. Een verse
 * browser begint blanco, met alleen een noodfonds-doel klaargezet (doel wordt
 * automatisch 6× de vaste lasten). Eigen cijfers komen binnen via de Gids,
 * een backup-import of straks de backend op de VPS. De enige voorgevulde
 * dataset is de fictieve demo in domain/demoData.ts (Demo-modus).
 */
export const EMPTY_STATE: FinancialState = {
  schemaVersion: 1,
  meta: {
    title: "Financieel Overzicht",
    currency: "EUR",
    locale: "nl-NL",
    sourceFile: null,
    exportedAt: null,
  },
  incomes: [],
  fixedExpenses: [],
  monthOverview: { year: new Date().getFullYear(), variableExpenses: [] },
  portfolio: { holdings: [], monthlyContributions: [] },
  forecast: {
    startValueOverride: null,
    monthlyContributionOverride: null,
    expectedReturnPerYear: 0.07,
    inflationPerYear: 0.02,
    horizonYears: 20,
  },
  mortgage: {
    homeMarketValue: 0,
    purchasePrice: null,
    principalRemaining: 0,
    interestRatePerYear: 0,
    remainingTermYears: 0,
    firstPaymentMonth: "",
    extraRepaymentPerMonth: 0,
    monthlyPaymentOverride: null,
    interestDeductionPerMonth: 0,
  },
  debts: [],
  netWorth: {
    manualAssets: { checkingAccounts: null, savingsAccounts: null, otherAssets: null },
    snapshots: [],
  },
  savingsGoals: [
    { id: "goal-noodfonds", name: "Noodfonds", targetAmount: null, savedSoFar: null, contributionPerMonth: null, isEmergencyFund: true },
  ],
  mutualLoans: [],
};

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

export class LocalStorageFallbackError extends Error {
  constructor(message: string) {
    super(message);
  }
}

function headers(extra: Record<string, string> = {}): HeadersInit {
  const h: Record<string, string> = { ...extra };
  if (API_KEY) h["X-Api-Key"] = API_KEY;
  return h;
}

/**
 * GET the full document from the backend. Throws when no backend is
 * configured or the fetch fails — the caller (SyncContext) decides the
 * fallback. Cruciaal: hier NOOIT stilletjes mockdata teruggeven, anders
 * overschrijft elke page-load de lokaal opgeslagen gegevens.
 */
export async function fetchState(): Promise<StateEnvelope> {
  if (!BASE) throw new LocalStorageFallbackError("Geen backend geconfigureerd");
  const res = await fetch(`${BASE}/api/state`, { headers: headers() });
  if (!res.ok) throw new ApiError(res.status, `Laden mislukt (${res.status})`);
  return (await res.json()) as StateEnvelope;
}

/**
 * PUT the full document, based on `baseRevision`.
 * Throws ConflictError on 409 — caller should re-fetch, let the user confirm,
 * and retry against the new revision.
 * Throws LocalStorageFallbackError when backend unavailable — caller should use localStorage.
 */
export async function saveState(state: FinancialState, baseRevision: number): Promise<StateEnvelope> {
  // If no API URL configured, throw so caller can use localStorage
  if (!BASE) {
    console.log("❌ No VITE_API_BASE_URL configured; using localStorage only");
    throw new LocalStorageFallbackError("Backend niet beschikbaar");
  }

  try {
    console.log("📤 Saving to backend:", BASE + "/api/state", "revision:", baseRevision);
    const res = await fetch(`${BASE}/api/state`, {
      method: "PUT",
      headers: headers({
        "Content-Type": "application/json",
        "If-Match": `"${baseRevision}"`,
      }),
      body: JSON.stringify(state),
    });
    console.log("📥 Backend response:", res.status);

    if (res.status === 409) {
      const body = (await res.json().catch(() => null)) as { currentRevision?: number } | null;
      throw new ConflictError(body?.currentRevision ?? -1);
    }
    if (res.status === 422) {
      const body = (await res.json().catch(() => null)) as { problems?: string[] } | null;
      throw new ApiError(422, `Validatie mislukt: ${(body?.problems ?? []).join("; ")}`);
    }
    if (!res.ok) throw new ApiError(res.status, `Opslaan mislukt (${res.status})`);

    console.log("✅ Successfully saved to backend");
    return (await res.json()) as StateEnvelope;
  } catch (e) {
    if (e instanceof ConflictError || e instanceof LocalStorageFallbackError) throw e;
    console.error("❌ Failed to save to API:", e instanceof Error ? e.message : e);
    throw new LocalStorageFallbackError("Backend onbereikbaar; wijzigingen opgeslagen lokaal");
  }
}

/**
 * POST /api/derive — laat de server alle afgeleide cijfers uitrekenen voor
 * dit statusdocument. Stateless: het document gaat in de body mee, dus dit
 * werkt ook zolang localStorage nog de bron van waarheid is. De aanroeper
 * (SyncContext) valt bij elke fout stil terug op lokale berekeningen.
 */
export async function deriveState(state: FinancialState, signal?: AbortSignal): Promise<DerivedBundle> {
  if (!BASE) throw new LocalStorageFallbackError("Geen backend geconfigureerd");
  const res = await fetch(`${BASE}/api/derive`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(state),
    signal,
  });
  if (!res.ok) throw new ApiError(res.status, `Berekenen op server mislukt (${res.status})`);
  return (await res.json()) as DerivedBundle;
}
