/**
 * calc.ts — every formula from Financieel_Overzicht_2_0.xlsx, as pure functions.
 *
 * Sinds de backend-refactor is dit een façade: dezelfde formules bestaan ook
 * in backend/Domain/Calc.cs. Elke functie die uit het statusdocument rekent
 * kijkt eerst of er een door de server berekende bundel klaarstaat (zie
 * engine.ts, gevuld door SyncContext achter de feature-flag) en rekent anders
 * lokaal — identieke formules, dus zonder backend verandert er niets.
 * Houd beide kanten in lockstep. Percentages are fractions (0.038 = 3.8%).
 * Money is in euros as plain numbers; format at the edge with formatEUR().
 */

import type {
  Debt,
  FinancialState,
  ForecastAssumptions,
  Holding,
  MonthKey,
  MortgageInputs,
  SavingsGoal,
} from "./types";
import { MONTH_KEYS } from "./types";
import { serverBundle } from "./engine";

// ---------------------------------------------------------------- formatting

const eur0 = new Intl.NumberFormat("nl-NL", {
  style: "currency", currency: "EUR", maximumFractionDigits: 0,
});
const eur2 = new Intl.NumberFormat("nl-NL", {
  style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const pct1 = new Intl.NumberFormat("nl-NL", {
  style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1,
});

export const formatEUR = (v: number, cents = false) => (cents ? eur2 : eur0).format(v);
export const formatPct = (fraction: number) => pct1.format(fraction);

// ---------------------------------------------------------------- cashflow

/** Dashboard: INKOMSTEN P/M — sum of income sources. */
export const totalIncomePerMonth = (s: FinancialState) =>
  serverBundle(s)?.totals.incomePerMonth ??
  s.incomes.reduce((t, i) => t + i.amountPerMonth, 0);

/** Dashboard: VASTE LASTEN P/M — sum incl. negative refund lines. */
export const totalFixedExpensesPerMonth = (s: FinancialState) =>
  serverBundle(s)?.totals.fixedPerMonth ??
  s.fixedExpenses.reduce((t, e) => t + e.amountPerMonth, 0);

/** Dashboard: BELEGGEN P/M — total planned monthly investment contribution. */
export const totalInvestingPerMonth = (s: FinancialState) =>
  serverBundle(s)?.totals.investingPerMonth ??
  s.portfolio.monthlyContributions.reduce((t, c) => t + c.amountPerMonth, 0);

/** Dashboard: SPAARRUIMTE P/M = income − fixed − investing. */
export const savingsRoomPerMonth = (s: FinancialState) =>
  serverBundle(s)?.totals.savingsRoomPerMonth ??
  totalIncomePerMonth(s) - totalFixedExpensesPerMonth(s) - totalInvestingPerMonth(s);

/** Dashboard: SPAARQUOTE = savings room / income (investing excluded, as in the sheet). */
export function savingsRate(s: FinancialState): number {
  const sb = serverBundle(s);
  if (sb) return sb.totals.savingsRate;
  const income = totalIncomePerMonth(s);
  if (income <= 0) return 0;
  return savingsRoomPerMonth(s) / income;
}

/** Dashboard: OPZIJ PER JAAR = 12 × (investing + savings room). */
export const setAsidePerYear = (s: FinancialState) =>
  serverBundle(s)?.totals.setAsidePerYear ??
  12 * (totalInvestingPerMonth(s) + savingsRoomPerMonth(s));

/** Sum of budgeted variable expenses (restaurant, boodschappen extra, etc). */
export const totalVariableExpensesPerMonth = (s: FinancialState) =>
  serverBundle(s)?.totals.variablePerMonth ??
  s.monthOverview.variableExpenses.reduce((t, c) => t + (c.budgetPerMonth ?? 0), 0);

export interface CategoryRow {
  category: string;
  perMonth: number;
  perYear: number;
  share: number;
}

/** Fixed expenses grouped by category, sorted descending, incl. share of total. */
export function fixedExpensesByCategory(s: FinancialState): CategoryRow[] {
  const sb = serverBundle(s);
  if (sb) return sb.fixedByCategory;
  const total = totalFixedExpensesPerMonth(s);
  const map = new Map<string, number>();
  for (const e of s.fixedExpenses) {
    map.set(e.category || "Overig", (map.get(e.category || "Overig") ?? 0) + e.amountPerMonth);
  }
  return [...map.entries()]
    .map(([category, perMonth]) => ({
      category,
      perMonth,
      perYear: perMonth * 12,
      share: total !== 0 ? perMonth / total : 0,
    }))
    .sort((a, b) => b.perMonth - a.perMonth);
}

// ---------------------------------------------------------------- month overview

export interface MonthColumn {
  month: MonthKey;
  income: number;
  fixed: number;
  variable: number;
  totalSpent: number;
  invested: number;
  saved: number;
  savingsRate: number;
  cumulativeSaved: number;
}

/** Maandoverzicht: per-month budget vs actuals, spaarquote and cumulative savings. */
export function monthColumns(s: FinancialState): MonthColumn[] {
  const sb = serverBundle(s);
  if (sb) return sb.monthColumns;
  const income = totalIncomePerMonth(s);
  const fixed = totalFixedExpensesPerMonth(s);
  const invested = totalInvestingPerMonth(s);
  let cumulative = 0;
  return MONTH_KEYS.map((month) => {
    const variable = s.monthOverview.variableExpenses.reduce(
      (t, cat) => t + (cat.actuals[month] ?? 0), 0);
    const totalSpent = fixed + variable;
    const saved = income - totalSpent - invested;
    cumulative += saved;
    return {
      month, income, fixed, variable, totalSpent, invested, saved,
      savingsRate: income > 0 ? saved / income : 0,
      cumulativeSaved: cumulative,
    };
  });
}

// ---------------------------------------------------------------- portfolio

export interface HoldingDerived extends Holding {
  invested: number;
  value: number;
  resultEur: number;
  resultPct: number | null;
  allocation: number;
}

export interface PortfolioData {
  holdings: HoldingDerived[];
  totalInvested: number;
  totalValue: number;
  totalResultEur: number;
  totalResultPct: number | null;
}

/** Portefeuille: invested, value, result and allocation per holding. */
export function portfolioDerived(s: FinancialState): PortfolioData {
  const sb = serverBundle(s);
  if (sb) return sb.portfolio;
  const base = s.portfolio.holdings.map((h) => {
    const invested = (h.quantity ?? 0) * (h.avgBuyPrice ?? 0);
    const value = (h.quantity ?? 0) * (h.currentPrice ?? 0);
    return { ...h, invested, value, resultEur: value - invested };
  });
  const totalInvested = base.reduce((t, h) => t + h.invested, 0);
  const totalValue = base.reduce((t, h) => t + h.value, 0);
  return {
    holdings: base.map((h) => ({
      ...h,
      resultPct: h.invested > 0 ? h.resultEur / h.invested : null,
      allocation: totalValue > 0 ? h.value / totalValue : 0,
    })),
    totalInvested,
    totalValue,
    totalResultEur: totalValue - totalInvested,
    totalResultPct: totalInvested > 0 ? (totalValue - totalInvested) / totalInvested : null,
  };
}

// ---------------------------------------------------------------- asset classes

export type AssetClass = "Crypto" | "Aandelen & ETF's" | "P2P-leningen" | "Overig";

/** Platformnaam → beleggingsklasse (Bitvavo, DeGiro, Trading 212, Mintos, Bondora, …). */
export function assetClassOf(platform: string): AssetClass {
  const p = platform.toLowerCase();
  if (p.includes("bitvavo") || p.includes("crypto") || p.includes("coinbase") || p.includes("kraken")) return "Crypto";
  if (p.includes("mintos") || p.includes("bondora") || p.includes("p2p") || p.includes("peerberry")) return "P2P-leningen";
  if (p.includes("degiro") || p.includes("trading") || p.includes("212") || p.includes("broker") || p.includes("etf") || p.includes("meesman") || p.includes("brand new day")) return "Aandelen & ETF's";
  return "Overig";
}

export interface AllocationSlice {
  klass: AssetClass;
  value: number;
  share: number;
}

/** Portefeuilleverdeling per beleggingsklasse. */
export function allocationByClass(s: FinancialState): AllocationSlice[] {
  const sb = serverBundle(s);
  if (sb) return sb.allocation;
  const pf = portfolioDerived(s);
  const map = new Map<AssetClass, number>();
  for (const h of pf.holdings) {
    const k = assetClassOf(h.platform);
    map.set(k, (map.get(k) ?? 0) + h.value);
  }
  return [...map.entries()]
    .map(([klass, value]) => ({ klass, value, share: pf.totalValue > 0 ? value / pf.totalValue : 0 }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);
}

// ---------------------------------------------------------------- forecast

export interface ForecastYearRow {
  year: number;
  startValue: number;
  contributed: number;
  endValue: number;
  totalContributed: number;
  inTodaysMoney: number;
}

/**
 * Prognose: monthly compounding at rate r/12, contribution added each month,
 * inflation-discounted "koopkracht van nu" column. Matches the sheet's model.
 */
export function forecastTable(
  f: ForecastAssumptions,
  defaults: { startValue: number; monthlyContribution: number },
): ForecastYearRow[] {
  // Serverbundel alleen gebruiken als de aanroeper dezelfde defaults hanteert
  // als waarmee de server rekende (portefeuillewaarde + maandinleg).
  const sb = serverBundle(f);
  if (
    sb &&
    Math.abs(sb.forecastDefaults.startValue - defaults.startValue) < 0.005 &&
    Math.abs(sb.forecastDefaults.monthlyContribution - defaults.monthlyContribution) < 0.005
  ) {
    return sb.forecast;
  }
  const start = f.startValueOverride ?? defaults.startValue;
  const monthly = f.monthlyContributionOverride ?? defaults.monthlyContribution;
  const rMonth = f.expectedReturnPerYear / 12;
  const rows: ForecastYearRow[] = [{
    year: 0, startValue: start, contributed: 0, endValue: start,
    totalContributed: start, inTodaysMoney: start,
  }];
  let value = start;
  let totalContributed = start;
  for (let y = 1; y <= f.horizonYears; y++) {
    const startValue = value;
    for (let m = 0; m < 12; m++) value = value * (1 + rMonth) + monthly;
    totalContributed += monthly * 12;
    rows.push({
      year: y, startValue, contributed: monthly * 12, endValue: value,
      totalContributed,
      inTodaysMoney: value / Math.pow(1 + f.inflationPerYear, y),
    });
  }
  return rows;
}

/** Prognose scenario grid: end value after `years` for a contribution × return matrix. */
export function forecastScenario(
  startValue: number, monthlyContribution: number, returnPerYear: number, years: number,
): number {
  const rMonth = returnPerYear / 12;
  let value = startValue;
  for (let m = 0; m < years * 12; m++) value = value * (1 + rMonth) + monthlyContribution;
  return value;
}

/**
 * Months of monthly compounding + contribution needed to grow `start` to
 * `target`. Returns 0 if already there, null if unreachable within 100
 * years (e.g. contribution and return both non-positive).
 */
export function monthsToReachTarget(
  start: number, monthlyContribution: number, returnPerYear: number, target: number,
): number | null {
  if (target <= start) return 0;
  const rMonth = returnPerYear / 12;
  let value = start;
  const maxMonths = 100 * 12;
  for (let m = 1; m <= maxMonths; m++) {
    value = value * (1 + rMonth) + monthlyContribution;
    if (value >= target) return m;
  }
  return null;
}

// ---------------------------------------------------------------- mortgage

export interface AmortizationRow {
  monthIndex: number; // 1-based
  date: string;       // "yyyy-MM"
  startBalance: number;
  interest: number;
  principal: number;
  extra: number;
  endBalance: number;
}

/** Annuity payment for principal P, monthly rate i, n months. */
export function annuityPayment(principal: number, ratePerYear: number, years: number): number {
  const i = ratePerYear / 12;
  const n = years * 12;
  if (n <= 0) return 0;
  if (i === 0) return principal / n;
  return (principal * i) / (1 - Math.pow(1 + i, -n));
}

/** Hypotheek & Woning: full monthly amortization schedule incl. extra repayments. */
export function amortizationSchedule(m: MortgageInputs): AmortizationRow[] {
  // Cache-hit alleen voor het originele hypotheekobject uit het document;
  // wat-als-varianten (bijv. extra aflossen via spread) rekenen altijd lokaal.
  const sb = serverBundle(m);
  if (sb) return sb.mortgage.schedule;
  const payment = m.monthlyPaymentOverride ?? annuityPayment(
    m.principalRemaining, m.interestRatePerYear, m.remainingTermYears);
  const i = m.interestRatePerYear / 12;
  const maxMonths = m.remainingTermYears * 12;
  const [y0, mo0] = m.firstPaymentMonth.split("-").map(Number);
  const rows: AmortizationRow[] = [];
  let balance = m.principalRemaining;
  for (let k = 0; k < maxMonths && balance > 0.005; k++) {
    const interest = balance * i;
    let principal = Math.min(payment - interest, balance);
    if (principal < 0) principal = 0; // payment below interest: balance grows — surfaced in UI
    let extra = Math.min(m.extraRepaymentPerMonth, balance - principal);
    if (extra < 0) extra = 0;
    const end = balance - principal - extra;
    const total = (mo0 - 1) + k;
    const date = `${y0 + Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
    rows.push({
      monthIndex: k + 1, date, startBalance: balance,
      interest, principal, extra, endBalance: Math.max(end, 0),
    });
    balance = Math.max(end, 0);
  }
  return rows;
}

export interface MortgageSummary {
  computedAnnuity: number;
  usedPayment: number;
  equity: number;              // overwaarde
  loanToValue: number;
  firstMonthInterest: number;
  firstMonthPrincipal: number;
  netHousingCostPerMonth: number;
  totalRemainingInterest: number;
  payoffDate: string | null;   // "yyyy-MM" of last schedule row
}

/** Hypotheek & Woning: kerngetallen. */
export function mortgageSummary(m: MortgageInputs): MortgageSummary {
  const sb = serverBundle(m);
  if (sb) return sb.mortgage.summary;
  const computedAnnuity = annuityPayment(m.principalRemaining, m.interestRatePerYear, m.remainingTermYears);
  const usedPayment = m.monthlyPaymentOverride ?? computedAnnuity;
  const schedule = amortizationSchedule(m);
  const first = schedule[0];
  return {
    computedAnnuity,
    usedPayment,
    equity: m.homeMarketValue - m.principalRemaining,
    loanToValue: m.homeMarketValue > 0 ? m.principalRemaining / m.homeMarketValue : 0,
    firstMonthInterest: first?.interest ?? 0,
    firstMonthPrincipal: first?.principal ?? 0,
    netHousingCostPerMonth: usedPayment - m.interestDeductionPerMonth,
    totalRemainingInterest: schedule.reduce((t, r) => t + r.interest, 0),
    payoffDate: schedule.at(-1)?.date ?? null,
  };
}

export interface MortgageYearRow {
  year: number;
  balance: number;
  equity: number;
}

/** Restschuld + overwaarde per year (for the year chart), derived from the schedule. */
export function mortgagePerYear(m: MortgageInputs): MortgageYearRow[] {
  const sb = serverBundle(m);
  if (sb) return sb.mortgage.perYear;
  const schedule = amortizationSchedule(m);
  const out = [{ year: 0, balance: m.principalRemaining, equity: m.homeMarketValue - m.principalRemaining }];
  for (let y = 1; y * 12 <= schedule.length; y++) {
    const balance = schedule[y * 12 - 1].endBalance;
    out.push({ year: y, balance, equity: m.homeMarketValue - balance });
  }
  return out;
}

// ---------------------------------------------------------------- debts

export const totalDebt = (debts: Debt[]) =>
  serverBundle(debts)?.totals.debtTotal ??
  debts.reduce((t, d) => t + d.principalRemaining, 0);

export const totalDebtExclMortgage = (debts: Debt[]) =>
  serverBundle(debts)?.totals.debtExclMortgage ??
  debts.filter((d) => !d.linkedToMortgage).reduce((t, d) => t + d.principalRemaining, 0);

export const totalDebtPaymentPerMonth = (debts: Debt[]) =>
  serverBundle(debts)?.totals.debtPaymentPerMonth ??
  debts.reduce((t, d) => t + d.monthlyPayment, 0);

/** "Klaar in": first payment month + remaining term. */
export function debtPayoffDate(d: Debt, from = new Date()): Date | null {
  if (d.remainingTermMonths == null) return null;
  const out = new Date(from);
  out.setMonth(out.getMonth() + d.remainingTermMonths);
  return out;
}

// ---------------------------------------------------------------- net worth

export interface NetWorthDerived {
  assets: { label: string; value: number; auto: boolean }[];
  totalAssets: number;
  liabilities: { label: string; value: number }[];
  totalLiabilities: number;
  netWorth: number;
}

/** Vermogen: bezittingen − schulden, with auto lines from portfolio and mortgage. */
export function netWorthDerived(s: FinancialState): NetWorthDerived {
  const sb = serverBundle(s);
  if (sb) return sb.netWorth;
  const pf = portfolioDerived(s);
  let cryptoValue = 0, p2pValue = 0;
  for (const h of pf.holdings) {
    const k = assetClassOf(h.platform);
    if (k === "Crypto") cryptoValue += h.value;
    else if (k === "P2P-leningen") p2pValue += h.value;
  }
  const brokerValue = pf.totalValue - cryptoValue - p2pValue;

  const assets = [
    { label: "Betaalrekening(en)", value: s.netWorth.manualAssets.checkingAccounts ?? 0, auto: false },
    { label: "Spaarrekening(en)", value: s.netWorth.manualAssets.savingsAccounts ?? 0, auto: false },
    { label: "Beleggingen", value: brokerValue, auto: true },
    { label: "Crypto", value: cryptoValue, auto: true },
    ...(p2pValue > 0 ? [{ label: "P2P-leningen", value: p2pValue, auto: true }] : []),
    { label: "Woning (marktwaarde)", value: s.mortgage.homeMarketValue, auto: true },
    { label: "Overige bezittingen", value: s.netWorth.manualAssets.otherAssets ?? 0, auto: false },
  ];
  const liabilities = s.debts.map((d) => ({ label: d.description, value: d.principalRemaining }));
  const totalAssets = assets.reduce((t, a) => t + a.value, 0);
  const totalLiabilities = liabilities.reduce((t, l) => t + l.value, 0);
  return { assets, totalAssets, liabilities, totalLiabilities, netWorth: totalAssets - totalLiabilities };
}

// ---------------------------------------------------------------- savings goals

export interface SavingsGoalDerived extends SavingsGoal {
  effectiveTarget: number;
  stillNeeded: number;
  monthsToGo: number | null;
  progress: number; // 0..1
}

export interface SavingsGoalsData {
  goals: SavingsGoalDerived[];
  availablePerMonth: number;
  plannedPerMonth: number;
  freePerMonth: number;
}

/** Sparen: progress and months-to-go per goal. Emergency fund target = 6 × fixed costs. */
export function savingsGoalsDerived(s: FinancialState): SavingsGoalsData {
  const sb = serverBundle(s);
  if (sb) return sb.savingsGoals;
  const availablePerMonth = savingsRoomPerMonth(s);
  const sixMonthsFixed = 6 * totalFixedExpensesPerMonth(s);
  const goals = s.savingsGoals.map((g) => {
    const effectiveTarget = g.targetAmount ?? (g.isEmergencyFund ? sixMonthsFixed : 0);
    const saved = g.savedSoFar ?? 0;
    const stillNeeded = Math.max(effectiveTarget - saved, 0);
    const perMonth = g.contributionPerMonth ?? 0;
    return {
      ...g,
      effectiveTarget,
      stillNeeded,
      monthsToGo: perMonth > 0 ? Math.ceil(stillNeeded / perMonth) : null,
      progress: effectiveTarget > 0 ? Math.min(saved / effectiveTarget, 1) : 0,
    };
  });
  const plannedPerMonth = goals.reduce((t, g) => t + (g.contributionPerMonth ?? 0), 0);
  return { goals, availablePerMonth, plannedPerMonth, freePerMonth: availablePerMonth - plannedPerMonth };
}

// ---------------------------------------------------------------- box 3 (NL vermogensbelasting)

export interface Box3Params {
  /** Heffingsvrij vermogen per persoon. */
  exemptionPerPerson: number;
  /** Fiscale partners → vrijstelling en schuldendrempel ×2. */
  partners: boolean;
  /** Forfaitair rendement banktegoeden (fractie). */
  rateSavings: number;
  /** Forfaitair rendement overige bezittingen/beleggingen. */
  rateInvestments: number;
  /** Forfaitair rendement schulden (aftrek). */
  rateDebts: number;
  /** Schuldendrempel per persoon. */
  debtThresholdPerPerson: number;
  /** Box 3-tarief. */
  taxRate: number;
}

/** 2026: vrijstelling €59.357 p.p., tarief 36%; banktegoeden 1,28% en schulden 2,70% (voorlopig), beleggingen 6,00% (definitief). */
export const BOX3_2026: Omit<Box3Params, "partners"> = {
  exemptionPerPerson: 59357,
  rateSavings: 0.0128,
  rateInvestments: 0.06,
  rateDebts: 0.027,
  debtThresholdPerPerson: 3900,
  taxRate: 0.36,
};

export interface Box3Result {
  savings: number;            // banktegoeden (betaal + spaar)
  investments: number;        // beleggingen + overige bezittingen
  deductibleDebt: number;     // schulden excl. hypotheek, na drempel
  rendementsgrondslag: number;
  exemption: number;
  taxableBase: number;        // grondslag sparen en beleggen
  forfaitairRendement: number;
  tax: number;                // per jaar
}

/**
 * Schatting box 3 volgens de forfaitaire methode (Overbruggingswet).
 * Eigen woning en hypotheek vallen in box 1 en tellen hier niet mee;
 * studieschuld en overige leningen zijn aftrekbaar boven de drempel.
 */
export function box3Estimate(s: FinancialState, p: Box3Params): Box3Result {
  // De server rekent beide 2026-varianten (alleen/partners) voor; alleen bij
  // afwijkende parameters (toekomstige jaren, eigen tarieven) rekenen we lokaal.
  const sb = serverBundle(s);
  if (
    sb &&
    p.exemptionPerPerson === BOX3_2026.exemptionPerPerson &&
    p.rateSavings === BOX3_2026.rateSavings &&
    p.rateInvestments === BOX3_2026.rateInvestments &&
    p.rateDebts === BOX3_2026.rateDebts &&
    p.debtThresholdPerPerson === BOX3_2026.debtThresholdPerPerson &&
    p.taxRate === BOX3_2026.taxRate
  ) {
    return p.partners ? sb.box3.partners : sb.box3.single;
  }
  const pf = portfolioDerived(s);
  const m = s.netWorth.manualAssets;
  const savings = (m.checkingAccounts ?? 0) + (m.savingsAccounts ?? 0);
  const investments = pf.totalValue + (m.otherAssets ?? 0);
  const mult = p.partners ? 2 : 1;
  const deductibleDebt = Math.max(totalDebtExclMortgage(s.debts) - p.debtThresholdPerPerson * mult, 0);
  const rendementsgrondslag = Math.max(savings + investments - deductibleDebt, 0);
  const exemption = p.exemptionPerPerson * mult;
  const taxableBase = Math.max(rendementsgrondslag - exemption, 0);
  const forfaitairRendement = Math.max(
    savings * p.rateSavings + investments * p.rateInvestments - deductibleDebt * p.rateDebts, 0);
  const share = rendementsgrondslag > 0 ? taxableBase / rendementsgrondslag : 0;
  const tax = Math.round(forfaitairRendement * share * p.taxRate * 100) / 100;
  return { savings, investments, deductibleDebt, rendementsgrondslag, exemption, taxableBase, forfaitairRendement, tax };
}

// ---------------------------------------------------------------- extra aflossen vs beleggen

export interface RepayVsInvest {
  interestSaved: number;   // gegarandeerd bespaarde hypotheekrente
  monthsEarlier: number;   // zoveel eerder hypotheekvrij
  horizonMonths: number;   // resterende looptijd zonder extra aflossing
  invested: number;        // totaal ingelegd bij beleggen
  investEndValue: number;  // verwachte eindwaarde bij beleggen
  investGrowth: number;    // verwachte groei boven inleg
}

/** Vergelijk €X p/m extra aflossen (rente bespaard, eerder vrij) met hetzelfde bedrag beleggen. */
export function repayVsInvest(m: MortgageInputs, extraPerMonth: number, returnPerYear: number): RepayVsInvest {
  const base = amortizationSchedule(m);
  const withExtra = amortizationSchedule({
    ...m, extraRepaymentPerMonth: m.extraRepaymentPerMonth + extraPerMonth,
  });
  const interestSaved =
    base.reduce((t, r) => t + r.interest, 0) - withExtra.reduce((t, r) => t + r.interest, 0);
  const horizonMonths = base.length;
  const rMonth = returnPerYear / 12;
  let investEndValue = 0;
  for (let i = 0; i < horizonMonths; i++) investEndValue = investEndValue * (1 + rMonth) + extraPerMonth;
  const invested = extraPerMonth * horizonMonths;
  return {
    interestSaved, monthsEarlier: base.length - withExtra.length, horizonMonths,
    invested, investEndValue, investGrowth: investEndValue - invested,
  };
}

// ---------------------------------------------------------------- dashboard rollup

export interface DashboardData {
  incomePerMonth: number;
  fixedPerMonth: number;
  variablePerMonth: number;
  totalExpensesPerMonth: number;
  investingPerMonth: number;
  savingsRoomPerMonth: number;
  savingsRate: number;
  setAsidePerYear: number;
  portfolioValue: number;
  netWorth: number;
  investableNetWorth: number;
  liquidSavings: number;
  forecastValue: number;
  forecastYears: number;
  expectedReturnPerYear: number;
  emergencyFundProgress: number;
  homeValue: number;
  mortgageRemaining: number;
  homeEquity: number;
  loanToValue: number;
  otherDebt: number;
  netHousingCostPerMonth: number;
}

/** Everything the dashboard shows, in one derived object. */
export function dashboard(s: FinancialState): DashboardData {
  const sb = serverBundle(s);
  if (sb) return sb.dashboard;
  const pf = portfolioDerived(s);
  const nw = netWorthDerived(s);
  const mg = mortgageSummary(s.mortgage);
  const goals = savingsGoalsDerived(s);
  const emergency = goals.goals.find((g) => g.isEmergencyFund);
  const forecastEnd = forecastTable(s.forecast, {
    startValue: pf.totalValue,
    monthlyContribution: totalInvestingPerMonth(s),
  }).at(-1);

  // Liquid savings only (checking + savings accounts), used where a tip or
  // calculation needs "cash on hand" rather than total net worth.
  const liquidSavings =
    (s.netWorth.manualAssets.checkingAccounts ?? 0) + (s.netWorth.manualAssets.savingsAccounts ?? 0);

  // Net worth minus primary-residence equity: the pool a 4%-rule withdrawal
  // is actually drawn from. Home value and non-mortgage debt are excluded
  // so the FIRE number isn't inflated by illiquid equity.
  const investableNetWorth =
    nw.totalAssets - s.mortgage.homeMarketValue - totalDebtExclMortgage(s.debts);

  return {
    incomePerMonth: totalIncomePerMonth(s),
    fixedPerMonth: totalFixedExpensesPerMonth(s),
    variablePerMonth: totalVariableExpensesPerMonth(s),
    totalExpensesPerMonth: totalFixedExpensesPerMonth(s) + totalVariableExpensesPerMonth(s),
    investingPerMonth: totalInvestingPerMonth(s),
    savingsRoomPerMonth: savingsRoomPerMonth(s),
    savingsRate: savingsRate(s),
    setAsidePerYear: setAsidePerYear(s),
    portfolioValue: pf.totalValue,
    netWorth: nw.netWorth,
    investableNetWorth,
    liquidSavings,
    forecastValue: forecastEnd?.endValue ?? 0,
    forecastYears: s.forecast.horizonYears,
    expectedReturnPerYear: s.forecast.expectedReturnPerYear,
    emergencyFundProgress: emergency?.progress ?? 0,
    homeValue: s.mortgage.homeMarketValue,
    mortgageRemaining: s.mortgage.principalRemaining,
    homeEquity: mg.equity,
    loanToValue: mg.loanToValue,
    otherDebt: totalDebtExclMortgage(s.debts),
    netHousingCostPerMonth: mg.netHousingCostPerMonth,
  };
}

// ---------------------------------------------------------------- financiële gezondheid

export interface HealthSubscore {
  key: string;
  label: string;
  /** 0–100 */
  score: number;
  detail: string;
}

export interface FinancialHealth {
  /** Gewogen totaal 0–100. */
  score: number;
  label: "Uitstekend" | "Goed" | "Redelijk" | "Aandacht nodig";
  subscores: HealthSubscore[];
}

/**
 * Samengestelde gezondheidsscore langs Nibud-richtlijnen:
 * buffer van meerdere maandlasten, ≥10% sparen (20% = uitstekend),
 * woonquote ≤30% (>40% risicovol), vaste lasten ≤50% van netto inkomen.
 */
export function financialHealth(s: FinancialState): FinancialHealth {
  const sb = serverBundle(s);
  if (sb) return sb.health;
  const d = dashboard(s);
  const income = d.incomePerMonth || 1;
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

  const spaarRate = (d.investingPerMonth + Math.max(d.savingsRoomPerMonth, 0)) / income;
  const woonRatio = d.netHousingCostPerMonth / income;
  const vastRatio = d.fixedPerMonth / income;
  const bufferMonths = d.totalExpensesPerMonth > 0 ? d.portfolioValue / d.totalExpensesPerMonth : 0;

  const raw: (Omit<HealthSubscore, "score"> & { score01: number; weight: number })[] = [
    {
      key: "noodfonds", label: "Noodfonds", weight: 0.25,
      score01: clamp01(d.emergencyFundProgress),
      detail: `${formatPct(d.emergencyFundProgress)} van 6× maandlasten (Nibud: 4–5 maandsalarissen voor een gezin)`,
    },
    {
      key: "sparen", label: "Sparen & beleggen", weight: 0.25,
      score01: clamp01(spaarRate / 0.2),
      detail: `${formatPct(spaarRate)} van je inkomen (Nibud-minimum 10%, 20%+ is uitstekend)`,
    },
    {
      key: "wonen", label: "Woonquote", weight: 0.2,
      score01: clamp01((0.45 - woonRatio) / 0.15),
      detail: `${formatPct(woonRatio)} van je inkomen naar wonen (≤30% gezond, >40% risicovol)`,
    },
    {
      key: "vast", label: "Vaste lasten", weight: 0.15,
      score01: clamp01((0.65 - vastRatio) / 0.2),
      detail: `${formatPct(vastRatio)} van je inkomen ligt vast (Nibud-richtlijn: max ±50%)`,
    },
    {
      key: "vermogen", label: "Vermogensbuffer", weight: 0.15,
      score01: clamp01(bufferMonths / 12),
      detail: `belegd vermogen dekt ${bufferMonths.toFixed(1)} maanden uitgaven (12+ = sterk)`,
    },
  ];
  const subscores = raw.map((x) => ({ key: x.key, label: x.label, detail: x.detail, score: Math.round(x.score01 * 100) }));
  const score = Math.round(raw.reduce((t, x) => t + x.score01 * 100 * x.weight, 0));
  const label = score >= 80 ? "Uitstekend" : score >= 60 ? "Goed" : score >= 40 ? "Redelijk" : "Aandacht nodig";
  return { score, label, subscores };
}
