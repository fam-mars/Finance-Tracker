import { useState } from "react";
import {
  fixedExpensesByCategory, formatPct, monthColumns,
  totalFixedExpensesPerMonth, totalIncomePerMonth,
} from "../domain/calc";
import type { FinancialState, MonthKey } from "../domain/types";
import { MONTH_KEYS } from "../domain/types";
import { EditableNumber, Money, Segments } from "../components/ui";
import { useSync } from "../state/SyncContext";

type Section = "inkomsten" | "lasten" | "maand";

export function Cashflow({ state }: { state: FinancialState }) {
  const [section, setSection] = useState<Section>("lasten");
  return (
    <main className="screen">
      <h1 className="screen-title">Cashflow</h1>
      <p className="screen-sub">Inkomsten, vaste lasten en het maandoverzicht.</p>
      <Segments
        options={[
          { id: "inkomsten", label: "Inkomsten" },
          { id: "lasten", label: "Vaste lasten" },
          { id: "maand", label: "Maandoverzicht" },
        ]}
        value={section}
        onChange={setSection}
      />
      {section === "inkomsten" && <Incomes state={state} />}
      {section === "lasten" && <FixedExpenses state={state} />}
      {section === "maand" && <MonthOverview state={state} />}
    </main>
  );
}

function Incomes({ state }: { state: FinancialState }) {
  const { update } = useSync();
  return (
    <section className="card">
      <h2 className="card-title">Netto inkomsten per maand</h2>
      {state.incomes.map((inc) => (
        <div className="row" key={inc.id}>
          <span className="row-label">
            {inc.source}
            {inc.note ? <span className="row-sub">{inc.note}</span> : null}
          </span>
          <EditableNumber
            value={inc.amountPerMonth}
            ariaLabel={`Bedrag per maand voor ${inc.source}`}
            onCommit={(v) => update((s) => ({
              ...s,
              incomes: s.incomes.map((x) => x.id === inc.id ? { ...x, amountPerMonth: v ?? 0 } : x),
            }))}
          />
        </div>
      ))}
      <div className="row">
        <strong className="row-label">Totaal</strong>
        <strong><Money value={totalIncomePerMonth(state)} cents /></strong>
      </div>
    </section>
  );
}

function FixedExpenses({ state }: { state: FinancialState }) {
  const { update } = useSync();
  const byCat = fixedExpensesByCategory(state);
  return (
    <>
      <section className="card">
        <h2 className="card-title">Per categorie</h2>
        {byCat.map((c) => (
          <div className="row" key={c.category}>
            <span className="row-label">
              {c.category}
              <span className="row-sub">{formatPct(c.share)} van het totaal</span>
            </span>
            <Money value={c.perMonth} cents />
          </div>
        ))}
        <div className="row">
          <strong className="row-label">Totaal vaste lasten</strong>
          <strong><Money value={totalFixedExpensesPerMonth(state)} cents /></strong>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Alle vaste lasten</h2>
        {state.fixedExpenses.map((e) => (
          <div className="row" key={e.id}>
            <span className="row-label">
              {e.description}
              <span className="row-sub">
                {e.category}{e.payDay ? ` · dag ${e.payDay}` : ""}{e.tag ? ` · ${e.tag}` : ""}
              </span>
            </span>
            <EditableNumber
              value={e.amountPerMonth}
              ariaLabel={`Bedrag per maand voor ${e.description}`}
              onCommit={(v) => update((s) => ({
                ...s,
                fixedExpenses: s.fixedExpenses.map((x) =>
                  x.id === e.id ? { ...x, amountPerMonth: v ?? 0 } : x),
              }))}
            />
          </div>
        ))}
      </section>
    </>
  );
}

function MonthOverview({ state }: { state: FinancialState }) {
  const { update } = useSync();
  const now = new Date();
  const currentKey = MONTH_KEYS[now.getMonth()];
  const [month, setMonth] = useState<MonthKey>(currentKey);
  const cols = monthColumns(state);
  const col = cols.find((c) => c.month === month)!;

  return (
    <>
      <div className="segments" role="group" aria-label="Kies maand">
        {MONTH_KEYS.map((m) => (
          <button key={m} className="segment" aria-pressed={month === m} onClick={() => setMonth(m)}>
            {m}
          </button>
        ))}
      </div>

      <section className="card">
        <h2 className="card-title">Variabele uitgaven · {month} {state.monthOverview.year}</h2>
        {state.monthOverview.variableExpenses.map((cat) => (
          <div className="row" key={cat.id}>
            <span className="row-label">{cat.category}</span>
            <EditableNumber
              value={cat.actuals[month] ?? null}
              allowNull
              ariaLabel={`${cat.category} in ${month}`}
              onCommit={(v) => update((s) => ({
                ...s,
                monthOverview: {
                  ...s.monthOverview,
                  variableExpenses: s.monthOverview.variableExpenses.map((x) =>
                    x.id === cat.id ? { ...x, actuals: { ...x.actuals, [month]: v } } : x),
                },
              }))}
            />
          </div>
        ))}
      </section>

      <section className="card">
        <h2 className="card-title">Resultaat {month}</h2>
        <div className="row"><span className="row-label">Inkomsten</span><Money value={col.income} cents /></div>
        <div className="row"><span className="row-label">Vaste lasten</span><Money value={col.fixed} cents /></div>
        <div className="row"><span className="row-label">Variabel</span><Money value={col.variable} cents /></div>
        <div className="row"><span className="row-label">Beleggen</span><Money value={col.invested} cents /></div>
        <div className="row">
          <span className="row-label">Gespaard
            <span className="row-sub">spaarquote {formatPct(col.savingsRate)}</span>
          </span>
          <Money value={col.saved} cents signed />
        </div>
        <div className="row">
          <span className="row-label">Cumulatief gespaard dit jaar</span>
          <Money value={col.cumulativeSaved} cents />
        </div>
      </section>
    </>
  );
}
