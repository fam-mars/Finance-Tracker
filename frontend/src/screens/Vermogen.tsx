import { useState } from "react";
import {
  BOX3_2026, box3Estimate, formatEUR, formatPct, netWorthDerived, savingsGoalsDerived,
} from "../domain/calc";
import type { FinancialState } from "../domain/types";
import { EditableNumber, Money, Segments } from "../components/ui";
import { useSync } from "../state/SyncContext";

/** Verloop van de netto-vermogenspeilingen als compacte lijngrafiek. */
function NetWorthTrend({ snapshots }: { snapshots: FinancialState["netWorth"]["snapshots"] }) {
  if (snapshots.length < 2) return null;
  const w = 320, h = 110, pad = 10;
  const values = snapshots.map((s) => s.netWorth);
  const min = Math.min(...values), max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const x = (i: number) => pad + (i / (snapshots.length - 1)) * (w - 2 * pad);
  const y = (v: number) => h - pad - ((v - min) / span) * (h - 2 * pad);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = snapshots[snapshots.length - 1];
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", display: "block" }} role="img"
        aria-label={`Netto vermogen van ${formatEUR(values[0])} naar ${formatEUR(last.netWorth)} over ${snapshots.length} peilingen`}>
        <polyline points={points} fill="none" stroke="var(--action)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(snapshots.length - 1)} cy={y(last.netWorth)} r="4" fill="var(--accent)" />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "var(--ink-soft)" }}>
        <span>{snapshots[0].date}</span>
        <span>{last.date} · <strong className="money">{formatEUR(last.netWorth)}</strong></span>
      </div>
    </div>
  );
}

/** Indicatie box 3-heffing volgens de forfaitaire 2026-percentages. */
function Box3Card({ state }: { state: FinancialState }) {
  const [partners, setPartners] = useState(state.incomes.length >= 2);
  const r = box3Estimate(state, { ...BOX3_2026, partners });
  return (
    <section className="card">
      <h2 className="card-title">Box 3 · vermogensbelasting {new Date().getFullYear()}</h2>
      <label style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", fontSize: "var(--text-sm)", padding: "var(--sp-2) 0" }}>
        <input type="checkbox" checked={partners} onChange={(e) => setPartners(e.target.checked)} />
        Fiscale partners (vrijstelling ×2)
      </label>
      <div className="row"><span className="row-label">Banktegoeden</span><Money value={r.savings} /></div>
      <div className="row"><span className="row-label">Beleggingen &amp; overig</span><Money value={r.investments} /></div>
      <div className="row"><span className="row-label">Aftrekbare schulden<span className="row-sub">excl. hypotheek, na drempel</span></span><Money value={r.deductibleDebt} /></div>
      <div className="row"><span className="row-label">Heffingsvrij vermogen</span><Money value={r.exemption} /></div>
      <div className="row"><span className="row-label">Belastbare grondslag</span><Money value={r.taxableBase} /></div>
      <div className="row">
        <strong className="row-label">Geschatte heffing per jaar
          <span className="row-sub">{formatEUR(r.tax / 12)} per maand</span>
        </strong>
        <strong><Money value={r.tax} /></strong>
      </div>
      {r.taxableBase === 0 && (
        <p style={{ margin: "var(--sp-2) 0 0", fontSize: "var(--text-sm)", color: "var(--positive)" }}>
          🎉 Je vermogen valt binnen de vrijstelling — geen box 3-heffing.
        </p>
      )}
      <p style={{ margin: "var(--sp-3) 0 0", fontSize: "var(--text-xs)", color: "var(--ink-soft)" }}>
        Forfaitaire methode 2026: banktegoeden 1,28% en schulden 2,70% (voorlopig), beleggingen 6,00%,
        vrijstelling {formatEUR(BOX3_2026.exemptionPerPerson)} p.p., tarief 36%. Eigen woning en hypotheek
        vallen in box 1. Schatting — geen belastingadvies.
      </p>
    </section>
  );
}

type Section = "vermogen" | "sparen";

export function Vermogen({ state }: { state: FinancialState }) {
  const [section, setSection] = useState<Section>("vermogen");
  return (
    <main className="screen">
      <h1 className="screen-title">Vermogen</h1>
      <p className="screen-sub">Bezittingen − schulden, en waar je voor spaart.</p>
      <Segments
        options={[
          { id: "vermogen", label: "Netto vermogen" },
          { id: "sparen", label: "Spaardoelen" },
        ]}
        value={section}
        onChange={setSection}
      />
      {section === "vermogen" && <NetWorth state={state} />}
      {section === "sparen" && <Goals state={state} />}
    </main>
  );
}

function NetWorth({ state }: { state: FinancialState }) {
  const { update } = useSync();
  const nw = netWorthDerived(state);
  const manual = state.netWorth.manualAssets;
  const patchManual = (p: Partial<typeof manual>) =>
    update((s) => ({ ...s, netWorth: { ...s.netWorth, manualAssets: { ...s.netWorth.manualAssets, ...p } } }));

  const today = new Date().toISOString().slice(0, 10);
  const fmtDate = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric" });

  return (
    <>
      <section className="card">
        <h2 className="card-title">Bezittingen</h2>
        <div className="row">
          <span className="row-label">Betaalrekening(en)</span>
          <EditableNumber value={manual.checkingAccounts} allowNull ariaLabel="Saldo betaalrekeningen"
            onCommit={(v) => patchManual({ checkingAccounts: v })} />
        </div>
        <div className="row">
          <span className="row-label">Spaarrekening(en)</span>
          <EditableNumber value={manual.savingsAccounts} allowNull ariaLabel="Saldo spaarrekeningen"
            onCommit={(v) => patchManual({ savingsAccounts: v })} />
        </div>
        {nw.assets.filter((a) => a.auto).map((a) => (
          <div className="row" key={a.label}>
            <span className="row-label">{a.label}<span className="row-sub">automatisch</span></span>
            <Money value={a.value} />
          </div>
        ))}
        <div className="row">
          <span className="row-label">Overige bezittingen</span>
          <EditableNumber value={manual.otherAssets} allowNull ariaLabel="Overige bezittingen"
            onCommit={(v) => patchManual({ otherAssets: v })} />
        </div>
        <div className="row">
          <strong className="row-label">Totaal bezittingen</strong>
          <strong><Money value={nw.totalAssets} /></strong>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Schulden</h2>
        {nw.liabilities.map((l) => (
          <div className="row" key={l.label}>
            <span className="row-label">{l.label}</span>
            <Money value={l.value} />
          </div>
        ))}
        <div className="row">
          <strong className="row-label">Totaal schulden</strong>
          <strong><Money value={nw.totalLiabilities} /></strong>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Netto vermogen</h2>
        <div className="row">
          <strong className="row-label">Nu</strong>
          <strong style={{ fontSize: "var(--text-lg)" }}><Money value={nw.netWorth} /></strong>
        </div>
        <button
          className="btn btn-primary"
          style={{ marginTop: "var(--sp-3)", width: "100%" }}
          onClick={() => update((s) => ({
            ...s,
            netWorth: {
              ...s.netWorth,
              snapshots: [
                ...s.netWorth.snapshots.filter((x) => x.date !== today),
                { date: today, netWorth: Math.round(nw.netWorth) },
              ].sort((a, b) => a.date.localeCompare(b.date)),
            },
          }))}
        >
          Peiling van vandaag vastleggen
        </button>
      </section>

      <section className="card">
        <h2 className="card-title">Verloop (maandelijkse peiling)</h2>
        <NetWorthTrend snapshots={state.netWorth.snapshots} />
        {state.netWorth.snapshots.length === 0 && (
          <p style={{ color: "var(--ink-soft)", fontSize: "var(--text-sm)", margin: 0 }}>
            Nog geen peilingen. Leg hierboven je eerste vast.
          </p>
        )}
        {state.netWorth.snapshots.length === 1 && (
          <p style={{ color: "var(--ink-soft)", fontSize: "var(--text-sm)", margin: 0 }}>
            Eén peiling vastgelegd — na een tweede verschijnt hier je grafiek.
          </p>
        )}
        {[...state.netWorth.snapshots].reverse().map((snap) => (
          <div className="row" key={snap.date}>
            <span className="row-label">{fmtDate.format(new Date(snap.date))}</span>
            <Money value={snap.netWorth} />
          </div>
        ))}
      </section>

      <Box3Card state={state} />
    </>
  );
}

function Goals({ state }: { state: FinancialState }) {
  const { update } = useSync();
  const g = savingsGoalsDerived(state);
  return (
    <>
      <section className="card">
        <h2 className="card-title">Spaarruimte</h2>
        <div className="row"><span className="row-label">Beschikbaar p/m</span><Money value={g.availablePerMonth} cents /></div>
        <div className="row"><span className="row-label">Gepland naar doelen</span><Money value={g.plannedPerMonth} /></div>
        <div className="row"><span className="row-label">Nog vrij te besteden</span><Money value={g.freePerMonth} cents signed /></div>
      </section>

      {g.goals.map((goal) => (
        <section className="card" key={goal.id}>
          <h2 className="card-title">{goal.name}</h2>
          <div className="progress" role="progressbar"
            aria-valuenow={Math.round(goal.progress * 100)} aria-valuemin={0} aria-valuemax={100}
            aria-label={`Voortgang ${goal.name}`}>
            <div className="progress-fill" style={{ width: `${goal.progress * 100}%` }} />
          </div>
          <div className="row" style={{ marginTop: "var(--sp-2)" }}>
            <span className="row-label">Streefbedrag
              {goal.isEmergencyFund && goal.targetAmount == null
                ? <span className="row-sub">automatisch: 6× maandlasten</span> : null}
            </span>
            {goal.isEmergencyFund && goal.targetAmount == null
              ? <Money value={goal.effectiveTarget} />
              : <EditableNumber value={goal.targetAmount} allowNull ariaLabel={`Streefbedrag ${goal.name}`}
                  onCommit={(v) => update((s) => patchGoal(s, goal.id, { targetAmount: v }))} />}
          </div>
          <div className="row">
            <span className="row-label">Al gespaard</span>
            <EditableNumber value={goal.savedSoFar} allowNull ariaLabel={`Al gespaard voor ${goal.name}`}
              onCommit={(v) => update((s) => patchGoal(s, goal.id, { savedSoFar: v }))} />
          </div>
          <div className="row">
            <span className="row-label">Inleg p/m</span>
            <EditableNumber value={goal.contributionPerMonth} allowNull ariaLabel={`Inleg per maand voor ${goal.name}`}
              onCommit={(v) => update((s) => patchGoal(s, goal.id, { contributionPerMonth: v }))} />
          </div>
          <div className="row">
            <span className="row-label">Nog nodig
              <span className="row-sub">{formatPct(goal.progress)} gereed</span>
            </span>
            <span>
              <Money value={goal.stillNeeded} />
              {goal.monthsToGo != null && (
                <span className="row-sub" style={{ display: "inline" }}> · {goal.monthsToGo} mnd</span>
              )}
            </span>
          </div>
        </section>
      ))}
    </>
  );
}

function patchGoal(s: FinancialState, id: string, patch: Partial<FinancialState["savingsGoals"][number]>): FinancialState {
  return { ...s, savingsGoals: s.savingsGoals.map((x) => (x.id === id ? { ...x, ...patch } : x)) };
}
