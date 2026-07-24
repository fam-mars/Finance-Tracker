import { useState } from "react";
import {
  amortizationSchedule, debtPayoffDate, formatPct, mortgagePerYear, mortgageSummary,
  totalDebt, totalDebtExclMortgage, totalDebtPaymentPerMonth,
} from "../domain/calc";
import type { FinancialState } from "../domain/types";
import { EditableNumber, Money, Segments } from "../components/ui";
import { useSync } from "../state/SyncContext";

type Section = "hypotheek" | "schema" | "schulden";

export function Wonen({ state }: { state: FinancialState }) {
  const [section, setSection] = useState<Section>("hypotheek");
  return (
    <main className="screen">
      <h1 className="screen-title">Wonen &amp; schulden</h1>
      <p className="screen-sub">Hypotheek, aflosschema en alle schulden op één plek.</p>
      <Segments
        options={[
          { id: "hypotheek", label: "Hypotheek" },
          { id: "schema", label: "Aflosschema" },
          { id: "schulden", label: "Schulden" },
        ]}
        value={section}
        onChange={setSection}
      />
      {section === "hypotheek" && <Mortgage state={state} />}
      {section === "schema" && <Schedule state={state} />}
      {section === "schulden" && <Debts state={state} />}
    </main>
  );
}

function Mortgage({ state }: { state: FinancialState }) {
  const { update } = useSync();
  const m = state.mortgage;
  const sum = mortgageSummary(m);
  const patch = (p: Partial<typeof m>) =>
    update((s) => ({ ...s, mortgage: { ...s.mortgage, ...p } }));

  return (
    <>
      <section className="card">
        <h2 className="card-title">Woning</h2>
        <div className="row">
          <span className="row-label">Marktwaarde / WOZ</span>
          <EditableNumber value={m.homeMarketValue} ariaLabel="Marktwaarde woning"
            onCommit={(v) => patch({ homeMarketValue: v ?? 0 })} />
        </div>
        <div className="row">
          <span className="row-label">Overwaarde</span>
          <span className="money money--pos"><Money value={sum.equity} /></span>
        </div>
        <div className="row">
          <span className="row-label">Loan-to-value
            <span className="row-sub">onder 90%? vaak lagere renteopslag</span>
          </span>
          <span className="money">{formatPct(sum.loanToValue)}</span>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Hypotheek (annuïteit)</h2>
        <div className="row">
          <span className="row-label">Restschuld</span>
          <EditableNumber value={m.principalRemaining} ariaLabel="Restschuld hypotheek"
            onCommit={(v) => patch({ principalRemaining: v ?? 0 })} />
        </div>
        <div className="row">
          <span className="row-label">Rente per jaar (%)</span>
          <EditableNumber value={m.interestRatePerYear * 100} ariaLabel="Hypotheekrente in procenten"
            onCommit={(v) => patch({ interestRatePerYear: (v ?? 0) / 100 })} />
        </div>
        <div className="row">
          <span className="row-label">Resterende looptijd (jaren)</span>
          <EditableNumber value={m.remainingTermYears} ariaLabel="Resterende looptijd in jaren"
            onCommit={(v) => patch({ remainingTermYears: Math.max(1, Math.round(v ?? 0)) })} />
        </div>
        <div className="row">
          <span className="row-label">Extra aflossing p/m
            <span className="row-sub">effect zie je direct in het schema</span>
          </span>
          <EditableNumber value={m.extraRepaymentPerMonth} ariaLabel="Extra aflossing per maand"
            onCommit={(v) => patch({ extraRepaymentPerMonth: v ?? 0 })} />
        </div>
        <div className="row">
          <span className="row-label">Maandbedrag
            <span className="row-sub">berekend: <Money value={sum.computedAnnuity} cents /> — overtyp als je echte bedrag afwijkt</span>
          </span>
          <EditableNumber value={m.monthlyPaymentOverride} allowNull ariaLabel="Gebruikt maandbedrag"
            onCommit={(v) => patch({ monthlyPaymentOverride: v })} />
        </div>
        <div className="row">
          <span className="row-label">Renteaftrek p/m (teruggave)</span>
          <EditableNumber value={m.interestDeductionPerMonth} ariaLabel="Renteaftrek per maand"
            onCommit={(v) => patch({ interestDeductionPerMonth: v ?? 0 })} />
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Kerngetallen</h2>
        <div className="row"><span className="row-label">Rente eerste maand</span><Money value={sum.firstMonthInterest} cents /></div>
        <div className="row"><span className="row-label">Aflossing eerste maand</span><Money value={sum.firstMonthPrincipal} cents /></div>
        <div className="row">
          <span className="row-label">Netto woonlast p/m
            <span className="row-sub">maandbedrag minus renteaftrek</span>
          </span>
          <strong><Money value={sum.netHousingCostPerMonth} cents /></strong>
        </div>
        <div className="row"><span className="row-label">Totale rente restant looptijd</span><Money value={sum.totalRemainingInterest} /></div>
        <div className="row"><span className="row-label">Hypotheekvrij in</span><span className="money">{sum.payoffDate ?? "—"}</span></div>
      </section>
    </>
  );
}

function Schedule({ state }: { state: FinancialState }) {
  const perYear = mortgagePerYear(state.mortgage);
  const schedule = amortizationSchedule(state.mortgage);
  const [showAllMonths, setShowAllMonths] = useState(false);
  const months = showAllMonths ? schedule : schedule.slice(0, 12);

  return (
    <>
      <section className="card">
        <h2 className="card-title">Restschuld &amp; overwaarde per jaar</h2>
        {perYear.filter((r) => r.year % 5 === 0 || r.year === perYear.length - 1).map((r) => (
          <div className="row" key={r.year}>
            <span className="row-label">Jaar {r.year}</span>
            <span>
              <Money value={r.balance} />{" "}
              <span className="money money--pos" style={{ fontSize: "var(--text-xs)" }}>
                +<Money value={r.equity} />
              </span>
            </span>
          </div>
        ))}
      </section>

      <section className="card">
        <h2 className="card-title">Per maand</h2>
        {months.map((r) => (
          <div className="row" key={r.monthIndex}>
            <span className="row-label">{r.date}
              <span className="row-sub">rente <Money value={r.interest} cents /> · aflossing <Money value={r.principal + r.extra} cents /></span>
            </span>
            <Money value={r.endBalance} />
          </div>
        ))}
        {!showAllMonths && schedule.length > 12 && (
          <button className="btn btn-ghost" onClick={() => setShowAllMonths(true)}>
            Toon alle {schedule.length} maanden
          </button>
        )}
      </section>
    </>
  );
}

function Debts({ state }: { state: FinancialState }) {
  const { update } = useSync();
  const fmtDate = new Intl.DateTimeFormat("nl-NL", { month: "short", year: "numeric" });
  return (
    <>
      {state.debts.map((d) => {
        const payoff = debtPayoffDate(d);
        return (
          <section className="card" key={d.id}>
            <h2 className="card-title">
              {d.description}{d.lender ? ` · ${d.lender}` : ""}{d.owner ? ` · ${d.owner}` : ""}
            </h2>
            {d.linkedToMortgage ? (
              <>
                <div className="row"><span className="row-label">Restschuld<span className="row-sub">automatisch uit Hypotheek</span></span><Money value={state.mortgage.principalRemaining} /></div>
                <div className="row"><span className="row-label">Rente p/j</span><span className="money">{formatPct(state.mortgage.interestRatePerYear)}</span></div>
              </>
            ) : (
              <>
                <div className="row">
                  <span className="row-label">Restschuld</span>
                  <EditableNumber value={d.principalRemaining} ariaLabel={`Restschuld ${d.description}`}
                    onCommit={(v) => update((s) => ({
                      ...s, debts: s.debts.map((x) => x.id === d.id ? { ...x, principalRemaining: v ?? 0 } : x),
                    }))} />
                </div>
                <div className="row">
                  <span className="row-label">Maandbedrag</span>
                  <EditableNumber value={d.monthlyPayment} ariaLabel={`Maandbedrag ${d.description}`}
                    onCommit={(v) => update((s) => ({
                      ...s, debts: s.debts.map((x) => x.id === d.id ? { ...x, monthlyPayment: v ?? 0 } : x),
                    }))} />
                </div>
              </>
            )}
            <div className="row">
              <span className="row-label">Klaar in</span>
              <span className="money">{payoff ? fmtDate.format(payoff) : "—"}</span>
            </div>
            {d.note ? <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-soft)", margin: "var(--sp-2) 0 0" }}>{d.note}</p> : null}
          </section>
        );
      })}

      <section className="card">
        <h2 className="card-title">Totaal</h2>
        <div className="row"><span className="row-label">Alle schulden</span><Money value={totalDebt(state.debts)} /></div>
        <div className="row"><span className="row-label">Excl. hypotheek</span><Money value={totalDebtExclMortgage(state.debts)} /></div>
        <div className="row"><span className="row-label">Maandlasten schulden</span><Money value={totalDebtPaymentPerMonth(state.debts)} cents /></div>
      </section>
    </>
  );
}
