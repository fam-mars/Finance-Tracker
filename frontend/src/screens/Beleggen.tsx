import { useState } from "react";
import {
  forecastTable, formatEUR, formatPct, portfolioDerived, totalInvestingPerMonth,
} from "../domain/calc";
import type { FinancialState } from "../domain/types";
import { EditableNumber, Money, Segments } from "../components/ui";
import { useSync } from "../state/SyncContext";

type Section = "portefeuille" | "inleg" | "prognose";

export function Beleggen({ state }: { state: FinancialState }) {
  const [section, setSection] = useState<Section>("portefeuille");
  return (
    <main className="screen">
      <h1 className="screen-title">Beleggen</h1>
      <p className="screen-sub">Portefeuille, maandelijkse inleg en prognose.</p>
      <Segments
        options={[
          { id: "portefeuille", label: "Portefeuille" },
          { id: "inleg", label: "Inleg" },
          { id: "prognose", label: "Prognose" },
        ]}
        value={section}
        onChange={setSection}
      />
      {section === "portefeuille" && <Holdings state={state} />}
      {section === "inleg" && <Contributions state={state} />}
      {section === "prognose" && <Forecast state={state} />}
    </main>
  );
}

function Holdings({ state }: { state: FinancialState }) {
  const { update } = useSync();
  const pf = portfolioDerived(state);
  return (
    <>
      <section className="card">
        <h2 className="card-title">Totaal</h2>
        <div className="row"><span className="row-label">Ingelegd</span><Money value={pf.totalInvested} /></div>
        <div className="row"><span className="row-label">Waarde nu</span><strong><Money value={pf.totalValue} /></strong></div>
        <div className="row">
          <span className="row-label">Resultaat</span>
          <span>
            <Money value={pf.totalResultEur} signed />{" "}
            {pf.totalResultPct != null && <span className="row-sub" style={{ display: "inline" }}>({formatPct(pf.totalResultPct)})</span>}
          </span>
        </div>
      </section>

      {pf.holdings.map((h) => (
        <section className="card" key={h.id}>
          <h2 className="card-title">{h.platform} · {h.name}{h.ticker ? ` (${h.ticker})` : ""}</h2>
          <div className="row">
            <span className="row-label">Aantal</span>
            <EditableNumber value={h.quantity} allowNull ariaLabel={`Aantal ${h.name}`}
              onCommit={(v) => update((s) => patchHolding(s, h.id, { quantity: v }))} />
          </div>
          <div className="row">
            <span className="row-label">Gem. aankoopkoers</span>
            <EditableNumber value={h.avgBuyPrice} allowNull ariaLabel={`Aankoopkoers ${h.name}`}
              onCommit={(v) => update((s) => patchHolding(s, h.id, { avgBuyPrice: v }))} />
          </div>
          <div className="row">
            <span className="row-label">Huidige koers</span>
            <EditableNumber value={h.currentPrice} allowNull ariaLabel={`Huidige koers ${h.name}`}
              onCommit={(v) => update((s) => patchHolding(s, h.id, { currentPrice: v }))} />
          </div>
          <div className="row">
            <span className="row-label">Waarde
              <span className="row-sub">allocatie {formatPct(h.allocation)}</span>
            </span>
            <span>
              <Money value={h.value} />{" "}
              {h.resultPct != null && (
                <span className={h.resultEur >= 0 ? "money money--pos" : "money money--neg"}>
                  ({formatPct(h.resultPct)})
                </span>
              )}
            </span>
          </div>
        </section>
      ))}
    </>
  );
}

function patchHolding(s: FinancialState, id: string, patch: Partial<FinancialState["portfolio"]["holdings"][number]>): FinancialState {
  return {
    ...s,
    portfolio: {
      ...s.portfolio,
      holdings: s.portfolio.holdings.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    },
  };
}

function Contributions({ state }: { state: FinancialState }) {
  const { update } = useSync();
  return (
    <section className="card">
      <h2 className="card-title">Maandelijkse inleg</h2>
      {state.portfolio.monthlyContributions.map((c) => (
        <div className="row" key={c.id}>
          <span className="row-label">{c.target}</span>
          <EditableNumber value={c.amountPerMonth} ariaLabel={`Inleg ${c.target}`}
            onCommit={(v) => update((s) => ({
              ...s,
              portfolio: {
                ...s.portfolio,
                monthlyContributions: s.portfolio.monthlyContributions.map((x) =>
                  x.id === c.id ? { ...x, amountPerMonth: v ?? 0 } : x),
              },
            }))} />
        </div>
      ))}
      <div className="row">
        <strong className="row-label">Totaal inleg p/m</strong>
        <strong><Money value={totalInvestingPerMonth(state)} /></strong>
      </div>
    </section>
  );
}

function Forecast({ state }: { state: FinancialState }) {
  const { update } = useSync();
  const pf = portfolioDerived(state);
  const rows = forecastTable(state.forecast, {
    startValue: pf.totalValue,
    monthlyContribution: totalInvestingPerMonth(state),
  });
  const last = rows.at(-1)!;
  const f = state.forecast;

  return (
    <>
      <section className="card">
        <h2 className="card-title">Uitgangspunten</h2>
        <div className="row">
          <span className="row-label">Rendement per jaar
            <span className="row-sub">aanname — historisch ± 5–8% voor een brede index</span>
          </span>
          <EditableNumber value={f.expectedReturnPerYear * 100} ariaLabel="Rendement per jaar in procenten"
            onCommit={(v) => update((s) => ({ ...s, forecast: { ...s.forecast, expectedReturnPerYear: (v ?? 0) / 100 } }))} />
        </div>
        <div className="row">
          <span className="row-label">Inflatie per jaar (%)</span>
          <EditableNumber value={f.inflationPerYear * 100} ariaLabel="Inflatie per jaar in procenten"
            onCommit={(v) => update((s) => ({ ...s, forecast: { ...s.forecast, inflationPerYear: (v ?? 0) / 100 } }))} />
        </div>
        <div className="row">
          <span className="row-label">Horizon (jaren)</span>
          <EditableNumber value={f.horizonYears} ariaLabel="Horizon in jaren"
            onCommit={(v) => update((s) => ({ ...s, forecast: { ...s.forecast, horizonYears: Math.max(0, Math.min(60, Math.round(v ?? 0))) } }))} />
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Verwachting na {f.horizonYears} jaar</h2>
        <div className="row"><span className="row-label">Verwachte waarde</span><strong><Money value={last.endValue} /></strong></div>
        <div className="row"><span className="row-label">Waarvan zelf ingelegd</span><Money value={last.totalContributed} /></div>
        <div className="row"><span className="row-label">Groei door rendement</span><Money value={last.endValue - last.totalContributed} signed /></div>
        <div className="row"><span className="row-label">In koopkracht van nu</span><Money value={last.inTodaysMoney} /></div>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-soft)", margin: "var(--sp-3) 0 0" }}>
          Rekenmodel met vast rendement — echte rendementen schommelen. Geen financieel advies.
        </p>
      </section>

      <section className="card">
        <h2 className="card-title">Per jaar</h2>
        {rows.filter((r) => r.year % 5 === 0 || r.year === rows.length - 1).map((r) => (
          <div className="row" key={r.year}>
            <span className="row-label">Jaar {r.year}</span>
            <span>
              <Money value={r.endValue} />{" "}
              <span className="row-sub" style={{ display: "inline" }}>
                ({formatEUR(r.inTodaysMoney)} nu)
              </span>
            </span>
          </div>
        ))}
      </section>
    </>
  );
}
