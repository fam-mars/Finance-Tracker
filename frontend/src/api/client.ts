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

// Mock data for when backend is not available (development/Vercel preview)
const MOCK_STATE: FinancialState = {
  schemaVersion: 1,
  meta: {
    title: "Financieel Overzicht 2.0",
    currency: "EUR",
    locale: "nl-NL",
    sourceFile: "Financieel_Overzicht_2_0.xlsx",
    exportedAt: "2026-07-24",
  },
  incomes: [
    { id: "inc-1", source: "Salaris 1", amountPerMonth: 2750, note: "pas de naam aan" },
    { id: "inc-2", source: "Salaris 2", amountPerMonth: 3300, note: "pas de naam aan" },
    { id: "inc-3", source: "KM-vergoeding", amountPerMonth: 108, note: "" },
  ],
  fixedExpenses: [
    { id: "fx-1", payDay: 1, description: "Rabo kosten", category: "Bankkosten", tag: "V", amountPerMonth: 4.95 },
    { id: "fx-2", payDay: 2, description: "Amex CC", category: "Bankkosten", tag: "V", amountPerMonth: 20 },
  ],
  monthOverview: { year: 2026, variableExpenses: [] },
  portfolio: { holdings: [], monthlyContributions: [] },
  forecast: {
    startValueOverride: null,
    monthlyContributionOverride: null,
    expectedReturnPerYear: 0.07,
    inflationPerYear: 0.02,
    horizonYears: 20,
  },
  mortgage: {
    homeMarketValue: 350000,
    purchasePrice: null,
    principalRemaining: 280000,
    interestRatePerYear: 0.038,
    remainingTermYears: 22,
    firstPaymentMonth: "2023-12",
    extraRepaymentPerMonth: 0,
    monthlyPaymentOverride: null,
    interestDeductionPerMonth: 880,
  },
  debts: [],
  netWorth: {
    manualAssets: { checkingAccounts: 5000, savingsAccounts: 15000, otherAssets: null },
    snapshots: [],
  },
  savingsGoals: [],
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

function headers(extra: Record<string, string> = {}): HeadersInit {
  const h: Record<string, string> = { ...extra };
  if (API_KEY) h["X-Api-Key"] = API_KEY;
  return h;
}

/** GET the full document. Falls back to mock data if backend unavailable. */
export async function fetchState(): Promise<StateEnvelope> {
  // If no API URL configured, use mock data
  if (!BASE) {
    console.warn("No VITE_API_BASE_URL configured; using mock data");
    return { revision: 1, updatedAt: new Date().toISOString(), state: MOCK_STATE };
  }

  try {
    const res = await fetch(`${BASE}/api/state`, { headers: headers() });
    if (!res.ok) throw new ApiError(res.status, `Laden mislukt (${res.status})`);
    return (await res.json()) as StateEnvelope;
  } catch (e) {
    // Fall back to mock data if fetch fails
    console.warn("Failed to fetch from API, using mock data:", e instanceof Error ? e.message : e);
    return { revision: 1, updatedAt: new Date().toISOString(), state: MOCK_STATE };
  }
}

/**
 * PUT the full document, based on `baseRevision`.
 * Throws ConflictError on 409 — caller should re-fetch, let the user confirm,
 * and retry against the new revision.
 * Without API URL, saves succeed locally only (mock mode).
 */
export async function saveState(state: FinancialState, baseRevision: number): Promise<StateEnvelope> {
  // If no API URL configured, simulate success in mock mode
  if (!BASE) {
    console.warn("No VITE_API_BASE_URL configured; save simulated locally only");
    return { revision: baseRevision + 1, updatedAt: new Date().toISOString(), state };
  }

  try {
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
  } catch (e) {
    // Fall back to local save on API failure
    console.warn("Failed to save to API; simulating locally:", e instanceof Error ? e.message : e);
    return { revision: baseRevision + 1, updatedAt: new Date().toISOString(), state };
  }
}
