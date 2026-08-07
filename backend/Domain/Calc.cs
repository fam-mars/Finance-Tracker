using System.Globalization;
using FinancieelOverzicht.Api.Models;

namespace FinancieelOverzicht.Api.Domain;

/// <summary>
/// Calc — elke formule uit Financieel_Overzicht_2_0.xlsx als pure functie.
///
/// Dit is de serverkant van frontend/src/domain/calc.ts: identieke formules,
/// identieke bewerkingsvolgorde (beide IEEE-754 doubles), identieke JSON-vorm.
/// Wijzig je hier iets, wijzig dan ook calc.ts — en andersom.
/// Percentages zijn fracties (0.038 = 3,8%); bedragen zijn euro's als double.
/// </summary>
public static class Calc
{
    static readonly string[] MonthKeys =
        ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

    static readonly CultureInfo Nl = CultureInfo.GetCultureInfo("nl-NL");

    /// <summary>JS Math.round rondt halven naar boven; .NET standaard half-even. Spiegel JS.</summary>
    static double JsRound(double v) => Math.Floor(v + 0.5);

    static double Clamp01(double v) => Math.Max(0, Math.Min(1, v));

    /// <summary>Zelfde uitvoer als Intl.NumberFormat("nl-NL", percent, 1 decimaal): "12,3%".</summary>
    public static string FormatPct(double fraction) =>
        (fraction * 100).ToString("#,0.0", Nl) + "%";

    // ---------------------------------------------------------------- cashflow

    public static double TotalIncomePerMonth(FinancialState s) =>
        s.Incomes.Sum(i => i.AmountPerMonth);

    public static double TotalFixedExpensesPerMonth(FinancialState s) =>
        s.FixedExpenses.Sum(e => e.AmountPerMonth);

    public static double TotalInvestingPerMonth(FinancialState s) =>
        s.Portfolio.MonthlyContributions.Sum(c => c.AmountPerMonth);

    public static double SavingsRoomPerMonth(FinancialState s) =>
        TotalIncomePerMonth(s) - TotalFixedExpensesPerMonth(s) - TotalInvestingPerMonth(s);

    public static double SavingsRate(FinancialState s)
    {
        var income = TotalIncomePerMonth(s);
        if (income <= 0) return 0;
        return SavingsRoomPerMonth(s) / income;
    }

    public static double SetAsidePerYear(FinancialState s) =>
        12 * (TotalInvestingPerMonth(s) + SavingsRoomPerMonth(s));

    public static double TotalVariableExpensesPerMonth(FinancialState s) =>
        s.MonthOverview.VariableExpenses.Sum(c => c.BudgetPerMonth ?? 0);

    public static List<CategoryRowDto> FixedExpensesByCategory(FinancialState s)
    {
        var total = TotalFixedExpensesPerMonth(s);
        var order = new List<string>();
        var map = new Dictionary<string, double>();
        foreach (var e in s.FixedExpenses)
        {
            var key = string.IsNullOrEmpty(e.Category) ? "Overig" : e.Category;
            if (!map.ContainsKey(key)) { order.Add(key); map[key] = 0; }
            map[key] += e.AmountPerMonth;
        }
        return order
            .Select(k => new CategoryRowDto(k, map[k], map[k] * 12, total != 0 ? map[k] / total : 0))
            .OrderByDescending(r => r.PerMonth)
            .ToList();
    }

    // ---------------------------------------------------------------- maandoverzicht

    public static List<MonthColumnDto> MonthColumns(FinancialState s)
    {
        var income = TotalIncomePerMonth(s);
        var fixedPm = TotalFixedExpensesPerMonth(s);
        var invested = TotalInvestingPerMonth(s);
        double cumulative = 0;
        var rows = new List<MonthColumnDto>();
        foreach (var month in MonthKeys)
        {
            var variable = s.MonthOverview.VariableExpenses.Sum(
                cat => cat.Actuals.TryGetValue(month, out var v) ? v ?? 0 : 0);
            var totalSpent = fixedPm + variable;
            var saved = income - totalSpent - invested;
            cumulative += saved;
            rows.Add(new MonthColumnDto(
                month, income, fixedPm, variable, totalSpent, invested, saved,
                income > 0 ? saved / income : 0, cumulative));
        }
        return rows;
    }

    // ---------------------------------------------------------------- portefeuille

    public static PortfolioDerivedDto PortfolioDerived(FinancialState s)
    {
        var basis = s.Portfolio.Holdings.Select(h =>
        {
            var invested = (h.Quantity ?? 0) * (h.AvgBuyPrice ?? 0);
            var value = (h.Quantity ?? 0) * (h.CurrentPrice ?? 0);
            return (holding: h, invested, value, resultEur: value - invested);
        }).ToList();
        var totalInvested = basis.Sum(x => x.invested);
        var totalValue = basis.Sum(x => x.value);
        var holdings = basis.Select(x => new HoldingDerivedDto(
            x.holding.Id, x.holding.Platform, x.holding.Name, x.holding.Ticker,
            x.holding.Quantity, x.holding.AvgBuyPrice, x.holding.CurrentPrice,
            x.invested, x.value, x.resultEur,
            x.invested > 0 ? x.resultEur / x.invested : null,
            totalValue > 0 ? x.value / totalValue : 0)).ToList();
        return new PortfolioDerivedDto(
            holdings, totalInvested, totalValue,
            totalValue - totalInvested,
            totalInvested > 0 ? (totalValue - totalInvested) / totalInvested : null);
    }

    // ---------------------------------------------------------------- beleggingsklassen

    public static string AssetClassOf(string platform)
    {
        var p = platform.ToLowerInvariant();
        if (p.Contains("bitvavo") || p.Contains("crypto") || p.Contains("coinbase") || p.Contains("kraken"))
            return "Crypto";
        if (p.Contains("mintos") || p.Contains("bondora") || p.Contains("p2p") || p.Contains("peerberry"))
            return "P2P-leningen";
        if (p.Contains("degiro") || p.Contains("trading") || p.Contains("212") || p.Contains("broker")
            || p.Contains("etf") || p.Contains("meesman") || p.Contains("brand new day"))
            return "Aandelen & ETF's";
        return "Overig";
    }

    public static List<AllocationDto> AllocationByClass(FinancialState s)
    {
        var pf = PortfolioDerived(s);
        var order = new List<string>();
        var map = new Dictionary<string, double>();
        foreach (var h in pf.Holdings)
        {
            var k = AssetClassOf(h.Platform);
            if (!map.ContainsKey(k)) { order.Add(k); map[k] = 0; }
            map[k] += h.Value;
        }
        return order
            .Select(k => new AllocationDto(k, map[k], pf.TotalValue > 0 ? map[k] / pf.TotalValue : 0))
            .Where(x => x.Value > 0)
            .OrderByDescending(x => x.Value)
            .ToList();
    }

    // ---------------------------------------------------------------- prognose

    public static List<ForecastYearRowDto> ForecastTable(ForecastAssumptions f, ForecastDefaultsDto defaults)
    {
        var start = f.StartValueOverride ?? defaults.StartValue;
        var monthly = f.MonthlyContributionOverride ?? defaults.MonthlyContribution;
        var rMonth = f.ExpectedReturnPerYear / 12;
        var rows = new List<ForecastYearRowDto>
        {
            new(0, start, 0, start, start, start),
        };
        var value = start;
        var totalContributed = start;
        for (var y = 1; y <= f.HorizonYears; y++)
        {
            var startValue = value;
            for (var m = 0; m < 12; m++) value = value * (1 + rMonth) + monthly;
            totalContributed += monthly * 12;
            rows.Add(new ForecastYearRowDto(
                y, startValue, monthly * 12, value, totalContributed,
                value / Math.Pow(1 + f.InflationPerYear, y)));
        }
        return rows;
    }

    public static double ForecastScenario(
        double startValue, double monthlyContribution, double returnPerYear, double years)
    {
        var rMonth = returnPerYear / 12;
        var value = startValue;
        for (var m = 0; m < years * 12; m++) value = value * (1 + rMonth) + monthlyContribution;
        return value;
    }

    public static int? MonthsToReachTarget(
        double start, double monthlyContribution, double returnPerYear, double target)
    {
        if (target <= start) return 0;
        var rMonth = returnPerYear / 12;
        var value = start;
        const int maxMonths = 100 * 12;
        for (var m = 1; m <= maxMonths; m++)
        {
            value = value * (1 + rMonth) + monthlyContribution;
            if (value >= target) return m;
        }
        return null;
    }

    // ---------------------------------------------------------------- hypotheek

    public static double AnnuityPayment(double principal, double ratePerYear, double years)
    {
        var i = ratePerYear / 12;
        var n = years * 12;
        if (n <= 0) return 0;
        if (i == 0) return principal / n;
        return principal * i / (1 - Math.Pow(1 + i, -n));
    }

    public static List<AmortizationRowDto> AmortizationSchedule(MortgageInputs m)
    {
        var payment = m.MonthlyPaymentOverride ?? AnnuityPayment(
            m.PrincipalRemaining, m.InterestRatePerYear, m.RemainingTermYears);
        var i = m.InterestRatePerYear / 12;
        var maxMonths = m.RemainingTermYears * 12;
        var parts = m.FirstPaymentMonth.Split('-');
        var y0 = parts.Length > 0 && int.TryParse(parts[0], out var py) ? py : 0;
        var mo0 = parts.Length > 1 && int.TryParse(parts[1], out var pm) ? pm : 1;
        var rows = new List<AmortizationRowDto>();
        var balance = m.PrincipalRemaining;
        for (var k = 0; k < maxMonths && balance > 0.005; k++)
        {
            var interest = balance * i;
            var principal = Math.Min(payment - interest, balance);
            if (principal < 0) principal = 0; // betaling onder rente: saldo groeit — UI toont dit
            var extra = Math.Min(m.ExtraRepaymentPerMonth, balance - principal);
            if (extra < 0) extra = 0;
            var end = balance - principal - extra;
            var total = mo0 - 1 + k;
            var date = $"{y0 + total / 12}-{(total % 12) + 1:00}";
            rows.Add(new AmortizationRowDto(
                k + 1, date, balance, interest, principal, extra, Math.Max(end, 0)));
            balance = Math.Max(end, 0);
        }
        return rows;
    }

    public static MortgageSummaryDto MortgageSummary(MortgageInputs m)
    {
        var computedAnnuity = AnnuityPayment(m.PrincipalRemaining, m.InterestRatePerYear, m.RemainingTermYears);
        var usedPayment = m.MonthlyPaymentOverride ?? computedAnnuity;
        var schedule = AmortizationSchedule(m);
        var first = schedule.FirstOrDefault();
        return new MortgageSummaryDto(
            computedAnnuity,
            usedPayment,
            m.HomeMarketValue - m.PrincipalRemaining,
            m.HomeMarketValue > 0 ? m.PrincipalRemaining / m.HomeMarketValue : 0,
            first?.Interest ?? 0,
            first?.Principal ?? 0,
            usedPayment - m.InterestDeductionPerMonth,
            schedule.Sum(r => r.Interest),
            schedule.Count > 0 ? schedule[^1].Date : null);
    }

    public static List<MortgageYearRowDto> MortgagePerYear(MortgageInputs m)
    {
        var schedule = AmortizationSchedule(m);
        var outRows = new List<MortgageYearRowDto>
        {
            new(0, m.PrincipalRemaining, m.HomeMarketValue - m.PrincipalRemaining),
        };
        for (var y = 1; y * 12 <= schedule.Count; y++)
        {
            var balance = schedule[y * 12 - 1].EndBalance;
            outRows.Add(new MortgageYearRowDto(y, balance, m.HomeMarketValue - balance));
        }
        return outRows;
    }

    // ---------------------------------------------------------------- schulden

    public static double TotalDebt(IEnumerable<Debt> debts) =>
        debts.Sum(d => d.PrincipalRemaining);

    public static double TotalDebtExclMortgage(IEnumerable<Debt> debts) =>
        debts.Where(d => !d.LinkedToMortgage).Sum(d => d.PrincipalRemaining);

    public static double TotalDebtPaymentPerMonth(IEnumerable<Debt> debts) =>
        debts.Sum(d => d.MonthlyPayment);

    // ---------------------------------------------------------------- vermogen

    public static NetWorthDerivedDto NetWorthDerived(FinancialState s)
    {
        var pf = PortfolioDerived(s);
        double cryptoValue = 0, p2pValue = 0;
        foreach (var h in pf.Holdings)
        {
            var k = AssetClassOf(h.Platform);
            if (k == "Crypto") cryptoValue += h.Value;
            else if (k == "P2P-leningen") p2pValue += h.Value;
        }
        var brokerValue = pf.TotalValue - cryptoValue - p2pValue;

        var assets = new List<NetWorthAssetDto>
        {
            new("Betaalrekening(en)", s.NetWorth.ManualAssets.CheckingAccounts ?? 0, false),
            new("Spaarrekening(en)", s.NetWorth.ManualAssets.SavingsAccounts ?? 0, false),
            new("Beleggingen", brokerValue, true),
            new("Crypto", cryptoValue, true),
        };
        if (p2pValue > 0) assets.Add(new NetWorthAssetDto("P2P-leningen", p2pValue, true));
        assets.Add(new NetWorthAssetDto("Woning (marktwaarde)", s.Mortgage.HomeMarketValue, true));
        assets.Add(new NetWorthAssetDto("Overige bezittingen", s.NetWorth.ManualAssets.OtherAssets ?? 0, false));

        var liabilities = s.Debts.Select(d => new NetWorthLiabilityDto(d.Description, d.PrincipalRemaining)).ToList();
        var totalAssets = assets.Sum(a => a.Value);
        var totalLiabilities = liabilities.Sum(l => l.Value);
        return new NetWorthDerivedDto(assets, totalAssets, liabilities, totalLiabilities, totalAssets - totalLiabilities);
    }

    // ---------------------------------------------------------------- spaardoelen

    public static SavingsGoalsDerivedDto SavingsGoalsDerived(FinancialState s)
    {
        var availablePerMonth = SavingsRoomPerMonth(s);
        var sixMonthsFixed = 6 * TotalFixedExpensesPerMonth(s);
        var goals = s.SavingsGoals.Select(g =>
        {
            var effectiveTarget = g.TargetAmount ?? (g.IsEmergencyFund ? sixMonthsFixed : 0);
            var saved = g.SavedSoFar ?? 0;
            var stillNeeded = Math.Max(effectiveTarget - saved, 0);
            var perMonth = g.ContributionPerMonth ?? 0;
            return new SavingsGoalDerivedDto(
                g.Id, g.Name, g.TargetAmount, g.SavedSoFar, g.ContributionPerMonth, g.IsEmergencyFund,
                effectiveTarget, stillNeeded,
                perMonth > 0 ? (int)Math.Ceiling(stillNeeded / perMonth) : null,
                effectiveTarget > 0 ? Math.Min(saved / effectiveTarget, 1) : 0);
        }).ToList();
        var plannedPerMonth = goals.Sum(g => g.ContributionPerMonth ?? 0);
        return new SavingsGoalsDerivedDto(goals, availablePerMonth, plannedPerMonth, availablePerMonth - plannedPerMonth);
    }

    // ---------------------------------------------------------------- box 3

    /// <summary>2026: vrijstelling €59.357 p.p., tarief 36%; banktegoeden 1,28%, schulden 2,70%, beleggingen 6,00%.</summary>
    public static (double ExemptionPerPerson, double RateSavings, double RateInvestments,
        double RateDebts, double DebtThresholdPerPerson, double TaxRate) Box3Params2026 =>
        (59357, 0.0128, 0.06, 0.027, 3900, 0.36);

    public static Box3ResultDto Box3Estimate(FinancialState s, bool partners)
    {
        var p = Box3Params2026;
        var pf = PortfolioDerived(s);
        var m = s.NetWorth.ManualAssets;
        var savings = (m.CheckingAccounts ?? 0) + (m.SavingsAccounts ?? 0);
        var investments = pf.TotalValue + (m.OtherAssets ?? 0);
        var mult = partners ? 2 : 1;
        var deductibleDebt = Math.Max(TotalDebtExclMortgage(s.Debts) - p.DebtThresholdPerPerson * mult, 0);
        var rendementsgrondslag = Math.Max(savings + investments - deductibleDebt, 0);
        var exemption = p.ExemptionPerPerson * mult;
        var taxableBase = Math.Max(rendementsgrondslag - exemption, 0);
        var forfaitairRendement = Math.Max(
            savings * p.RateSavings + investments * p.RateInvestments - deductibleDebt * p.RateDebts, 0);
        var share = rendementsgrondslag > 0 ? taxableBase / rendementsgrondslag : 0;
        var tax = JsRound(forfaitairRendement * share * p.TaxRate * 100) / 100;
        return new Box3ResultDto(
            savings, investments, deductibleDebt, rendementsgrondslag, exemption, taxableBase, forfaitairRendement, tax);
    }

    // ---------------------------------------------------------------- extra aflossen vs beleggen

    public static RepayVsInvestDto RepayVsInvest(MortgageInputs m, double extraPerMonth, double returnPerYear)
    {
        var baseSchedule = AmortizationSchedule(m);
        var withExtra = AmortizationSchedule(new MortgageInputs
        {
            HomeMarketValue = m.HomeMarketValue,
            PurchasePrice = m.PurchasePrice,
            PrincipalRemaining = m.PrincipalRemaining,
            InterestRatePerYear = m.InterestRatePerYear,
            RemainingTermYears = m.RemainingTermYears,
            FirstPaymentMonth = m.FirstPaymentMonth,
            ExtraRepaymentPerMonth = m.ExtraRepaymentPerMonth + extraPerMonth,
            MonthlyPaymentOverride = m.MonthlyPaymentOverride,
            InterestDeductionPerMonth = m.InterestDeductionPerMonth,
        });
        var interestSaved = baseSchedule.Sum(r => r.Interest) - withExtra.Sum(r => r.Interest);
        var horizonMonths = baseSchedule.Count;
        var rMonth = returnPerYear / 12;
        double investEndValue = 0;
        for (var i = 0; i < horizonMonths; i++) investEndValue = investEndValue * (1 + rMonth) + extraPerMonth;
        var invested = extraPerMonth * horizonMonths;
        return new RepayVsInvestDto(
            interestSaved, baseSchedule.Count - withExtra.Count, horizonMonths,
            invested, investEndValue, investEndValue - invested);
    }

    // ---------------------------------------------------------------- dashboard

    public static DashboardDto Dashboard(FinancialState s)
    {
        var pf = PortfolioDerived(s);
        var nw = NetWorthDerived(s);
        var mg = MortgageSummary(s.Mortgage);
        var goals = SavingsGoalsDerived(s);
        var emergency = goals.Goals.FirstOrDefault(g => g.IsEmergencyFund);
        var forecastRows = ForecastTable(s.Forecast, new ForecastDefaultsDto(pf.TotalValue, TotalInvestingPerMonth(s)));
        var forecastEnd = forecastRows.Count > 0 ? forecastRows[^1] : null;

        var liquidSavings =
            (s.NetWorth.ManualAssets.CheckingAccounts ?? 0) + (s.NetWorth.ManualAssets.SavingsAccounts ?? 0);

        // Netto vermogen minus overwaarde eigen woning: de pot waar een
        // 4%-regel-onttrekking echt uit komt.
        var investableNetWorth =
            nw.TotalAssets - s.Mortgage.HomeMarketValue - TotalDebtExclMortgage(s.Debts);

        return new DashboardDto(
            TotalIncomePerMonth(s),
            TotalFixedExpensesPerMonth(s),
            TotalVariableExpensesPerMonth(s),
            TotalFixedExpensesPerMonth(s) + TotalVariableExpensesPerMonth(s),
            TotalInvestingPerMonth(s),
            SavingsRoomPerMonth(s),
            SavingsRate(s),
            SetAsidePerYear(s),
            pf.TotalValue,
            nw.NetWorth,
            investableNetWorth,
            liquidSavings,
            forecastEnd?.EndValue ?? 0,
            s.Forecast.HorizonYears,
            s.Forecast.ExpectedReturnPerYear,
            emergency?.Progress ?? 0,
            s.Mortgage.HomeMarketValue,
            s.Mortgage.PrincipalRemaining,
            mg.Equity,
            mg.LoanToValue,
            TotalDebtExclMortgage(s.Debts),
            mg.NetHousingCostPerMonth);
    }

    // ---------------------------------------------------------------- financiële gezondheid

    public static FinancialHealthDto FinancialHealth(FinancialState s)
    {
        var d = Dashboard(s);
        var income = d.IncomePerMonth != 0 ? d.IncomePerMonth : 1;

        var spaarRate = (d.InvestingPerMonth + Math.Max(d.SavingsRoomPerMonth, 0)) / income;
        var woonRatio = d.NetHousingCostPerMonth / income;
        var vastRatio = d.FixedPerMonth / income;
        var bufferMonths = d.TotalExpensesPerMonth > 0 ? d.PortfolioValue / d.TotalExpensesPerMonth : 0;

        var raw = new (string Key, string Label, double Weight, double Score01, string Detail)[]
        {
            ("noodfonds", "Noodfonds", 0.25, Clamp01(d.EmergencyFundProgress),
                $"{FormatPct(d.EmergencyFundProgress)} van 6× maandlasten (Nibud: 4–5 maandsalarissen voor een gezin)"),
            ("sparen", "Sparen & beleggen", 0.25, Clamp01(spaarRate / 0.2),
                $"{FormatPct(spaarRate)} van je inkomen (Nibud-minimum 10%, 20%+ is uitstekend)"),
            ("wonen", "Woonquote", 0.2, Clamp01((0.45 - woonRatio) / 0.15),
                $"{FormatPct(woonRatio)} van je inkomen naar wonen (≤30% gezond, >40% risicovol)"),
            ("vast", "Vaste lasten", 0.15, Clamp01((0.65 - vastRatio) / 0.2),
                $"{FormatPct(vastRatio)} van je inkomen ligt vast (Nibud-richtlijn: max ±50%)"),
            ("vermogen", "Vermogensbuffer", 0.15, Clamp01(bufferMonths / 12),
                $"belegd vermogen dekt {bufferMonths.ToString("0.0", CultureInfo.InvariantCulture)} maanden uitgaven (12+ = sterk)"),
        };
        var subscores = raw
            .Select(x => new HealthSubscoreDto(x.Key, x.Label, (int)JsRound(x.Score01 * 100), x.Detail))
            .ToList();
        var score = (int)JsRound(raw.Sum(x => x.Score01 * 100 * x.Weight));
        var label = score >= 80 ? "Uitstekend" : score >= 60 ? "Goed" : score >= 40 ? "Redelijk" : "Aandacht nodig";
        return new FinancialHealthDto(score, label, subscores);
    }

    // ---------------------------------------------------------------- schuldenplanner

    /// <summary>
    /// Simuleer het aflossen van alle schulden (excl. hypotheek) met rollover:
    /// vrijgekomen maandbedragen plus extraPerMonth gaan naar de doelschuld.
    /// strategy: "sneeuwbal" (kleinste saldo eerst) of "lawine" (hoogste rente eerst).
    /// Spiegel van debtStrategy in calc.ts — identieke bewerkingsvolgorde.
    /// </summary>
    public static DebtStrategyResultDto DebtStrategy(
        IEnumerable<Debt> debts, double extraPerMonth, string strategy)
    {
        var sim = debts
            .Where(d => !d.LinkedToMortgage && d.PrincipalRemaining > 0)
            .Select(d => new DebtSim
            {
                Id = d.Id,
                Description = d.Description,
                Balance = d.PrincipalRemaining,
                RateMonth = d.InterestRatePerYear / 12,
                Payment = d.MonthlyPayment,
            })
            .ToList();
        if (sim.Count == 0) return new DebtStrategyResultDto([], 0, 0);

        int PickTarget()
        {
            var best = -1;
            for (var i = 0; i < sim.Count; i++)
            {
                if (sim[i].Balance <= 0.005) continue;
                if (best < 0) { best = i; continue; }
                var better = strategy == "sneeuwbal"
                    ? sim[i].Balance < sim[best].Balance
                    : sim[i].RateMonth > sim[best].RateMonth;
                if (better) best = i;
            }
            return best;
        }

        const int maxMonths = 50 * 12;
        var month = 0;
        while (month < maxMonths)
        {
            var targetIdx = PickTarget();
            if (targetIdx < 0) break;
            month++;
            var freed = sim.Where(d => d.Balance <= 0.005).Sum(d => d.Payment);
            for (var i = 0; i < sim.Count; i++)
            {
                var d = sim[i];
                if (d.Balance <= 0.005) continue;
                var interest = d.Balance * d.RateMonth;
                d.InterestPaid += interest;
                var pay = d.Payment + (i == targetIdx ? extraPerMonth + freed : 0);
                d.Balance = Math.Max(d.Balance + interest - pay, 0);
                if (d.Balance <= 0.005)
                {
                    d.Balance = 0;
                    d.PayoffMonth = month;
                }
            }
        }

        var allPaid = sim.All(d => d.Balance <= 0.005);
        return new DebtStrategyResultDto(
            sim.Select(d => new DebtPlanRowDto(d.Id, d.Description, d.PayoffMonth, d.InterestPaid)).ToList(),
            allPaid ? month : null,
            sim.Sum(d => d.InterestPaid));
    }

    private sealed class DebtSim
    {
        public string Id = "";
        public string Description = "";
        public double Balance;
        public double RateMonth;
        public double Payment;
        public double InterestPaid;
        public int PayoffMonth;
    }

    /// <summary>
    /// Per schuld: €X p/m extra aflossen vs hetzelfde bedrag beleggen over de
    /// basislooptijd. Spiegel van debtRepayVsInvest in calc.ts.
    /// </summary>
    public static DebtRepayVsInvestDto DebtRepayVsInvest(Debt debt, double extraPerMonth, double returnPerYear)
    {
        const int maxMonths = 50 * 12;
        var rMonth = debt.InterestRatePerYear / 12;

        (int? Months, double Interest) Sim(double extra)
        {
            var balance = debt.PrincipalRemaining;
            double interest = 0;
            var m = 0;
            while (balance > 0.005 && m < maxMonths)
            {
                m++;
                var i = balance * rMonth;
                interest += i;
                balance = Math.Max(balance + i - (debt.MonthlyPayment + extra), 0);
            }
            return (balance <= 0.005 ? m : null, interest);
        }

        var baseRun = Sim(0);
        var withExtra = Sim(extraPerMonth);

        var horizon = baseRun.Months ?? maxMonths;
        var rInvest = returnPerYear / 12;
        double investEndValue = 0;
        for (var i = 0; i < horizon; i++) investEndValue = investEndValue * (1 + rInvest) + extraPerMonth;
        var invested = extraPerMonth * horizon;

        return new DebtRepayVsInvestDto(
            baseRun.Months,
            baseRun.Interest,
            withExtra.Months,
            withExtra.Interest,
            baseRun.Interest - withExtra.Interest,
            (baseRun.Months ?? maxMonths) - (withExtra.Months ?? maxMonths),
            invested,
            investEndValue,
            investEndValue - invested);
    }

    // ---------------------------------------------------------------- alles-in-één bundel

    /// <summary>
    /// Alle afgeleide cijfers voor één statusdocument in één antwoord —
    /// het antwoord van POST /api/derive dat de frontend cachet.
    /// </summary>
    public static DerivedBundle Derive(FinancialState s)
    {
        var pf = PortfolioDerived(s);
        var forecastDefaults = new ForecastDefaultsDto(pf.TotalValue, TotalInvestingPerMonth(s));
        var d = Dashboard(s);

        var fireRequired = d.TotalExpensesPerMonth * 12 * 25;
        var fireMonths = MonthsToReachTarget(
            d.InvestableNetWorth, d.InvestingPerMonth + d.SavingsRoomPerMonth,
            d.ExpectedReturnPerYear, fireRequired);
        var fireProgress = fireRequired > 0 ? Math.Max(Math.Min(d.InvestableNetWorth / fireRequired, 1), 0) : 0;

        return new DerivedBundle(
            d,
            FinancialHealth(s),
            MonthColumns(s),
            FixedExpensesByCategory(s),
            pf,
            AllocationByClass(s),
            NetWorthDerived(s),
            SavingsGoalsDerived(s),
            ForecastTable(s.Forecast, forecastDefaults),
            forecastDefaults,
            new MortgageBundleDto(
                MortgageSummary(s.Mortgage), MortgagePerYear(s.Mortgage), AmortizationSchedule(s.Mortgage)),
            new Box3BundleDto(Box3Estimate(s, partners: false), Box3Estimate(s, partners: true)),
            new TotalsDto(
                TotalIncomePerMonth(s),
                TotalFixedExpensesPerMonth(s),
                TotalInvestingPerMonth(s),
                TotalVariableExpensesPerMonth(s),
                SavingsRoomPerMonth(s),
                SavingsRate(s),
                SetAsidePerYear(s),
                TotalDebt(s.Debts),
                TotalDebtExclMortgage(s.Debts),
                TotalDebtPaymentPerMonth(s.Debts)),
            new FireDto(fireRequired, fireMonths, fireProgress));
    }
}
