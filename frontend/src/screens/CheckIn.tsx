import { useState } from "react";
import type { MonthKey } from "../domain/types";
import { MONTH_KEYS } from "../domain/types";
import { assetClassOf, formatEUR, netWorthDerived } from "../domain/calc";
import { EditableNumber, Money, Segments } from "../components/ui";
import { useSync } from "../state/SyncContext";

/**
 * Periodieke check-in — één begeleide flow die alle data bijwerkt:
 * saldi → uitgaven van de maand → koersen → schulden → doelen → peiling.
 * De herinnering op het dashboard maakt er een terugkerende gewoonte van.
 */

const CHECKIN_KEY = "finance-tracker-checkin";

export interface CheckinMeta {
  last: string | null; // ISO-datum
  freq: "monthly" | "weekly";
}

export function getCheckinMeta(): CheckinMeta {
  try {
    const stored = localStorage.getItem(CHECKIN_KEY);
    if (stored) return JSON.parse(stored) as CheckinMeta;
  } catch { /* val terug op default */ }
  return { last: null, freq: "monthly" };
}

function setCheckinMeta(meta: CheckinMeta) {
  try { localStorage.setItem(CHECKIN_KEY, JSON.stringify(meta)); } catch { /* best effort */ }
}

export function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - Date.parse(iso)) / 86400000);
}

export function checkinDue(meta: CheckinMeta): boolean {
  const d = daysSince(meta.last);
  if (d == null) return true;
  return meta.freq === "weekly" ? d >= 7 : d >= 28;
}

/** Dashboard-herinnering: opvallend wanneer de check-in 'verschuldigd' is, anders een bescheiden regel. */
export function CheckinReminder({ onStart }: { onStart: () => void }) {
  const meta = getCheckinMeta();
  const due = checkinDue(meta);
  const days = daysSince(meta.last);
  const label = meta.freq === "weekly" ? "wekelijkse" : "maandelijkse";
  return (
    <div className="screen" style={{ paddingBottom: 0, paddingTop: "var(--sp-3)" }}>
      {due ? (
        <div className="banner" style={{
          backgroundColor: "#fff8e1", color: "#7a5a10", marginBottom: "var(--sp-2)",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--sp-2)",
        }}>
          <span>🔄 Tijd voor je {label} update{days != null ? ` — laatste is ${days} dagen geleden` : ""}</span>
          <button onClick={onStart} style={{
            border: "none", borderRadius: "var(--radius-sm)", padding: "6px 12px",
            backgroundColor: "var(--action)", color: "#fff", fontWeight: 600, fontSize: "var(--text-xs)", whiteSpace: "nowrap",
          }}>
            Start (±2 min)
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-2)", fontSize: "var(--text-xs)", color: "var(--ink-soft)" }}>
          <span>🔄 Laatste check-in: {days} dagen geleden</span>
          <button onClick={onStart} className="btn btn-ghost" style={{ minHeight: 0, padding: "4px 8px", fontSize: "var(--text-xs)" }}>
            Opnieuw
          </button>
        </div>
      )}
    </div>
  );
}

const STEPS = [
  { id: "saldi", title: "Banksaldi", help: "Neem de actuele saldi over uit je bankapp(s)." },
  { id: "uitgaven", title: "Uitgaven deze maand", help: "Vul de variabele uitgaven van de huidige maand in — of gebruik de bankimport op het Cashflow-scherm." },
  { id: "koersen", title: "Beleggingen", help: "Werk de koersen/waardes bij. Crypto gaat automatisch via Beleggen → 🔄 Bitvavo koersen." },
  { id: "schulden", title: "Schulden", help: "Neem de actuele restschulden over (zie je jaaroverzicht of app van de geldverstrekker)." },
  { id: "doelen", title: "Spaardoelen", help: "Hoeveel staat er inmiddels voor elk doel opzij?" },
  { id: "klaar", title: "Peiling vastleggen", help: "We leggen je netto vermogen van vandaag vast voor de grafiek." },
] as const;

export function CheckIn({ onComplete }: { onComplete: () => void }) {
  const { state, update } = useSync();
  const [stepIdx, setStepIdx] = useState(0);
  const [freq, setFreq] = useState<CheckinMeta["freq"]>(getCheckinMeta().freq);
  if (!state) return null;

  const step = STEPS[stepIdx];
  const month: MonthKey = MONTH_KEYS[new Date().getMonth()];
  const progress = ((stepIdx + 1) / STEPS.length) * 100;
  const nw = netWorthDerived(state);
  const manual = state.netWorth.manualAssets;

  const finish = () => {
    const today = new Date().toISOString().slice(0, 10);
    update((s) => ({
      ...s,
      netWorth: {
        ...s.netWorth,
        snapshots: [
          ...s.netWorth.snapshots.filter((x) => x.date !== today),
          { date: today, netWorth: Math.round(netWorthDerived(s).netWorth) },
        ].sort((a, b) => a.date.localeCompare(b.date)),
      },
    }));
    setCheckinMeta({ last: new Date().toISOString(), freq });
    onComplete();
  };

  return (
    <main className="screen" style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{ marginBottom: "var(--sp-4)" }}>
        <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.5rem" }}>Check-in 🔄</h1>
        <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: "0.9rem" }}>
          Alles bijwerken in één rondje. Stap {stepIdx + 1} van {STEPS.length}: {step.title}
        </p>
      </div>

      <div style={{ width: "100%", height: 4, backgroundColor: "var(--surface-sunken)", borderRadius: 2, overflow: "hidden", marginBottom: "var(--sp-4)" }}>
        <div style={{ height: "100%", backgroundColor: "var(--teal)", width: `${progress}%`, transition: "width 0.3s ease" }} />
      </div>

      <p style={{ margin: "0 0 var(--sp-3)", padding: "0.75rem", backgroundColor: "#e8f5e9", borderRadius: 4, fontSize: "0.85rem", color: "#2e7d32" }}>
        💡 {step.help}
      </p>

      <section className="card">
        {step.id === "saldi" && (
          <>
            <div className="row"><span className="row-label">Betaalrekening(en)</span>
              <EditableNumber value={manual.checkingAccounts} allowNull ariaLabel="Saldo betaalrekeningen"
                onCommit={(v) => update((s) => ({ ...s, netWorth: { ...s.netWorth, manualAssets: { ...s.netWorth.manualAssets, checkingAccounts: v } } }))} />
            </div>
            <div className="row"><span className="row-label">Spaarrekening(en)</span>
              <EditableNumber value={manual.savingsAccounts} allowNull ariaLabel="Saldo spaarrekeningen"
                onCommit={(v) => update((s) => ({ ...s, netWorth: { ...s.netWorth, manualAssets: { ...s.netWorth.manualAssets, savingsAccounts: v } } }))} />
            </div>
          </>
        )}

        {step.id === "uitgaven" && (
          state.monthOverview.variableExpenses.length === 0
            ? <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--ink-soft)" }}>Nog geen variabele categorieën — voeg ze toe op Cashflow → Maandoverzicht.</p>
            : state.monthOverview.variableExpenses.map((cat) => (
              <div className="row" key={cat.id}>
                <span className="row-label">{cat.category}<span className="row-sub">{month} {state.monthOverview.year}</span></span>
                <EditableNumber value={cat.actuals[month] ?? null} allowNull ariaLabel={`${cat.category} in ${month}`}
                  onCommit={(v) => update((s) => ({
                    ...s,
                    monthOverview: {
                      ...s.monthOverview,
                      variableExpenses: s.monthOverview.variableExpenses.map((x) =>
                        x.id === cat.id ? { ...x, actuals: { ...x.actuals, [month]: v } } : x),
                    },
                  }))} />
              </div>
            ))
        )}

        {step.id === "koersen" && (
          state.portfolio.holdings.map((h) => (
            <div className="row" key={h.id}>
              <span className="row-label">{h.name}
                <span className="row-sub">{h.platform} · {assetClassOf(h.platform)}{assetClassOf(h.platform) === "P2P-leningen" ? " — vul accountwaarde in" : ""}</span>
              </span>
              <EditableNumber value={h.currentPrice} allowNull ariaLabel={`Huidige koers ${h.name}`}
                onCommit={(v) => update((s) => ({
                  ...s,
                  portfolio: { ...s.portfolio, holdings: s.portfolio.holdings.map((x) => x.id === h.id ? { ...x, currentPrice: v } : x) },
                }))} />
            </div>
          ))
        )}

        {step.id === "schulden" && (
          <>
            <div className="row"><span className="row-label">Restschuld hypotheek</span>
              <EditableNumber value={state.mortgage.principalRemaining} ariaLabel="Restschuld hypotheek"
                onCommit={(v) => update((s) => ({ ...s, mortgage: { ...s.mortgage, principalRemaining: v ?? 0 } }))} />
            </div>
            {state.debts.filter((d) => !d.linkedToMortgage).map((d) => (
              <div className="row" key={d.id}>
                <span className="row-label">{d.description}</span>
                <EditableNumber value={d.principalRemaining} ariaLabel={`Restschuld ${d.description}`}
                  onCommit={(v) => update((s) => ({ ...s, debts: s.debts.map((x) => x.id === d.id ? { ...x, principalRemaining: v ?? 0 } : x) }))} />
              </div>
            ))}
          </>
        )}

        {step.id === "doelen" && (
          state.savingsGoals.map((g) => (
            <div className="row" key={g.id}>
              <span className="row-label">{g.name}</span>
              <EditableNumber value={g.savedSoFar} allowNull ariaLabel={`Gespaard voor ${g.name}`}
                onCommit={(v) => update((s) => ({ ...s, savingsGoals: s.savingsGoals.map((x) => x.id === g.id ? { ...x, savedSoFar: v } : x) }))} />
            </div>
          ))
        )}

        {step.id === "klaar" && (
          <>
            <div className="row">
              <strong className="row-label">Netto vermogen vandaag</strong>
              <strong style={{ fontSize: "var(--text-lg)" }}><Money value={nw.netWorth} /></strong>
            </div>
            <p style={{ margin: "var(--sp-2) 0 var(--sp-3)", fontSize: "var(--text-sm)", color: "var(--ink-soft)" }}>
              Dit punt komt in je vermogensgrafiek. Alles wordt automatisch bewaard.
            </p>
            <p style={{ margin: "0 0 var(--sp-2)", fontSize: "var(--text-sm)", fontWeight: 600 }}>Herinner me:</p>
            <Segments
              options={[{ id: "monthly", label: "Elke maand" }, { id: "weekly", label: "Elke week" }]}
              value={freq}
              onChange={setFreq}
            />
          </>
        )}
      </section>

      <div style={{ display: "flex", gap: "var(--sp-3)", marginTop: "var(--sp-3)" }}>
        <button className="btn" onClick={() => stepIdx === 0 ? onComplete() : setStepIdx(stepIdx - 1)}
          style={{ flex: 1, backgroundColor: "var(--surface-sunken)", color: "var(--ink)" }}>
          {stepIdx === 0 ? "Annuleren" : "Terug"}
        </button>
        <button className="btn btn-primary" style={{ flex: 1 }}
          onClick={() => stepIdx === STEPS.length - 1 ? finish() : setStepIdx(stepIdx + 1)}>
          {stepIdx === STEPS.length - 1 ? `✓ Vastleggen (${formatEUR(nw.netWorth)})` : "Volgende"}
        </button>
      </div>
    </main>
  );
}
