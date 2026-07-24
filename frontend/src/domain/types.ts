/**
 * Domain types — the exact JSON shape of the backend document.
 * Keep in lockstep with backend/Models/FinancialState.cs.
 * Rule: only INPUT values live here; every computed number lives in calc.ts.
 */

export const MONTH_KEYS = [
  "jan", "feb", "mrt", "apr", "mei", "jun",
  "jul", "aug", "sep", "okt", "nov", "dec",
] as const;
export type MonthKey = (typeof MONTH_KEYS)[number];

export interface FinancialState {
  schemaVersion: 1;
  meta: MetaInfo;
  incomes: Income[];
  fixedExpenses: FixedExpense[];
  monthOverview: MonthOverview;
  portfolio: Portfolio;
  forecast: ForecastAssumptions;
  mortgage: MortgageInputs;
  debts: Debt[];
  netWorth: NetWorthInputs;
  savingsGoals: SavingsGoal[];
  mutualLoans: MutualLoan[];
}

export interface MetaInfo {
  title: string;
  currency: string;
  locale: string;
  sourceFile?: string | null;
  exportedAt?: string | null;
}

export interface Income {
  id: string;
  source: string;
  amountPerMonth: number;
  note?: string | null;
}

export interface FixedExpense {
  id: string;
  payDay: number | null;
  description: string;
  category: string;
  tag?: string | null;
  /** Can be negative (renteaftrek refund). */
  amountPerMonth: number;
}

export interface MonthOverview {
  year: number;
  variableExpenses: VariableExpenseCategory[];
}

export interface VariableExpenseCategory {
  id: string;
  category: string;
  budgetPerMonth: number | null;
  actuals: Partial<Record<MonthKey, number | null>>;
}

export interface Portfolio {
  holdings: Holding[];
  monthlyContributions: MonthlyContribution[];
}

export interface Holding {
  id: string;
  platform: string;
  name: string;
  ticker?: string | null;
  quantity: number | null;
  avgBuyPrice: number | null;
  currentPrice: number | null;
}

export interface MonthlyContribution {
  id: string;
  target: string;
  amountPerMonth: number;
  note?: string | null;
}

export interface ForecastAssumptions {
  startValueOverride: number | null;
  monthlyContributionOverride: number | null;
  expectedReturnPerYear: number;
  inflationPerYear: number;
  horizonYears: number;
}

export interface MortgageInputs {
  homeMarketValue: number;
  purchasePrice: number | null;
  principalRemaining: number;
  interestRatePerYear: number;
  remainingTermYears: number;
  /** "yyyy-MM" */
  firstPaymentMonth: string;
  extraRepaymentPerMonth: number;
  monthlyPaymentOverride: number | null;
  /** Stored positive; subtracted to get net housing cost. */
  interestDeductionPerMonth: number;
}

export interface Debt {
  id: string;
  description: string;
  lender?: string | null;
  owner?: string | null;
  principalRemaining: number;
  interestRatePerYear: number;
  monthlyPayment: number;
  remainingTermMonths: number | null;
  linkedToMortgage: boolean;
  note?: string | null;
}

export interface NetWorthInputs {
  manualAssets: ManualAssets;
  snapshots: NetWorthSnapshot[];
}

export interface ManualAssets {
  checkingAccounts: number | null;
  savingsAccounts: number | null;
  otherAssets: number | null;
}

export interface NetWorthSnapshot {
  /** "yyyy-MM-dd" */
  date: string;
  netWorth: number;
}

export interface SavingsGoal {
  id: string;
  name: string;
  /** null on the emergency fund → derived: 6 × monthly fixed costs. */
  targetAmount: number | null;
  savedSoFar: number | null;
  contributionPerMonth: number | null;
  isEmergencyFund: boolean;
}

export interface MutualLoan {
  id: string;
  date: string;
  who: string;
  description: string;
  amount: number;
  repaidOn: string | null;
}

export interface StateEnvelope {
  revision: number;
  updatedAt: string;
  state: FinancialState;
}
