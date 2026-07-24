import type { FinancialState } from "../domain/types";
import { dashboard, formatPct } from "../domain/calc";
import { Money } from "../components/ui";

export function Retirement({ state }: { state: FinancialState }) {
  const d = dashboard(state);

  // FIRE calculations
  const monthlyOverage = d.incomePerMonth - d.fixedPerMonth - d.investingPerMonth;
  const annualSavings = (d.investingPerMonth + d.savingsRoomPerMonth) * 12;
  const netWorthGoal = (d.fixedPerMonth * 12) * 25; // 4% rule: need 25x annual expenses
  const yearsToGoal = netWorthGoal > d.netWorth ? (netWorthGoal - d.netWorth) / (annualSavings * 1.05) : 0; // 5% return assumption

  const currentMonthlyNeed = d.fixedPerMonth;
  const requiredAssets = currentMonthlyNeed * 12 * 25;

  return (
    <main className="screen">
      <h1 className="screen-title">Financiële Vrijheid 🎯</h1>
      <p className="screen-sub">Hoelang tot je kunt stoppen met werken?</p>

      {/* Big number: years to retirement */}
      <section className="card" style={{ backgroundColor: "#e8f5e9", borderLeft: "4px solid var(--teal)" }}>
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <div style={{ fontSize: "3rem", fontWeight: 700, color: "var(--teal)", lineHeight: 1 }}>
            {yearsToGoal > 0 ? Math.ceil(yearsToGoal) : "0"}
          </div>
          <div style={{ fontSize: "1rem", color: "var(--ink-soft)", marginTop: "0.5rem" }}>
            jaar tot financiële vrijheid
          </div>
          {yearsToGoal > 0 && (
            <div style={{ fontSize: "0.9rem", color: "#2e7d32", marginTop: "1rem", fontWeight: 500 }}>
              Pensioen op {new Date().getFullYear() + Math.ceil(yearsToGoal)}
            </div>
          )}
        </div>
      </section>

      {/* Current situation */}
      <section className="card">
        <h2 className="card-title">Je huidige situatie</h2>
        <div className="row">
          <span className="row-label">Netto vermogen</span>
          <Money value={d.netWorth} />
        </div>
        <div className="row">
          <span className="row-label">Maandelijks over (na lasten)</span>
          <Money value={monthlyOverage} signed />
        </div>
        <div className="row">
          <span className="row-label">Jaarlijks beleggen</span>
          <Money value={annualSavings} />
        </div>
      </section>

      {/* FIRE number */}
      <section className="card">
        <h2 className="card-title">Je FIRE Getal (4% regel)</h2>
        <div className="row">
          <span className="row-label">
            Maandelijke lasten
            <span className="row-sub">uitgaven die je betaalt</span>
          </span>
          <Money value={currentMonthlyNeed} />
        </div>
        <div className="row">
          <span className="row-label">
            Jaarlijkse lasten (× 12)
            <span className="row-sub">totaal per jaar</span>
          </span>
          <Money value={currentMonthlyNeed * 12} />
        </div>
        <div className="row" style={{ backgroundColor: "#fff3e0", padding: "0.75rem", borderRadius: "4px", margin: "0.5rem 0" }}>
          <span className="row-label">
            Benodigd vermogen (× 25)
            <span className="row-sub">voor 4% jaarlijkse opname</span>
          </span>
          <strong><Money value={requiredAssets} /></strong>
        </div>
        <p style={{ margin: "1rem 0 0", fontSize: "0.85rem", color: "var(--ink-soft)" }}>
          💡 Met het 4% regel kun je jaarlijks 4% van je vermogen opnemen. Dit helpt je de rest van je leven te leven.
        </p>
      </section>

      {/* Progress */}
      <section className="card">
        <h2 className="card-title">Voortgang naar FIRE</h2>
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.9rem" }}>
            <span>Huidige vermogen</span>
            <span>{formatPct(Math.min(d.netWorth / requiredAssets, 1))}</span>
          </div>
          <div
            style={{
              width: "100%",
              height: "8px",
              backgroundColor: "var(--ink-soft)",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                backgroundColor: "var(--teal)",
                width: `${Math.min((d.netWorth / requiredAssets) * 100, 100)}%`,
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--ink-soft)" }}>
          <span><Money value={d.netWorth} /></span>
          <span><Money value={requiredAssets} /></span>
        </div>
      </section>

      {/* Scenarios */}
      <section className="card">
        <h2 className="card-title">Wat als...</h2>
        {[
          { label: "+€500/maand extra sparen", delta: 500 * 12 * 1.05 },
          { label: "+€1000/maand extra sparen", delta: 1000 * 12 * 1.05 },
          { label: "+€200/maand minder uitgeven", delta: 200 * 12 * 1.05 },
          { label: "7% jaarlijkse return (vs 5%)", delta: (annualSavings * 0.02 * yearsToGoal) },
        ].map((scenario, i) => {
          const newYears = Math.max(0, (requiredAssets - d.netWorth - scenario.delta) / (annualSavings * 1.05));
          const yearsSaved = yearsToGoal - newYears;
          return (
            <div key={i} className="row" style={{ fontSize: "0.9rem" }}>
              <span className="row-label">{scenario.label}</span>
              <span style={{ color: yearsSaved > 0 ? "#2e7d32" : "var(--ink)" }}>
                {yearsSaved > 0 ? `-${yearsSaved.toFixed(1)} jaar` : "−"}
              </span>
            </div>
          );
        })}
      </section>

      {/* Tips */}
      <section className="card" style={{ backgroundColor: "#f3e5f5", borderLeft: "4px solid #9c27b0" }}>
        <h2 className="card-title">💡 Snelste paden naar FIRE</h2>
        <ul style={{ margin: "0", paddingLeft: "1.5rem", fontSize: "0.9rem", lineHeight: 1.8 }}>
          <li>
            <strong>Spaarsaldo verhogen</strong> — elke €500 extra per maand = ~1 jaar eerder vrij
          </li>
          <li>
            <strong>Lasten verlagen</strong> — €200 besparen = lagere FIRE-getal en sneller bereikt
          </li>
          <li>
            <strong>Beleggingsrendementen</strong> — 6% i.p.v. 5% = aanzienlijk sneller groeien
          </li>
          <li>
            <strong>Inkomen verhogen</strong> — carrièresprong = grootste impact op timeline
          </li>
        </ul>
      </section>
    </main>
  );
}
