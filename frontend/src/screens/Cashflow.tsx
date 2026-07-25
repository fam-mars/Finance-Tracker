import { useState } from "react";
import {
  fixedExpensesByCategory, formatPct, monthColumns,
  totalFixedExpensesPerMonth, totalIncomePerMonth,
} from "../domain/calc";
import type { FinancialState, MonthKey } from "../domain/types";
import { MONTH_KEYS } from "../domain/types";
import { EditableNumber, Money, Segments } from "../components/ui";
import { useSync } from "../state/SyncContext";
import { ImportSection } from "./ImportBank";

type Section = "inkomsten" | "lasten" | "maand" | "import";

export function Cashflow({ state }: { state: FinancialState }) {
  const [section, setSection] = useState<Section>("lasten");
  return (
    <main className="screen">
      <h1 className="screen-title">Cashflow</h1>
      <p className="screen-sub">Inkomsten, vaste lasten, maandoverzicht en bankimport.</p>
      <Segments
        options={[
          { id: "inkomsten", label: "Inkomsten" },
          { id: "lasten", label: "Vaste lasten" },
          { id: "maand", label: "Maandoverzicht" },
          { id: "import", label: "Import" },
        ]}
        value={section}
        onChange={setSection}
      />
      {section === "inkomsten" && <Incomes state={state} />}
      {section === "lasten" && <FixedExpenses state={state} />}
      {section === "maand" && <MonthOverview state={state} />}
      {section === "import" && <ImportSection state={state} />}
    </main>
  );
}

function Incomes({ state }: { state: FinancialState }) {
  const { update } = useSync();
  const [newSource, setNewSource] = useState("");
  const addIncome = () => {
    if (!newSource.trim()) return;
    update((s) => ({
      ...s,
      incomes: [...s.incomes, { id: `inc-${Date.now()}`, source: newSource.trim(), amountPerMonth: 0, note: null }],
    }));
    setNewSource("");
  };
  return (
    <section className="card">
      <h2 className="card-title">Netto inkomsten per maand</h2>
      {state.incomes.map((inc) => (
        <div className="row" key={inc.id}>
          <span className="row-label">
            {inc.source}
            {inc.note ? <span className="row-sub">{inc.note}</span> : null}
          </span>
          <span style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
            <EditableNumber
              value={inc.amountPerMonth}
              ariaLabel={`Bedrag per maand voor ${inc.source}`}
              onCommit={(v) => update((s) => ({
                ...s,
                incomes: s.incomes.map((x) => x.id === inc.id ? { ...x, amountPerMonth: v ?? 0 } : x),
              }))}
            />
            <button onClick={() => update((s) => ({ ...s, incomes: s.incomes.filter((x) => x.id !== inc.id) }))}
              title={`Verwijder ${inc.source}`}
              style={{ border: "none", background: "#ffebee", color: "#c62828", borderRadius: 4, padding: "0.35rem 0.55rem", fontSize: "0.8rem", fontWeight: 600 }}>
              ✕
            </button>
          </span>
        </div>
      ))}
      <div className="row">
        <strong className="row-label">Totaal</strong>
        <strong><Money value={totalIncomePerMonth(state)} cents /></strong>
      </div>
      <div style={{ marginTop: "var(--sp-2)", display: "flex", gap: "0.5rem" }}>
        <input type="text" value={newSource} onChange={(e) => setNewSource(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addIncome()}
          placeholder="Nieuwe inkomstenbron…" aria-label="Nieuwe inkomstenbron"
          style={{ flex: 1, padding: "0.6rem", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", fontSize: 16 }} />
        <button className="btn btn-primary" disabled={!newSource.trim()} onClick={addIncome}>+</button>
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

      <BetaalKalender state={state} />

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
            <span style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
              <EditableNumber
                value={e.amountPerMonth}
                ariaLabel={`Bedrag per maand voor ${e.description}`}
                onCommit={(v) => update((s) => ({
                  ...s,
                  fixedExpenses: s.fixedExpenses.map((x) =>
                    x.id === e.id ? { ...x, amountPerMonth: v ?? 0 } : x),
                }))}
              />
              <button onClick={() => update((s) => ({ ...s, fixedExpenses: s.fixedExpenses.filter((x) => x.id !== e.id) }))}
                title={`Verwijder ${e.description}`}
                style={{ border: "none", background: "#ffebee", color: "#c62828", borderRadius: 4, padding: "0.35rem 0.55rem", fontSize: "0.8rem", fontWeight: 600 }}>
                ✕
              </button>
            </span>
          </div>
        ))}
      </section>

      <AddFixedExpense />
    </>
  );
}

function AddFixedExpense() {
  const { update } = useSync();
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState("");
  const [day, setDay] = useState("");
  const [amount, setAmount] = useState("");
  const parseNum = (t: string) => { const n = Number(t.trim().replace(",", ".")); return Number.isFinite(n) ? n : null; };
  const canAdd = desc.trim().length > 0 && parseNum(amount) != null;
  const add = () => {
    if (!canAdd) return;
    const d = Math.min(Math.max(Math.round(parseNum(day) ?? 1), 1), 31);
    update((s) => ({
      ...s,
      fixedExpenses: [...s.fixedExpenses, {
        id: `fx-${Date.now()}`,
        payDay: parseNum(day) != null ? d : null,
        description: desc.trim(),
        category: category.trim() || "Overig",
        tag: null,
        amountPerMonth: parseNum(amount) ?? 0,
      }],
    }));
    setDesc(""); setCategory(""); setDay(""); setAmount("");
  };
  const field = (v: string, set: (x: string) => void, ph: string, label: string, numeric = false) => (
    <input value={v} onChange={(e) => set(e.target.value)} placeholder={ph} aria-label={label}
      inputMode={numeric ? "decimal" : undefined}
      style={{ width: "100%", padding: "0.6rem", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", fontSize: 16 }} />
  );
  return (
    <section className="card">
      <h2 className="card-title">Vaste last toevoegen</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-2)" }}>
        <div style={{ gridColumn: "1 / -1" }}>{field(desc, setDesc, "omschrijving, bijv. Sportschool", "Omschrijving")}</div>
        {field(category, setCategory, "categorie (opt.)", "Categorie")}
        {field(day, setDay, "incassodag 1–31 (opt.)", "Incassodag", true)}
        <div style={{ gridColumn: "1 / -1" }}>{field(amount, setAmount, "bedrag per maand €", "Bedrag per maand", true)}</div>
      </div>
      <button className="btn btn-primary" style={{ width: "100%", marginTop: "var(--sp-3)" }} disabled={!canAdd} onClick={add}>
        + Toevoegen
      </button>
    </section>
  );
}

/** 12-maands staafdiagram van het maandresultaat (gespaard); groen positief, rood negatief. */
function SpaarTrend({ cols, activeMonth }: { cols: ReturnType<typeof monthColumns>; activeMonth: MonthKey }) {
  const w = 320, h = 100, pad = 6, labelH = 14;
  const max = Math.max(...cols.map((c) => Math.abs(c.saved)), 1);
  const chartH = h - labelH - 2 * pad;
  const zeroY = pad + chartH * (Math.max(...cols.map((c) => c.saved), 0) / (max * 2)) || pad + chartH / 2;
  const barW = (w - 2 * pad) / 12;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", display: "block" }} role="img"
      aria-label="Gespaard bedrag per maand">
      <line x1={pad} x2={w - pad} y1={zeroY} y2={zeroY} stroke="var(--line)" strokeWidth="1" />
      {cols.map((c, i) => {
        const hh = (Math.abs(c.saved) / max) * (chartH / 2);
        const x = pad + i * barW + 2;
        const y = c.saved >= 0 ? zeroY - hh : zeroY;
        return (
          <g key={c.month}>
            <rect x={x} y={y} width={barW - 4} height={Math.max(hh, 1)} rx="2"
              fill={c.saved >= 0 ? "var(--action)" : "var(--negative)"}
              opacity={c.month === activeMonth ? 1 : 0.45} />
            <text x={x + (barW - 4) / 2} y={h - 2} textAnchor="middle" fontSize="8"
              fill={c.month === activeMonth ? "var(--ink)" : "var(--ink-soft)"}
              fontWeight={c.month === activeMonth ? 700 : 400}>
              {c.month[0]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Wanneer in de maand gaan de vaste lasten eraf? Gesorteerd op incassodag, met lopend totaal. */
function BetaalKalender({ state }: { state: FinancialState }) {
  const withDay = state.fixedExpenses.filter((e) => e.payDay != null && e.amountPerMonth > 0);
  if (withDay.length === 0) return null;
  const sorted = [...withDay].sort((a, b) => (a.payDay ?? 0) - (b.payDay ?? 0));
  const total = sorted.reduce((t, e) => t + e.amountPerMonth, 0);
  const today = new Date().getDate();
  const stillToCome = sorted.filter((e) => (e.payDay ?? 0) >= today).reduce((t, e) => t + e.amountPerMonth, 0);
  let cumulative = 0;
  return (
    <section className="card">
      <h2 className="card-title">Betaalkalender</h2>
      <div className="row" style={{ backgroundColor: "#fff3e0", padding: "0.6rem 0.75rem", borderRadius: "4px" }}>
        <span className="row-label">Komt er deze maand nog aan
          <span className="row-sub">vanaf vandaag (dag {today})</span>
        </span>
        <strong><Money value={stillToCome} cents /></strong>
      </div>
      {sorted.map((e) => {
        cumulative += e.amountPerMonth;
        const passed = (e.payDay ?? 0) < today;
        return (
          <div className="row" key={e.id} style={passed ? { opacity: 0.55 } : undefined}>
            <span className="row-label">
              <span className="money" style={{ display: "inline-block", minWidth: 52, fontWeight: 600 }}>dag {e.payDay}</span>
              {e.description}
              <span className="row-sub">cumulatief <Money value={cumulative} /> van <Money value={total} /></span>
            </span>
            <Money value={e.amountPerMonth} cents />
          </div>
        );
      })}
    </section>
  );
}

function MonthOverview({ state }: { state: FinancialState }) {
  const { update } = useSync();
  const now = new Date();
  const currentKey = MONTH_KEYS[now.getMonth()];
  const [month, setMonth] = useState<MonthKey>(currentKey);
  const [newCategory, setNewCategory] = useState("");
  const cols = monthColumns(state);
  const col = cols.find((c) => c.month === month)!;

  const addVariableExpense = () => {
    if (!newCategory.trim()) return;
    const id = `var-${Date.now()}`;
    update((s) => ({
      ...s,
      monthOverview: {
        ...s.monthOverview,
        variableExpenses: [...s.monthOverview.variableExpenses, { id, category: newCategory, budgetPerMonth: null, actuals: {} }],
      },
    }));
    setNewCategory("");
  };

  const deleteVariableExpense = (id: string) => {
    update((s) => ({
      ...s,
      monthOverview: {
        ...s.monthOverview,
        variableExpenses: s.monthOverview.variableExpenses.filter((x) => x.id !== id),
      },
    }));
  };

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
        {state.monthOverview.variableExpenses.map((cat) => {
          const actual = cat.actuals[month] ?? 0;
          const budget = cat.budgetPerMonth;
          const usage = budget && budget > 0 ? actual / budget : null;
          const over = usage != null && usage > 1;
          return (
            <div key={cat.id} style={{ marginBottom: "0.9rem" }}>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <div className="row" style={{ borderTop: "none" }}>
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
                </div>
                <button
                  onClick={() => deleteVariableExpense(cat.id)}
                  style={{
                    padding: "0.4rem 0.6rem",
                    backgroundColor: "#ffebee",
                    color: "#c62828",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                  }}
                  title="Verwijder"
                >
                  ✕
                </button>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: 4 }}>
                {usage != null ? (
                  <div className="progress" style={{ flex: 1, height: 5 }}
                    role="progressbar" aria-valuenow={Math.round(usage * 100)} aria-valuemin={0} aria-valuemax={100}
                    aria-label={`Budgetgebruik ${cat.category}`}>
                    <div className="progress-fill" style={{
                      width: `${Math.min(usage * 100, 100)}%`,
                      background: over ? "var(--negative)" : usage > 0.85 ? "#f0b429" : "var(--action)",
                    }} />
                  </div>
                ) : (
                  <span style={{ flex: 1, fontSize: "var(--text-xs)", color: "var(--ink-soft)" }}>geen budget ingesteld</span>
                )}
                <span style={{ fontSize: "var(--text-xs)", color: over ? "var(--negative)" : "var(--ink-soft)", whiteSpace: "nowrap" }}>
                  {usage != null ? `${Math.round(usage * 100)}% van` : "budget:"}
                </span>
                <EditableNumber
                  value={cat.budgetPerMonth}
                  allowNull
                  ariaLabel={`Budget per maand voor ${cat.category}`}
                  onCommit={(v) => update((s) => ({
                    ...s,
                    monthOverview: {
                      ...s.monthOverview,
                      variableExpenses: s.monthOverview.variableExpenses.map((x) =>
                        x.id === cat.id ? { ...x, budgetPerMonth: v } : x),
                    },
                  }))}
                />
              </div>
            </div>
          );
        })}
        <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
          <input
            type="text"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addVariableExpense()}
            placeholder="Nieuwe categorie..."
            style={{
              flex: 1,
              padding: "0.75rem",
              border: "1px solid var(--ink-soft)",
              borderRadius: "4px",
              fontSize: "0.9rem",
            }}
          />
          <button
            onClick={addVariableExpense}
            disabled={!newCategory.trim()}
            style={{
              padding: "0.75rem 1rem",
              backgroundColor: "var(--teal)",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: newCategory.trim() ? "pointer" : "default",
              opacity: newCategory.trim() ? 1 : 0.5,
              fontWeight: 600,
            }}
          >
            + Toevoegen
          </button>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Gespaard per maand</h2>
        <SpaarTrend cols={cols} activeMonth={month} />
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
