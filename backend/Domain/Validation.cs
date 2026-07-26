using System.Text.RegularExpressions;
using FinancieelOverzicht.Api.Models;

namespace FinancieelOverzicht.Api.Domain;

/// <summary>
/// Domeinvalidatie van het volledige statusdocument. Draait op elke PUT
/// /api/state (422 bij problemen). Formuliervalidatie (invoer parsen,
/// komma/punt-decimalen) blijft in de frontend; alles wat over de betekenis
/// van de data gaat hoort hier.
/// </summary>
public static partial class Validation
{
    static readonly string[] ValidMonths =
        ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

    [GeneratedRegex(@"^\d{4}-\d{2}-\d{2}$")]
    private static partial Regex IsoDate();

    [GeneratedRegex(@"^\d{4}-\d{2}$")]
    private static partial Regex IsoMonth();

    public static List<string> Validate(FinancialState s)
    {
        var p = new List<string>();
        if (s.SchemaVersion != 1) p.Add($"schemaVersion must be 1, got {s.SchemaVersion}");

        void Ids(IEnumerable<string> ids, string what)
        {
            var list = ids.ToList();
            if (list.Any(string.IsNullOrWhiteSpace)) p.Add($"{what}: every item needs a non-empty id");
            if (list.Distinct().Count() != list.Count) p.Add($"{what}: duplicate ids");
        }

        Ids(s.Incomes.Select(x => x.Id), "incomes");
        Ids(s.FixedExpenses.Select(x => x.Id), "fixedExpenses");
        Ids(s.MonthOverview.VariableExpenses.Select(x => x.Id), "monthOverview.variableExpenses");
        Ids(s.Portfolio.Holdings.Select(x => x.Id), "portfolio.holdings");
        Ids(s.Portfolio.MonthlyContributions.Select(x => x.Id), "portfolio.monthlyContributions");
        Ids(s.Debts.Select(x => x.Id), "debts");
        Ids(s.SavingsGoals.Select(x => x.Id), "savingsGoals");
        Ids(s.MutualLoans.Select(x => x.Id), "mutualLoans");

        if (s.Mortgage.PrincipalRemaining < 0) p.Add("mortgage.principalRemaining must be >= 0");
        if (s.Mortgage.HomeMarketValue < 0) p.Add("mortgage.homeMarketValue must be >= 0");
        if (s.Mortgage.InterestRatePerYear is < 0 or > 1) p.Add("mortgage.interestRatePerYear must be a fraction (0.038 = 3.8%)");
        if (s.Mortgage.RemainingTermYears is < 0 or > 60) p.Add("mortgage.remainingTermYears must be between 0 and 60");
        if (s.Mortgage.FirstPaymentMonth.Length > 0 && !IsoMonth().IsMatch(s.Mortgage.FirstPaymentMonth))
            p.Add("mortgage.firstPaymentMonth must be 'yyyy-MM'");
        if (s.Forecast.HorizonYears is < 0 or > 60) p.Add("forecast.horizonYears must be between 0 and 60");
        if (s.Forecast.ExpectedReturnPerYear is < -1 or > 1) p.Add("forecast.expectedReturnPerYear must be a fraction");
        if (s.Forecast.InflationPerYear is < -1 or > 1) p.Add("forecast.inflationPerYear must be a fraction");

        foreach (var e in s.FixedExpenses.Where(e => e.PayDay is < 1 or > 31))
            p.Add($"fixedExpenses[{e.Id}].payDay must be 1-31 or null");

        foreach (var v in s.MonthOverview.VariableExpenses)
            foreach (var k in v.Actuals.Keys.Where(k => !ValidMonths.Contains(k)))
                p.Add($"monthOverview.variableExpenses[{v.Id}].actuals has unknown month key '{k}'");

        foreach (var h in s.Portfolio.Holdings)
        {
            if (h.Quantity is < 0) p.Add($"portfolio.holdings[{h.Id}].quantity must be >= 0");
            if (h.AvgBuyPrice is < 0) p.Add($"portfolio.holdings[{h.Id}].avgBuyPrice must be >= 0");
            if (h.CurrentPrice is < 0) p.Add($"portfolio.holdings[{h.Id}].currentPrice must be >= 0");
        }

        foreach (var d in s.Debts)
        {
            if (d.PrincipalRemaining < 0) p.Add($"debts[{d.Id}].principalRemaining must be >= 0");
            if (d.MonthlyPayment < 0) p.Add($"debts[{d.Id}].monthlyPayment must be >= 0");
            if (d.InterestRatePerYear is < 0 or > 1) p.Add($"debts[{d.Id}].interestRatePerYear must be a fraction");
            if (d.RemainingTermMonths is < 0) p.Add($"debts[{d.Id}].remainingTermMonths must be >= 0 or null");
        }

        foreach (var g in s.SavingsGoals)
        {
            if (g.TargetAmount is < 0) p.Add($"savingsGoals[{g.Id}].targetAmount must be >= 0 or null");
            if (g.SavedSoFar is < 0) p.Add($"savingsGoals[{g.Id}].savedSoFar must be >= 0 or null");
            if (g.ContributionPerMonth is < 0) p.Add($"savingsGoals[{g.Id}].contributionPerMonth must be >= 0 or null");
        }

        foreach (var snap in s.NetWorth.Snapshots.Where(x => !IsoDate().IsMatch(x.Date)))
            p.Add($"netWorth.snapshots date '{snap.Date}' must be 'yyyy-MM-dd'");

        return p;
    }
}
