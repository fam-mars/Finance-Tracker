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

// Complete mock data extracted from Financieel_Overzicht_2.0.xlsx
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
    { id: "inc-1", source: "Salaris 1", amountPerMonth: 2750, note: "" },
    { id: "inc-2", source: "Salaris 2", amountPerMonth: 3300, note: "" },
  ],
  fixedExpenses: [
    { id: "fx-1", payDay: 2, description: "Amex CC", category: "Bankkosten", tag: "V", amountPerMonth: 20 },
    { id: "fx-2", payDay: 4, description: "PB", category: "Persoonlijk", tag: "V", amountPerMonth: 400 },
    { id: "fx-3", payDay: 5, description: "Boodschappen", category: "Boodschappen", tag: "V", amountPerMonth: 500 },
    { id: "fx-4", payDay: 7, description: "Centraal Beheer Overlijdensverzekering", category: "Verzekeringen", tag: null, amountPerMonth: 21.47 },
    { id: "fx-5", payDay: 10, description: "Odido Mobiel 1", category: "Telecom", tag: "V THIJS", amountPerMonth: 56.5 },
    { id: "fx-6", payDay: 11, description: "Rheinland inkomensverzekering", category: "Verzekeringen", tag: null, amountPerMonth: 30.42 },
    { id: "fx-7", payDay: 12, description: "Analyn schoon", category: "Huishouden", tag: null, amountPerMonth: 120 },
    { id: "fx-8", payDay: 13, description: "Bookbeat", category: "Abonnementen", tag: null, amountPerMonth: 10.98 },
    { id: "fx-9", payDay: 14, description: "Odido Mobiel 2", category: "Telecom", tag: null, amountPerMonth: 56.5 },
    { id: "fx-10", payDay: 15, description: "CZ Zorgverzekering", category: "Verzekeringen", tag: null, amountPerMonth: 140.5 },
    { id: "fx-11", payDay: 25, description: "DUO studieschuld", category: "Aflossingen", tag: "V THIJS", amountPerMonth: 218.56 },
    { id: "fx-12", payDay: 27, description: "Vitens", category: "Nutsvoorzieningen", tag: "V", amountPerMonth: 21 },
    { id: "fx-13", payDay: 28, description: "Odido Internet", category: "Telecom", tag: "V", amountPerMonth: 42.87 },
    { id: "fx-14", payDay: 29, description: "ASR Hypotheek", category: "Wonen", tag: null, amountPerMonth: 2327.42 },
    { id: "fx-15", payDay: 30, description: "Allianz Inboedel", category: "Verzekeringen", tag: "V", amountPerMonth: 38.52 },
  ],
  monthOverview: {
    year: 2026,
    variableExpenses: [
      { id: "var-1", category: "Restaurant", budgetPerMonth: 150, actuals: { jan: 120, feb: 95, mrt: 150 } },
      { id: "var-2", category: "Boodschappen extra", budgetPerMonth: 100, actuals: { jan: 50, feb: 60 } },
      { id: "var-3", category: "Entertainment", budgetPerMonth: 75, actuals: { jan: 40 } },
    ],
  },
  portfolio: {
    holdings: [
      { id: "hold-1", platform: "Bitvavo", name: "Bitcoin", ticker: "BTC", quantity: 0.035, avgBuyPrice: 85000, currentPrice: 92500 },
      { id: "hold-2", platform: "Bitvavo", name: "Ethereum", ticker: "ETH", quantity: 1.5, avgBuyPrice: 2800, currentPrice: 3200 },
      { id: "hold-3", platform: "Degiro", name: "Vanguard S&P 500 UCITS ETF", ticker: "VUSA", quantity: 40, avgBuyPrice: 95, currentPrice: 98 },
      { id: "hold-4", platform: "Degiro", name: "iShares Core MSCI World", ticker: "EUNL", quantity: 40, avgBuyPrice: 102, currentPrice: 105 },
    ],
    monthlyContributions: [
      { id: "contrib-1", target: "Bitvavo — Bitcoin", amountPerMonth: 250, note: null },
      { id: "contrib-2", target: "Bitvavo — Ethereum", amountPerMonth: 250, note: null },
      { id: "contrib-3", target: "Degiro — ETF's, S&P 500 & trackers", amountPerMonth: 500, note: null },
    ],
  },
  forecast: {
    startValueOverride: null,
    monthlyContributionOverride: null,
    expectedReturnPerYear: 0.07,
    inflationPerYear: 0.02,
    horizonYears: 20,
  },
  mortgage: {
    homeMarketValue: 525000,
    purchasePrice: 470000,
    principalRemaining: 455000,
    interestRatePerYear: 0.042,
    remainingTermYears: 29,
    firstPaymentMonth: "2026-08",
    extraRepaymentPerMonth: 0,
    monthlyPaymentOverride: null,
    interestDeductionPerMonth: 880,
  },
  debts: [
    {
      id: "debt-1",
      description: "Hypotheek woning",
      lender: "ASR",
      owner: "Samen",
      principalRemaining: 455000,
      interestRatePerYear: 0.042,
      monthlyPayment: 2327.42,
      remainingTermMonths: null,
      linkedToMortgage: true,
      note: null,
    },
    {
      id: "debt-2",
      description: "Studieschuld DUO",
      lender: "DUO",
      owner: "Thijs",
      principalRemaining: 64000,
      interestRatePerYear: 0.0256,
      monthlyPayment: 218.56,
      remainingTermMonths: null,
      linkedToMortgage: false,
      note: null,
    },
  ],
  netWorth: {
    manualAssets: { checkingAccounts: 4000, savingsAccounts: 3500, otherAssets: null },
    snapshots: [],
  },
  savingsGoals: [
    {
      id: "goal-1",
      name: "Noodfonds",
      targetAmount: null, // Derived: 6x monthly fixed costs
      savedSoFar: 5000,
      contributionPerMonth: 500,
      isEmergencyFund: true,
    },
    {
      id: "goal-2",
      name: "Vakantie",
      targetAmount: 3000,
      savedSoFar: 1200,
      contributionPerMonth: 200,
      isEmergencyFund: false,
    },
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
 * Throws LocalStorageFallbackError when backend unavailable — caller should use localStorage.
 */
export async function saveState(state: FinancialState, baseRevision: number): Promise<StateEnvelope> {
  // If no API URL configured, throw so caller can use localStorage
  if (!BASE) {
    console.warn("No VITE_API_BASE_URL configured; backend unavailable");
    throw new LocalStorageFallbackError("Backend niet beschikbaar");
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
    if (e instanceof ConflictError || e instanceof LocalStorageFallbackError) throw e;
    console.warn("Failed to save to API:", e instanceof Error ? e.message : e);
    throw new LocalStorageFallbackError("Backend onbereikbaar; wijzigingen opgeslagen lokaal");
  }
}
