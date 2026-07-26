/**
 * engine.ts — de schakel tussen lokale berekeningen en de .NET-backend.
 *
 * Achter de feature-flag (VITE_API_BASE_URL gezet én VITE_BACKEND_LOGIC niet
 * "off") rekent de server alle domeincijfers uit via POST /api/derive.
 * SyncContext "primet" hier de bundel per statusdocument; de functies in
 * calc.ts kijken eerst in deze cache en vallen anders terug op hun eigen
 * lokale berekening. Staat de flag uit (geen backend uitgerold), dan is dit
 * bestand volledig inert en werkt de app exact zoals voorheen.
 *
 * De vorm van DerivedBundle is 1-op-1 gelijk aan backend/Domain/DerivedModels.cs.
 */

import type { FinancialState } from "./types";
import type {
  AmortizationRow,
  AllocationSlice,
  Box3Result,
  CategoryRow,
  DashboardData,
  FinancialHealth,
  ForecastYearRow,
  MonthColumn,
  MortgageSummary,
  MortgageYearRow,
  NetWorthDerived,
  PortfolioData,
  SavingsGoalsData,
} from "./calc";

export interface DerivedBundle {
  dashboard: DashboardData;
  health: FinancialHealth;
  monthColumns: MonthColumn[];
  fixedByCategory: CategoryRow[];
  portfolio: PortfolioData;
  allocation: AllocationSlice[];
  netWorth: NetWorthDerived;
  savingsGoals: SavingsGoalsData;
  forecast: ForecastYearRow[];
  forecastDefaults: { startValue: number; monthlyContribution: number };
  mortgage: { summary: MortgageSummary; perYear: MortgageYearRow[]; schedule: AmortizationRow[] };
  box3: { single: Box3Result; partners: Box3Result };
  totals: {
    incomePerMonth: number;
    fixedPerMonth: number;
    investingPerMonth: number;
    variablePerMonth: number;
    savingsRoomPerMonth: number;
    savingsRate: number;
    setAsidePerYear: number;
    debtTotal: number;
    debtExclMortgage: number;
    debtPaymentPerMonth: number;
  };
  fire: { requiredAssets: number; months: number | null; progress: number };
}

// De flag wordt door api/client.ts gezet bij het opstarten van de app.
// Los van import.meta.env, zodat pure-functietests (tsx) calc.ts kunnen
// importeren zonder Vite-runtime; daar blijft de engine gewoon uit.
let serverLogicEnabled = false;

export function setServerLogicEnabled(on: boolean): void {
  serverLogicEnabled = on;
}

// Bundels per statusdocument, op objectidentiteit. Elke bewerking maakt een
// nieuw statusobject → een oude bundel kan nooit bij nieuwe invoer horen.
const cache = new WeakMap<object, DerivedBundle>();

/**
 * Registreer een van de server ontvangen bundel voor dit statusdocument.
 * Ook de deelobjecten (mortgage/forecast/debts) verwijzen naar de bundel,
 * omdat calc-functies zoals mortgageSummary(s.mortgage) alleen dat deel zien.
 */
export function primeDerived(state: FinancialState, bundle: DerivedBundle): void {
  cache.set(state, bundle);
  cache.set(state.mortgage, bundle);
  cache.set(state.forecast, bundle);
  cache.set(state.debts, bundle);
}

/** Serverbundel voor deze sleutel, of null → de aanroeper rekent lokaal. */
export function serverBundle(key: unknown): DerivedBundle | null {
  if (!serverLogicEnabled || key === null || typeof key !== "object") return null;
  return cache.get(key as object) ?? null;
}
