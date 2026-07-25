/**
 * demoData.ts — volledig fictief huishouden voor de demo-modus.
 * Laat alle features zien (incl. vermogenstrend en variabele uitgaven)
 * zonder ook maar één echt gegeven van de eigenaar te tonen.
 */

import type { FinancialState } from "./types";

export const DEMO_STATE: FinancialState = {
  schemaVersion: 1,
  meta: { title: "Demo Huishouden", currency: "EUR", locale: "nl-NL", sourceFile: null, exportedAt: null },
  incomes: [
    { id: "demo-inc-1", source: "Salaris Alex", amountPerMonth: 2400, note: "demo" },
    { id: "demo-inc-2", source: "Salaris Sam", amountPerMonth: 2100, note: "demo" },
  ],
  fixedExpenses: [
    { id: "demo-fx-1", payDay: 1, description: "Hypotheek", category: "Wonen", tag: null, amountPerMonth: 1450 },
    { id: "demo-fx-2", payDay: 3, description: "Zorgverzekering", category: "Verzekeringen", tag: null, amountPerMonth: 290 },
    { id: "demo-fx-3", payDay: 5, description: "Boodschappen", category: "Boodschappen", tag: null, amountPerMonth: 480 },
    { id: "demo-fx-4", payDay: 10, description: "Energie & water", category: "Nutsvoorzieningen", tag: null, amountPerMonth: 165 },
    { id: "demo-fx-5", payDay: 12, description: "Internet", category: "Telecom", tag: null, amountPerMonth: 45 },
    { id: "demo-fx-6", payDay: 14, description: "Telefoons", category: "Telecom", tag: null, amountPerMonth: 40 },
    { id: "demo-fx-7", payDay: 20, description: "Sportschool", category: "Abonnementen", tag: null, amountPerMonth: 60 },
    { id: "demo-fx-8", payDay: 22, description: "Streamingdiensten", category: "Abonnementen", tag: null, amountPerMonth: 27 },
    { id: "demo-fx-9", payDay: 25, description: "Autoverzekering", category: "Verzekeringen", tag: null, amountPerMonth: 85 },
    { id: "demo-fx-10", payDay: 26, description: "Autolening", category: "Aflossingen", tag: null, amountPerMonth: 220 },
  ],
  monthOverview: {
    year: 2026,
    variableExpenses: [
      { id: "demo-var-1", category: "Restaurant", budgetPerMonth: 150, actuals: { jan: 110, feb: 145, mrt: 95, apr: 180, mei: 120, jun: 135, jul: 90 } },
      { id: "demo-var-2", category: "Uitjes", budgetPerMonth: 100, actuals: { jan: 60, feb: 40, mrt: 120, apr: 85, mei: 95, jun: 110, jul: 70 } },
      { id: "demo-var-3", category: "Kleding", budgetPerMonth: 80, actuals: { jan: 0, feb: 150, mrt: 45, apr: 0, mei: 210, jun: 30, jul: 60 } },
    ],
  },
  portfolio: {
    holdings: [
      { id: "demo-hold-1", platform: "Bitvavo", name: "Bitcoin", ticker: "BTC", quantity: 0.05, avgBuyPrice: 52000, currentPrice: 56000 },
      { id: "demo-hold-2", platform: "Degiro", name: "Vanguard FTSE All-World", ticker: "VWRL", quantity: 85, avgBuyPrice: 98, currentPrice: 112 },
      { id: "demo-hold-3", platform: "Trading 212", name: "iShares MSCI World", ticker: "IWDA", quantity: 60, avgBuyPrice: 78, currentPrice: 86 },
      { id: "demo-hold-4", platform: "Mintos", name: "Mintos account", ticker: null, quantity: 1, avgBuyPrice: null, currentPrice: 1500 },
    ],
    monthlyContributions: [
      { id: "demo-contrib-1", target: "Degiro — VWRL", amountPerMonth: 350, note: null },
      { id: "demo-contrib-2", target: "Bitvavo — BTC", amountPerMonth: 100, note: null },
    ],
  },
  forecast: {
    startValueOverride: null,
    monthlyContributionOverride: null,
    expectedReturnPerYear: 0.06,
    inflationPerYear: 0.02,
    horizonYears: 20,
  },
  mortgage: {
    homeMarketValue: 385000,
    purchasePrice: 340000,
    principalRemaining: 298000,
    interestRatePerYear: 0.038,
    remainingTermYears: 26,
    firstPaymentMonth: "2026-01",
    extraRepaymentPerMonth: 0,
    monthlyPaymentOverride: 1450,
    interestDeductionPerMonth: 210,
  },
  debts: [
    { id: "demo-debt-1", description: "Hypotheek", lender: "Demo Bank", owner: "Samen", principalRemaining: 298000, interestRatePerYear: 0.038, monthlyPayment: 1450, remainingTermMonths: null, linkedToMortgage: true, note: null },
    { id: "demo-debt-2", description: "Autolening", lender: "Demo Lease", owner: "Samen", principalRemaining: 7500, interestRatePerYear: 0.06, monthlyPayment: 220, remainingTermMonths: 36, linkedToMortgage: false, note: null },
  ],
  netWorth: {
    manualAssets: { checkingAccounts: 3200, savingsAccounts: 11800, otherAssets: null },
    snapshots: [
      { date: "2026-02-01", netWorth: 98500 },
      { date: "2026-03-01", netWorth: 100200 },
      { date: "2026-04-01", netWorth: 99400 },
      { date: "2026-05-01", netWorth: 102800 },
      { date: "2026-06-01", netWorth: 105100 },
      { date: "2026-07-01", netWorth: 107600 },
    ],
  },
  savingsGoals: [
    { id: "demo-goal-1", name: "Noodfonds", targetAmount: null, savedSoFar: 8200, contributionPerMonth: 400, isEmergencyFund: true },
    { id: "demo-goal-2", name: "Vakantie", targetAmount: 2500, savedSoFar: 900, contributionPerMonth: 150, isEmergencyFund: false },
    { id: "demo-goal-3", name: "Nieuwe auto", targetAmount: 10000, savedSoFar: 2100, contributionPerMonth: 200, isEmergencyFund: false },
  ],
  mutualLoans: [],
};
