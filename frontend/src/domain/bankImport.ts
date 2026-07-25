/**
 * bankImport.ts — client-side parsers voor Nederlandse bankexports.
 *
 * Ondersteund: ING CSV, Rabobank CSV, ABN AMRO TXT (tab-gescheiden) en een
 * generieke CSV-fallback. Alles draait in de browser; bankdata verlaat het
 * apparaat nooit. Uitgaven worden per maand en categorie geaggregeerd en in
 * het bestaande maandoverzicht (variabele uitgaven) gezet.
 */

import type { FinancialState, MonthKey } from "./types";
import { MONTH_KEYS } from "./types";

export interface BankTransaction {
  date: string;        // "yyyy-MM-dd"
  description: string;
  amount: number;      // negatief = uitgave
}

export interface ParseResult {
  bank: "ING" | "Rabobank" | "ABN AMRO" | "Generiek";
  transactions: BankTransaction[];
  skippedLines: number;
}

export interface ImportSummary {
  /** categorie → maand → som van uitgaven (positief bedrag) */
  sums: Record<string, Partial<Record<MonthKey, number>>>;
  counted: number;
  skippedIncome: number;
  skippedFixed: number;
  skippedOtherYear: number;
  totalExpenses: number;
}

// ---------------------------------------------------------------- low-level

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

/** "1.234,56" → 1234.56 · "-52,30" → -52.3 · "12.34" → 12.34 */
function parseAmount(raw: string): number | null {
  const t = raw.trim().replace(/\s|€/g, "");
  if (!t) return null;
  const normalized = t.includes(",")
    ? t.replace(/\./g, "").replace(",", ".")
    : t;
  const n = Number(normalized.replace("+", ""));
  return Number.isFinite(n) ? n : null;
}

/** Accepteert yyyymmdd, yyyy-mm-dd en dd-mm-yyyy. */
function parseDate(raw: string): string | null {
  const t = raw.trim().replace(/"/g, "");
  let m = t.match(/^(\d{4})-?(\d{2})-?(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

// ---------------------------------------------------------------- parsers

function parseIng(lines: string[]): BankTransaction[] {
  const header = splitLine(lines[0], ",").map((h) => h.trim());
  const iDate = header.indexOf("Datum");
  const iName = header.findIndex((h) => h.startsWith("Naam"));
  const iAfBij = header.indexOf("Af Bij");
  const iAmount = header.findIndex((h) => h.startsWith("Bedrag"));
  const out: BankTransaction[] = [];
  for (const line of lines.slice(1)) {
    const f = splitLine(line, ",");
    const date = parseDate(f[iDate] ?? "");
    const amount = parseAmount(f[iAmount] ?? "");
    if (!date || amount == null) continue;
    const sign = (f[iAfBij] ?? "").trim() === "Af" ? -1 : 1;
    out.push({ date, description: (f[iName] ?? "").trim(), amount: sign * Math.abs(amount) });
  }
  return out;
}

function parseRabobank(lines: string[]): BankTransaction[] {
  const header = splitLine(lines[0], ",").map((h) => h.trim());
  const iDate = header.indexOf("Datum");
  const iAmount = header.indexOf("Bedrag");
  const iName = header.indexOf("Naam tegenpartij");
  const iDesc = header.indexOf("Omschrijving-1");
  const out: BankTransaction[] = [];
  for (const line of lines.slice(1)) {
    const f = splitLine(line, ",");
    const date = parseDate(f[iDate] ?? "");
    const amount = parseAmount(f[iAmount] ?? "");
    if (!date || amount == null) continue;
    const description = [(f[iName] ?? "").trim(), (f[iDesc] ?? "").trim()].filter(Boolean).join(" · ");
    out.push({ date, description, amount });
  }
  return out;
}

function parseAbnAmro(lines: string[]): BankTransaction[] {
  // Tab-gescheiden, zonder header: rekening, munt, datum, saldo voor, saldo na, rentedatum, bedrag, omschrijving
  const out: BankTransaction[] = [];
  for (const line of lines) {
    const f = line.split("\t");
    if (f.length < 8) continue;
    const date = parseDate(f[2] ?? "");
    const amount = parseAmount(f[6] ?? "");
    if (!date || amount == null) continue;
    out.push({ date, description: (f[7] ?? "").trim().replace(/\s{2,}/g, " "), amount });
  }
  return out;
}

function parseGeneric(lines: string[]): BankTransaction[] {
  const sep = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const header = splitLine(lines[0], sep).map((h) => h.trim().toLowerCase());
  const iDate = header.findIndex((h) => h.includes("datum") || h.includes("date"));
  const iAmount = header.findIndex((h) => h.includes("bedrag") || h.includes("amount"));
  const iDesc = header.findIndex((h) =>
    h.includes("omschrijving") || h.includes("naam") || h.includes("description") || h.includes("tegenpartij"));
  if (iDate < 0 || iAmount < 0) return [];
  const out: BankTransaction[] = [];
  for (const line of lines.slice(1)) {
    const f = splitLine(line, sep);
    const date = parseDate(f[iDate] ?? "");
    const amount = parseAmount(f[iAmount] ?? "");
    if (!date || amount == null) continue;
    out.push({ date, description: (f[iDesc >= 0 ? iDesc : 0] ?? "").trim(), amount });
  }
  return out;
}

export function parseBankFile(text: string): ParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { bank: "Generiek", transactions: [], skippedLines: 0 };
  const first = lines[0];

  let bank: ParseResult["bank"];
  let transactions: BankTransaction[];
  if (first.includes("Datum") && first.includes("Af Bij")) {
    bank = "ING";
    transactions = parseIng(lines);
  } else if (first.includes("IBAN/BBAN") && first.includes("Volgnr")) {
    bank = "Rabobank";
    transactions = parseRabobank(lines);
  } else if (first.includes("\t") && first.split("\t")[1]?.trim() === "EUR") {
    bank = "ABN AMRO";
    transactions = parseAbnAmro(lines);
  } else {
    bank = "Generiek";
    transactions = parseGeneric(lines);
  }
  const dataLines = bank === "ABN AMRO" ? lines.length : lines.length - 1;
  return { bank, transactions, skippedLines: Math.max(dataLines - transactions.length, 0) };
}

// ---------------------------------------------------------------- categorisering

const RULES: { category: string; keywords: string[] }[] = [
  // "Boodschappen extra" i.p.v. "Boodschappen": het vaste-lastenoverzicht heeft
  // al een Boodschappen-budget; supermarktpinnen hier voorkomt dubbeltellen.
  { category: "Boodschappen extra", keywords: ["albert heijn", "ah to go", "ah bezorg", "jumbo", "lidl", "aldi", "plus ", "dirk vdbroek", "dirk van den broek", "picnic", "coop ", "spar ", "ekoplaza", "vomar", "dekamarkt"] },
  { category: "Restaurant", keywords: ["thuisbezorgd", "uber eats", "ubereats", "deliveroo", "dominos", "domino's", "mcdonald", "burger king", "kfc ", "restaurant", "cafe ", "café", "starbucks", "la place", "bakker"] },
  { category: "Entertainment", keywords: ["netflix", "spotify", "videoland", "disney", "hbo", "prime video", "pathe", "pathé", "kinepolis", "vue ", "steam", "playstation", "nintendo", "xbox"] },
  { category: "Vervoer", keywords: ["ns groep", "ns.nl", "ns reizigers", "ov-chipkaart", "ovpay", "gvb", "ret ", "htm ", "shell", "bp ", "esso", "total ", "tinq", "tango", "q8", "greenwheels", "swapfiets", "uber ", "bolt.eu", "q-park", "parkeren", "anwb"] },
  { category: "Shopping", keywords: ["bol.com", "bol com", "amazon", "zalando", "hema", "action", "ikea", "coolblue", "mediamarkt", "wehkamp", "decathlon", "h&m", "primark"] },
  { category: "Zorg", keywords: ["apotheek", "huisarts", "tandarts", "fysio", "kruidvat", "etos", "da drogist"] },
];

export function categorize(description: string): string {
  const d = ` ${description.toLowerCase()} `;
  for (const r of RULES) if (r.keywords.some((k) => d.includes(k))) return r.category;
  return "Overig";
}

// ---------------------------------------------------------------- aggregatie

/**
 * Woorden uit de vaste lasten + bekende interne/vaste stromen. Transacties die
 * hierop matchen worden overgeslagen: die zitten al in het vaste-lastenbudget
 * (of zijn overboekingen naar sparen/beleggen, geen consumptie).
 */
function exclusionKeywords(s: FinancialState): string[] {
  const words = new Set<string>([
    "hypotheek", "verzekering", "spaarrekening", "bitvavo", "degiro", "flatex",
    "belastingdienst", "salaris",
  ]);
  for (const e of s.fixedExpenses) {
    for (const w of e.description.toLowerCase().split(/[^a-z0-9]+/)) {
      if (w.length >= 4 && w !== "boodschappen") words.add(w);
    }
  }
  return [...words];
}

export function aggregateExpenses(state: FinancialState, txs: BankTransaction[]): ImportSummary {
  const excl = exclusionKeywords(state);
  const year = state.monthOverview.year;
  const sums: ImportSummary["sums"] = {};
  let counted = 0, skippedIncome = 0, skippedFixed = 0, skippedOtherYear = 0, totalExpenses = 0;

  for (const tx of txs) {
    if (tx.amount >= 0) { skippedIncome++; continue; }
    const d = tx.description.toLowerCase();
    if (excl.some((w) => d.includes(w))) { skippedFixed++; continue; }
    const txYear = Number(tx.date.slice(0, 4));
    if (txYear !== year) { skippedOtherYear++; continue; }
    const monthIdx = Number(tx.date.slice(5, 7)) - 1;
    const month = MONTH_KEYS[monthIdx];
    if (!month) { skippedOtherYear++; continue; }
    const cat = categorize(tx.description);
    const bucket = (sums[cat] ??= {});
    const amount = Math.abs(tx.amount);
    bucket[month] = Math.round(((bucket[month] ?? 0) + amount) * 100) / 100;
    totalExpenses = Math.round((totalExpenses + amount) * 100) / 100;
    counted++;
  }
  return { sums, counted, skippedIncome, skippedFixed, skippedOtherYear, totalExpenses };
}

/** Zet de geaggregeerde sommen in het maandoverzicht; import overschrijft de maand-actual per categorie. */
export function applyImportToState(state: FinancialState, sums: ImportSummary["sums"]): FinancialState {
  let variableExpenses = [...state.monthOverview.variableExpenses];
  for (const [category, months] of Object.entries(sums)) {
    const idx = variableExpenses.findIndex((v) => v.category.toLowerCase() === category.toLowerCase());
    if (idx >= 0) {
      variableExpenses[idx] = {
        ...variableExpenses[idx],
        actuals: { ...variableExpenses[idx].actuals, ...months },
      };
    } else {
      variableExpenses = [...variableExpenses, {
        id: `var-import-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        category,
        budgetPerMonth: null,
        actuals: { ...months },
      }];
    }
  }
  return { ...state, monthOverview: { ...state.monthOverview, variableExpenses } };
}
