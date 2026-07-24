import { useState } from "react";
import { formatPct, netWorthDerived, savingsGoalsDerived } from "../domain/calc";
import type { FinancialState } from "../domain/types";
import { EditableNumber, Money, Segments } from "../components/ui";
import { useSync } from "../state/SyncContext";

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
        {state.netWorth.snapshots.length === 0 && (
          <p style={{ color: "var(--ink-soft)", fontSize: "var(--text-sm)", margin: 0 }}>
            Nog geen peilingen. Leg hierboven je eerste vast.
          </p>
        )}
        {[...state.netWorth.snapshots].reverse().map((snap) => (
          <div className="row" key={snap.date}>
            <span className="row-label">{fmtDate.format(new Date(snap.date))}</span>
            <Money value={snap.netWorth} />
          </div>
        ))}
      </section>
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
