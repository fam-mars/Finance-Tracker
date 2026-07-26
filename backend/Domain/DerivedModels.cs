namespace FinancieelOverzicht.Api.Domain;

/// <summary>
/// DTO's voor alle afgeleide cijfers. De JSON-vorm (camelCase) is 1-op-1 gelijk
/// aan de TypeScript-interfaces in frontend/src/domain/calc.ts en
/// frontend/src/domain/engine.ts — houd beide kanten in lockstep.
/// </summary>
public sealed record DerivedBundle(
    DashboardDto Dashboard,
    FinancialHealthDto Health,
    List<MonthColumnDto> MonthColumns,
    List<CategoryRowDto> FixedByCategory,
    PortfolioDerivedDto Portfolio,
    List<AllocationDto> Allocation,
    NetWorthDerivedDto NetWorth,
    SavingsGoalsDerivedDto SavingsGoals,
    List<ForecastYearRowDto> Forecast,
    ForecastDefaultsDto ForecastDefaults,
    MortgageBundleDto Mortgage,
    Box3BundleDto Box3,
    TotalsDto Totals,
    FireDto Fire);

public sealed record DashboardDto(
    double IncomePerMonth,
    double FixedPerMonth,
    double VariablePerMonth,
    double TotalExpensesPerMonth,
    double InvestingPerMonth,
    double SavingsRoomPerMonth,
    double SavingsRate,
    double SetAsidePerYear,
    double PortfolioValue,
    double NetWorth,
    double InvestableNetWorth,
    double LiquidSavings,
    double ForecastValue,
    int ForecastYears,
    double ExpectedReturnPerYear,
    double EmergencyFundProgress,
    double HomeValue,
    double MortgageRemaining,
    double HomeEquity,
    double LoanToValue,
    double OtherDebt,
    double NetHousingCostPerMonth);

public sealed record HealthSubscoreDto(string Key, string Label, int Score, string Detail);

public sealed record FinancialHealthDto(int Score, string Label, List<HealthSubscoreDto> Subscores);

public sealed record MonthColumnDto(
    string Month,
    double Income,
    double Fixed,
    double Variable,
    double TotalSpent,
    double Invested,
    double Saved,
    double SavingsRate,
    double CumulativeSaved);

public sealed record CategoryRowDto(string Category, double PerMonth, double PerYear, double Share);

public sealed record HoldingDerivedDto(
    string Id,
    string Platform,
    string Name,
    string? Ticker,
    double? Quantity,
    double? AvgBuyPrice,
    double? CurrentPrice,
    double Invested,
    double Value,
    double ResultEur,
    double? ResultPct,
    double Allocation);

public sealed record PortfolioDerivedDto(
    List<HoldingDerivedDto> Holdings,
    double TotalInvested,
    double TotalValue,
    double TotalResultEur,
    double? TotalResultPct);

public sealed record AllocationDto(string Klass, double Value, double Share);

public sealed record ForecastYearRowDto(
    int Year,
    double StartValue,
    double Contributed,
    double EndValue,
    double TotalContributed,
    double InTodaysMoney);

public sealed record ForecastDefaultsDto(double StartValue, double MonthlyContribution);

public sealed record AmortizationRowDto(
    int MonthIndex,
    string Date,
    double StartBalance,
    double Interest,
    double Principal,
    double Extra,
    double EndBalance);

public sealed record MortgageSummaryDto(
    double ComputedAnnuity,
    double UsedPayment,
    double Equity,
    double LoanToValue,
    double FirstMonthInterest,
    double FirstMonthPrincipal,
    double NetHousingCostPerMonth,
    double TotalRemainingInterest,
    string? PayoffDate);

public sealed record MortgageYearRowDto(int Year, double Balance, double Equity);

public sealed record MortgageBundleDto(
    MortgageSummaryDto Summary,
    List<MortgageYearRowDto> PerYear,
    List<AmortizationRowDto> Schedule);

public sealed record NetWorthAssetDto(string Label, double Value, bool Auto);

public sealed record NetWorthLiabilityDto(string Label, double Value);

public sealed record NetWorthDerivedDto(
    List<NetWorthAssetDto> Assets,
    double TotalAssets,
    List<NetWorthLiabilityDto> Liabilities,
    double TotalLiabilities,
    double NetWorth);

public sealed record SavingsGoalDerivedDto(
    string Id,
    string Name,
    double? TargetAmount,
    double? SavedSoFar,
    double? ContributionPerMonth,
    bool IsEmergencyFund,
    double EffectiveTarget,
    double StillNeeded,
    int? MonthsToGo,
    double Progress);

public sealed record SavingsGoalsDerivedDto(
    List<SavingsGoalDerivedDto> Goals,
    double AvailablePerMonth,
    double PlannedPerMonth,
    double FreePerMonth);

public sealed record Box3ResultDto(
    double Savings,
    double Investments,
    double DeductibleDebt,
    double Rendementsgrondslag,
    double Exemption,
    double TaxableBase,
    double ForfaitairRendement,
    double Tax);

public sealed record Box3BundleDto(Box3ResultDto Single, Box3ResultDto Partners);

public sealed record TotalsDto(
    double IncomePerMonth,
    double FixedPerMonth,
    double InvestingPerMonth,
    double VariablePerMonth,
    double SavingsRoomPerMonth,
    double SavingsRate,
    double SetAsidePerYear,
    double DebtTotal,
    double DebtExclMortgage,
    double DebtPaymentPerMonth);

public sealed record FireDto(double RequiredAssets, int? Months, double Progress);

public sealed record RepayVsInvestDto(
    double InterestSaved,
    int MonthsEarlier,
    int HorizonMonths,
    double Invested,
    double InvestEndValue,
    double InvestGrowth);

// ---- request-DTO's voor de losse rekenendpoints (/api/calc/*) ----------------

public sealed record ForecastScenarioRequest(
    double StartValue, double MonthlyContribution, double ReturnPerYear, double Years);

public sealed record MonthsToTargetRequest(
    double Start, double MonthlyContribution, double ReturnPerYear, double Target);

public sealed record AnnuityRequest(double Principal, double RatePerYear, double Years);

public sealed record RepayVsInvestRequest(
    Models.MortgageInputs Mortgage, double ExtraPerMonth, double ReturnPerYear);

public sealed record Box3Request(Models.FinancialState State, bool Partners);
