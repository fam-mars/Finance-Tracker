/**
 * portfolioImport.ts — DeGiro "Portfolio.csv" import, client-side.
 *
 * DeGiro (webtrader → Portefeuille → Exporteren) levert een CSV met per
 * positie o.a. Product, Symbool/ISIN, Aantal, Slotkoers en Waarde in EUR.
 * Kolomnamen verschillen per taal/versie; we matchen ze soepel en vullen
 * ontbrekende koersen aan uit waarde ÷ aantal.
 */

import type { FinancialState } from "./types";

export interface PortfolioRow {
  name: string;
  ticker: string | null;
  quantity: number;
  currentPrice: number | null;
}

function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === sep) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

/** "1.234,56" → 1234.56 · "1,234.56" → 1234.56 · "12.34" → 12.34 */
function num(raw: string | undefined): number | null {
  const t = (raw ?? "").trim().replace(/[€\s]/g, "");
  if (!t) return null;
  let normalized: string;
  if (t.includes(",") && t.includes(".")) {
    normalized = t.lastIndexOf(",") > t.lastIndexOf(".")
      ? t.replace(/\./g, "").replace(",", ".")
      : t.replace(/,/g, "");
  } else if (t.includes(",")) {
    normalized = t.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = t;
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function parseDegiroPortfolio(text: string): PortfolioRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const sep = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const header = splitLine(lines[0], sep).map((h) => h.trim().toLowerCase());

  const iProduct = header.findIndex((h) => h.includes("product"));
  const iSymbol = header.findIndex((h) => h.includes("symbool") || h.includes("symbol") || h.includes("isin"));
  const iQty = header.findIndex((h) => h === "aantal" || h.includes("quantity") || h.includes("amount"));
  const iPrice = header.findIndex((h) => h.includes("slotkoers") || h.includes("closing") || h.includes("koers"));
  const iValue = header.findIndex((h) => h.includes("waarde in eur") || h.includes("value in eur") || h === "waarde" || h === "value");
  if (iProduct < 0 || iQty < 0) return [];

  const out: PortfolioRow[] = [];
  for (const line of lines.slice(1)) {
    const f = splitLine(line, sep);
    const name = (f[iProduct] ?? "").trim();
    const quantity = num(f[iQty]);
    if (!name || quantity == null || quantity === 0) continue; // cash-regels (EUR/USD saldo) hebben vaak lege aantallen
    if (/^(eur|usd|cash|flatex)/i.test(name) && !f[iSymbol]?.trim()) continue;
    let currentPrice = iPrice >= 0 ? num(f[iPrice]) : null;
    const valueEur = iValue >= 0 ? num(f[iValue]) : null;
    if (currentPrice == null && valueEur != null && quantity !== 0) {
      currentPrice = Math.round((valueEur / quantity) * 100) / 100;
    }
    const symRaw = iSymbol >= 0 ? (f[iSymbol] ?? "").trim() : "";
    // "Symbool/ISIN" kan "VUSA" of een ISIN zijn; korte codes zijn tickers
    const ticker = symRaw && symRaw.length <= 6 ? symRaw.toUpperCase() : null;
    out.push({ name, ticker, quantity, currentPrice });
  }
  return out;
}

export interface PortfolioSyncResult {
  state: FinancialState;
  updated: number;
  created: number;
}

/** Werk bestaande holdings bij (match op ticker of naam) en maak nieuwe aan onder het gegeven platform. */
export function applyPortfolioRows(
  state: FinancialState, rows: PortfolioRow[], platform: string,
): PortfolioSyncResult {
  let updated = 0, created = 0;
  let holdings = [...state.portfolio.holdings];
  for (const row of rows) {
    const idx = holdings.findIndex((h) =>
      (row.ticker && h.ticker && h.ticker.toUpperCase() === row.ticker) ||
      h.name.toLowerCase() === row.name.toLowerCase());
    if (idx >= 0) {
      holdings[idx] = {
        ...holdings[idx],
        quantity: row.quantity,
        currentPrice: row.currentPrice ?? holdings[idx].currentPrice,
      };
      updated++;
    } else {
      holdings = [...holdings, {
        id: `hold-${platform.toLowerCase()}-${row.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
        platform,
        name: row.name,
        ticker: row.ticker,
        quantity: row.quantity,
        avgBuyPrice: null,
        currentPrice: row.currentPrice,
      }];
      created++;
    }
  }
  return {
    state: { ...state, portfolio: { ...state.portfolio, holdings } },
    updated, created,
  };
}
