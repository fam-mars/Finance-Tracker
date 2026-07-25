import { useRef, useState } from "react";
import { dashboard, financialHealth, formatEUR, formatPct } from "../domain/calc";
import { parseBackup, serializeBackup } from "../domain/backup";
import type { FinancialState } from "../domain/types";
import { Geldstroom, Money, Pct } from "../components/ui";
import { IncomeExpenseComparison, CategoryBreakdown, DebtSummary } from "../components/charts";
import { useSync } from "../state/SyncContext";

/** Wat gaat er de komende 7 dagen van je rekening af? Uit de incassodagen van de vaste lasten. */
function UpcomingDebits({ state }: { state: FinancialState }) {
  const today = new Date().getDate();
  const upcoming = state.fixedExpenses
    .filter((e) => e.payDay != null && e.amountPerMonth > 0)
    .map((e) => {
      // dagen tot incasso, over de maandgrens heen (verkort naar 28 voor korte maanden)
      const day = Math.min(e.payDay!, 28);
      const inDays = day >= today ? day - today : day + 28 - today;
      return { ...e, inDays };
    })
    .filter((e) => e.inDays <= 7)
    .sort((a, b) => a.inDays - b.inDays);
  if (upcoming.length === 0) return null;
  const total = upcoming.reduce((t, e) => t + e.amountPerMonth, 0);
  return (
    <section className="card">
      <h2 className="card-title">Komende 7 dagen van je rekening</h2>
      {upcoming.map((e) => (
        <div className="row" key={e.id}>
          <span className="row-label">{e.description}
            <span className="row-sub">{e.inDays === 0 ? "vandaag" : e.inDays === 1 ? "morgen" : `over ${e.inDays} dagen`}</span>
          </span>
          <Money value={e.amountPerMonth} cents />
        </div>
      ))}
      <div className="row">
        <strong className="row-label">Totaal</strong>
        <strong><Money value={total} cents /></strong>
      </div>
    </section>
  );
}

/** Demo-knop: laat de app zien met fictieve cijfers, zonder eigen gegevens bloot te geven. */
function DemoButton() {
  const { demo, enterDemo } = useSync();
  if (demo) return null;
  return (
    <button
      onClick={enterDemo}
      title="Laat de app zien met fictieve gegevens"
      style={{
        margin: "0 0 var(--sp-4)",
        padding: "0.5rem 0.9rem",
        border: "1px solid var(--line)",
        borderRadius: "999px",
        background: "var(--surface)",
        color: "var(--ink-soft)",
        fontSize: "var(--text-sm)",
        fontWeight: 600,
      }}
    >
      🎭 Demo-modus — laat de app zien met fictieve cijfers
    </button>
  );
}

/** Backup & herstel — zonder backend is een JSON-bestand je vangnet en je brug tussen apparaten. */
function DataCard({ state }: { state: FinancialState }) {
  const { update } = useSync();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const exportBackup = () => {
    const url = URL.createObjectURL(new Blob([serializeBackup(state)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `financieel-overzicht-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg("✓ Backup gedownload — bewaar 'm veilig (bevat je financiële gegevens).");
  };

  const importBackup = async (file: File) => {
    const restored = parseBackup(await file.text());
    if (!restored) {
      setMsg("Ongeldig backupbestand.");
      return;
    }
    update(() => restored);
    setMsg("✓ Backup hersteld — controleer de cijfers en druk op Opslaan.");
  };

  return (
    <section className="card" style={{ marginTop: "var(--sp-4)" }}>
      <h2 className="card-title">Gegevens</h2>
      <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={exportBackup}>⬇ Backup maken</button>
        <input ref={fileRef} type="file" accept=".json" style={{ display: "none" }}
          aria-label="Backup terugzetten"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void importBackup(f); e.target.value = ""; }} />
        <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>⬆ Backup terugzetten</button>
      </div>
      {msg && (
        <p style={{ margin: "var(--sp-3) 0 0", fontSize: "var(--text-sm)", color: msg.startsWith("✓") ? "var(--positive)" : "var(--negative)" }}>{msg}</p>
      )}
      <p style={{ margin: "var(--sp-3) 0 0", fontSize: "var(--text-xs)", color: "var(--ink-soft)" }}>
        Je gegevens staan in deze browser. Maak regelmatig een backup, of gebruik het bestand om
        over te stappen naar een ander apparaat.
      </p>
    </section>
  );
}

/** Nibud-gebaseerde gezondheidsscore met subscores en voortgangsbalkjes. */
function HealthCard({ state }: { state: FinancialState }) {
  const h = financialHealth(state);
  const color = h.score >= 80 ? "var(--positive)" : h.score >= 60 ? "var(--action)" : h.score >= 40 ? "#f57c00" : "var(--negative)";
  const weakest = [...h.subscores].sort((a, b) => a.score - b.score)[0];
  return (
    <section className="card" aria-labelledby="health-title">
      <h2 className="card-title" id="health-title">Financiële gezondheid</h2>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)", marginBottom: "var(--sp-3)" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: "2.6rem", fontWeight: 700, lineHeight: 1, color }}>
          {h.score}
        </div>
        <div>
          <div style={{ fontWeight: 600 }}>{h.label}</div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-soft)" }}>score 0–100 · Nibud-richtlijnen</div>
        </div>
      </div>
      {h.subscores.map((s) => (
        <div key={s.key} style={{ padding: "var(--sp-1) 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-sm)" }}>
            <span>{s.label}</span>
            <span className="money" style={{ color: s.score >= 60 ? "var(--positive)" : s.score >= 30 ? "#f57c00" : "var(--negative)" }}>{s.score}</span>
          </div>
          <div className="progress" style={{ height: 5, marginTop: 3 }}>
            <div className="progress-fill" style={{ width: `${s.score}%`, background: s.score >= 60 ? "var(--action)" : s.score >= 30 ? "#f0b429" : "var(--negative)" }} />
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-soft)", marginTop: 2 }}>{s.detail}</div>
        </div>
      ))}
      {weakest && weakest.score < 60 && (
        <p style={{ margin: "var(--sp-3) 0 0", fontSize: "var(--text-sm)", fontWeight: 600 }}>
          👉 Grootste winst: <strong>{weakest.label.toLowerCase()}</strong> — zie ⚡ Tips voor concrete stappen.
        </p>
      )}
    </section>
  );
}

export function Dashboard({ state }: { state: FinancialState }) {
  const d = dashboard(state);

  return (
    <main className="screen">
      <h1 className="screen-title">Financieel overzicht</h1>
      <p className="screen-sub">Huishoudfinanciën — alles rekent automatisch.</p>

      <DemoButton />

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

      <UpcomingDebits state={state} />

      <HealthCard state={state} />

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">Netto vermogen</div>
          <div className="stat-value"><Money value={d.netWorth} /></div>
          <div className="stat-note">
            {(() => {
              const snaps = state.netWorth.snapshots;
              const last = snaps.length > 0 ? snaps[snaps.length - 1] : null;
              if (!last) return "bezittingen − schulden";
              const delta = Math.round(d.netWorth - last.netWorth);
              const fmt = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" });
              return (
                <span className={delta >= 0 ? "money--pos" : "money--neg"}>
                  {delta >= 0 ? "+" : ""}{formatEUR(delta)} sinds {fmt.format(new Date(last.date))}
                </span>
              );
            })()}
          </div>
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

      <DataCard state={state} />
    </main>
  );
}
