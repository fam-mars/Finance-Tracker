import { dashboard, formatEUR, formatPct } from "../domain/calc";
import type { FinancialState } from "../domain/types";
import { Geldstroom, Money, Pct } from "../components/ui";
import { IncomeExpenseComparison, CategoryBreakdown, DebtSummary } from "../components/charts";

export function Dashboard({ state }: { state: FinancialState }) {
  const d = dashboard(state);

  return (
    <main className="screen">
      <h1 className="screen-title">Financieel overzicht</h1>
      <p className="screen-sub">Huishoudfinanciën — alles rekent automatisch.</p>

      {/* Signature: where does this month's income go? */}
      <section className="card" aria-labelledby="flow-title">
        <h2 className="card-title" id="flow-title">
          Geldstroom · {formatEUR(d.incomePerMonth)} per maand
        </h2>
        <Geldstroom
          income={d.incomePerMonth}
          lasten={d.fixedPerMonth}
          beleggen={d.investingPerMonth}
          sparen={d.savingsRoomPerMonth}
        />
        <p style={{ margin: "var(--sp-3) 0 0", fontSize: "var(--text-sm)", color: "var(--ink-soft)" }}>
          Spaarquote <strong className="money">{formatPct(d.savingsRate)}</strong> — je zet{" "}
          <Money value={d.setAsidePerYear} /> per jaar opzij.
        </p>
      </section>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">Netto vermogen</div>
          <div className="stat-value"><Money value={d.netWorth} /></div>
          <div className="stat-note">bezittingen − schulden</div>
        </div>
        <div className="stat">
          <div className="stat-label">Portefeuille</div>
          <div className="stat-value"><Money value={d.portfolioValue} /></div>
          <div className="stat-note">huidige waarde beleggingen</div>
        </div>
        <div className="stat">
          <div className="stat-label">Prognose</div>
          <div className="stat-value"><Money value={d.forecastValue} /></div>
          <div className="stat-note">over {d.forecastYears} jaar bij huidige inleg</div>
        </div>
        <div className="stat">
          <div className="stat-label">Noodfonds</div>
          <div className="stat-value"><Pct value={d.emergencyFundProgress} /></div>
          <div className="progress" style={{ marginTop: 6 }}
            role="progressbar" aria-valuenow={Math.round(d.emergencyFundProgress * 100)}
            aria-valuemin={0} aria-valuemax={100} aria-label="Noodfonds voortgang">
            <div className="progress-fill" style={{ width: `${d.emergencyFundProgress * 100}%` }} />
          </div>
          <div className="stat-note">doel: 6× maandlasten</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-3)", marginTop: "var(--sp-4)" }}>
        <IncomeExpenseComparison state={state} />
        <CategoryBreakdown state={state} />
      </div>

      {state.debts.length > 0 && (
        <div style={{ marginTop: "var(--sp-3)" }}>
          <DebtSummary state={state} />
        </div>
      )}

      <section className="card" style={{ marginTop: "var(--sp-4)" }} aria-labelledby="home-title">
        <h2 className="card-title" id="home-title">Wonen</h2>
        <div className="row">
          <span className="row-label">Woningwaarde</span>
          <Money value={d.homeValue} />
        </div>
        <div className="row">
          <span className="row-label">Restschuld hypotheek
            <span className="row-sub">LTV {formatPct(d.loanToValue)}</span>
          </span>
          <Money value={d.mortgageRemaining} />
        </div>
        <div className="row">
          <span className="row-label">Overwaarde</span>
          <span className="money money--pos">{formatEUR(d.homeEquity)}</span>
        </div>
        <div className="row">
          <span className="row-label">Netto woonlast p/m
            <span className="row-sub">hypotheek na renteaftrek</span>
          </span>
          <Money value={d.netHousingCostPerMonth} />
        </div>
        <div className="row">
          <span className="row-label">Overige schulden</span>
          <Money value={d.otherDebt} />
        </div>
      </section>
    </main>
  );
}
