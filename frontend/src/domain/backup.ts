/**
 * backup.ts — export/import van de volledige financiële staat als JSON.
 * Zonder backend leeft alles in localStorage; een backupbestand is de
 * verzekering tegen browserdata-verlies én de brug tussen apparaten.
 */

import type { FinancialState } from "./types";

export function serializeBackup(state: FinancialState): string {
  return JSON.stringify(
    { app: "financieel-overzicht", version: 1, exportedAt: new Date().toISOString(), state },
    null, 2,
  );
}

/** Accepteert zowel een backupbestand als een kale state-dump; null bij ongeldig. */
export function parseBackup(text: string): FinancialState | null {
  try {
    const obj = JSON.parse(text) as { state?: unknown } | FinancialState;
    const s = (obj && typeof obj === "object" && "state" in obj ? obj.state : obj) as FinancialState;
    if (s?.schemaVersion !== 1) return null;
    if (!Array.isArray(s.incomes) || !Array.isArray(s.fixedExpenses)
      || !Array.isArray(s.debts) || !Array.isArray(s.savingsGoals)) return null;
    if (!s.portfolio?.holdings || !s.monthOverview || !s.mortgage || !s.netWorth) return null;
    return s;
  } catch {
    return null;
  }
}
