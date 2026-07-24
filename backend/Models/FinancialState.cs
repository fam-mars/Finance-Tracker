using System.Text.Json;
using System.Text.Json.Serialization;

namespace FinancieelOverzicht.Api.Models;

/// <summary>
/// The full financial state document. This is the single unit of sync:
/// the frontend always GETs the whole document and PUTs the whole document back.
///
/// Design rule (mirrors the spreadsheet): the backend stores ONLY input values
/// (the "blue/yellow cells"). Everything the spreadsheet computed with formulas
/// (totals, spaarquote, amortisation schedule, forecast, net worth, LTV, ...)
/// is derived client-side in frontend/src/domain/calc.ts and is never stored.
/// </summary>
public sealed class FinancialState
{
    public int SchemaVersion { get; set; } = 1;
    public MetaInfo Meta { get; set; } = new();
    public List<Income> Incomes { get; set; } = [];
    public List<FixedExpense> FixedExpenses { get; set; } = [];
    public MonthOverview MonthOverview { get; set; } = new();
    public Portfolio Portfolio { get; set; } = new();
    public ForecastAssumptions Forecast { get; set; } = new();
    public MortgageInputs Mortgage { get; set; } = new();
    public List<Debt> Debts { get; set; } = [];
    public NetWorthInputs NetWorth { get; set; } = new();
    public List<SavingsGoal> SavingsGoals { get; set; } = [];
    public List<MutualLoan> MutualLoans { get; set; } = [];
}

public sealed class MetaInfo
{
    public string Title { get; set; } = "Financieel Overzicht 2.0";
    public string Currency { get; set; } = "EUR";
    public string Locale { get; set; } = "nl-NL";
    public string? SourceFile { get; set; }
    public string? ExportedAt { get; set; }
}

public sealed class Income
{
    public string Id { get; set; } = "";
    public string Source { get; set; } = "";
    public double AmountPerMonth { get; set; }
    public string? Note { get; set; }
}

public sealed class FixedExpense
{
    public string Id { get; set; } = "";
    /// <summary>Day of month the payment is collected (1-31), null if unknown.</summary>
    public int? PayDay { get; set; }
    public string Description { get; set; } = "";
    public string Category { get; set; } = "";
    /// <summary>Free-form tag from the sheet, e.g. "V" (direct debit) or "V THIJS".</summary>
    public string? Tag { get; set; }
    /// <summary>Can be negative (e.g. mortgage interest deduction refund).</summary>
    public double AmountPerMonth { get; set; }
}

public sealed class MonthOverview
{
    public int Year { get; set; } = DateTime.UtcNow.Year;
    public List<VariableExpenseCategory> VariableExpenses { get; set; } = [];
}

public sealed class VariableExpenseCategory
{
    public string Id { get; set; } = "";
    public string Category { get; set; } = "";
    public double? BudgetPerMonth { get; set; }
    /// <summary>Keys: jan, feb, mrt, apr, mei, jun, jul, aug, sep, okt, nov, dec. Null = not filled in yet.</summary>
    public Dictionary<string, double?> Actuals { get; set; } = new();
}

public sealed class Portfolio
{
    public List<Holding> Holdings { get; set; } = [];
    public List<MonthlyContribution> MonthlyContributions { get; set; } = [];
}

public sealed class Holding
{
    public string Id { get; set; } = "";
    public string Platform { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Ticker { get; set; }
    public double? Quantity { get; set; }
    public double? AvgBuyPrice { get; set; }
    public double? CurrentPrice { get; set; }
}

public sealed class MonthlyContribution
{
    public string Id { get; set; } = "";
    public string Target { get; set; } = "";
    public double AmountPerMonth { get; set; }
    public string? Note { get; set; }
}

public sealed class ForecastAssumptions
{
    /// <summary>Null = use current portfolio value (derived client-side).</summary>
    public double? StartValueOverride { get; set; }
    /// <summary>Null = use total monthly contributions from Portfolio.</summary>
    public double? MonthlyContributionOverride { get; set; }
    public double ExpectedReturnPerYear { get; set; } = 0.07;
    public double InflationPerYear { get; set; } = 0.02;
    public int HorizonYears { get; set; } = 20;
}

public sealed class MortgageInputs
{
    public double HomeMarketValue { get; set; }
    public double? PurchasePrice { get; set; }
    public double PrincipalRemaining { get; set; }
    public double InterestRatePerYear { get; set; }
    public int RemainingTermYears { get; set; }
    /// <summary>ISO "yyyy-MM" of the first payment month of the schedule.</summary>
    public string FirstPaymentMonth { get; set; } = "";
    public double ExtraRepaymentPerMonth { get; set; }
    /// <summary>If set, used instead of the computed annuity (real bank amount can differ slightly).</summary>
    public double? MonthlyPaymentOverride { get; set; }
    /// <summary>Monthly tax refund from mortgage interest deduction (renteaftrek), stored positive.</summary>
    public double InterestDeductionPerMonth { get; set; }
}

public sealed class Debt
{
    public string Id { get; set; } = "";
    public string Description { get; set; } = "";
    public string? Lender { get; set; }
    public string? Owner { get; set; }
    public double PrincipalRemaining { get; set; }
    public double InterestRatePerYear { get; set; }
    public double MonthlyPayment { get; set; }
    public int? RemainingTermMonths { get; set; }
    /// <summary>True for the mortgage row: its numbers mirror MortgageInputs and are read-only in the UI.</summary>
    public bool LinkedToMortgage { get; set; }
    public string? Note { get; set; }
}

public sealed class NetWorthInputs
{
    public ManualAssets ManualAssets { get; set; } = new();
    public List<NetWorthSnapshot> Snapshots { get; set; } = [];
}

public sealed class ManualAssets
{
    public double? CheckingAccounts { get; set; }
    public double? SavingsAccounts { get; set; }
    public double? OtherAssets { get; set; }
}

public sealed class NetWorthSnapshot
{
    /// <summary>ISO date "yyyy-MM-dd".</summary>
    public string Date { get; set; } = "";
    public double NetWorth { get; set; }
}

public sealed class SavingsGoal
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    /// <summary>Null on the emergency fund = derived (6x monthly fixed costs) client-side.</summary>
    public double? TargetAmount { get; set; }
    public double? SavedSoFar { get; set; }
    public double? ContributionPerMonth { get; set; }
    public bool IsEmergencyFund { get; set; }
}

public sealed class MutualLoan
{
    public string Id { get; set; } = "";
    public string Date { get; set; } = "";
    public string Who { get; set; } = "";
    public string Description { get; set; } = "";
    public double Amount { get; set; }
    /// <summary>ISO date when repaid, null while outstanding.</summary>
    public string? RepaidOn { get; set; }
}

/// <summary>Envelope returned by GET /api/state and accepted by PUT /api/state.</summary>
public sealed class StateEnvelope
{
    /// <summary>Monotonically increasing revision, incremented on every successful PUT.</summary>
    public long Revision { get; set; }
    public string UpdatedAt { get; set; } = "";
    public FinancialState State { get; set; } = new();
}

public static class Json
{
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.Never,
        WriteIndented = true,
    };
}
