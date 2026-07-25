import type { FinancialState } from "../domain/types";
import { dashboard, formatPct, monthsToReachTarget } from "../domain/calc";
import { Money } from "../components/ui";

export function Retirement({ state }: { state: FinancialState }) {
  const d = dashboard(state);

  // FIRE calculations. Uses investable net worth (excludes home equity —
  // you can't draw 4% a year from the house you live in) and total monthly
  // spend (fixed + variable), matching the return assumption set on the
  // Beleggen screen so the numbers stay consistent across the app.
  const monthlyContribution = d.investingPerMonth + d.savingsRoomPerMonth;
  const annualContribution = monthlyContribution * 12;
  const requiredAssets = d.totalExpensesPerMonth * 12 * 25; // 4% rule

  const monthsToGoal = monthsToReachTarget(
    d.investableNetWorth, monthlyContribution, d.expectedReturnPerYear, requiredAssets,
  );
  const yearsToGoal = monthsToGoal != null ? monthsToGoal / 12 : null;
  const progress = requiredAssets > 0 ? Math.min(d.investableNetWorth / requiredAssets, 1) : 0;

  const scenarios = [
    { label: "+€500/maand extra sparen", monthlyDelta: 500, returnDelta: 0 },
    { label: "+€1000/maand extra sparen", monthlyDelta: 1000, returnDelta: 0 },
    { label: "+€200/maand minder uitgeven", monthlyDelta: 200, returnDelta: 0 },
    { label: `${formatPct(d.expectedReturnPerYear + 0.02)} jaarlijks rendement`, monthlyDelta: 0, returnDelta: 0.02 },
  ].map((scenario) => {
    const scenarioMonths = monthsToReachTarget(
      d.investableNetWorth,
      monthlyContribution + scenario.monthlyDelta,
      d.expectedReturnPerYear + scenario.returnDelta,
      requiredAssets,
    );
    if (scenarioMonths == null || yearsToGoal == null) return { ...scenario, yearsSaved: null };
    return { ...scenario, yearsSaved: yearsToGoal - scenarioMonths / 12 };
  });

  return (
    <main className="screen">
      <h1 className="screen-title">Financiële Vrijheid 🎯</h1>
      <p className="screen-sub">Hoelang tot je kunt stoppen met werken?</p>

      {/* Big number: years to retirement */}
      <section className="card" style={{ backgroundColor: "#e8f5e9", borderLeft: "4px solid var(--teal)" }}>
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <div style={{ fontSize: "3rem", fontWeight: 700, color: "var(--teal)", lineHeight: 1 }}>
            {yearsToGoal != null ? Math.ceil(yearsToGoal) : "—"}
          </div>
          <div style={{ fontSize: "1rem", color: "var(--ink-soft)", marginTop: "0.5rem" }}>
            jaar tot financiële vrijheid
          </div>
          {yearsToGoal != null && yearsToGoal > 0 && (
            <div style={{ fontSize: "0.9rem", color: "#2e7d32", marginTop: "1rem", fontWeight: 500 }}>
              Pensioen op {new Date().getFullYear() + Math.ceil(yearsToGoal)}
            </div>
          )}
          {yearsToGoal == null && (
            <div style={{ fontSize: "0.85rem", color: "var(--ink-soft)", marginTop: "1rem" }}>
              Bij je huidige spaarbedrag en rendement wordt dit doel niet binnen 100 jaar bereikt. Verhoog je maandelijkse inleg of rendement.
            </div>
          )}
        </div>
      </section>

      {/* Current situation */}
      <section className="card">
        <h2 className="card-title">Je huidige situatie</h2>
        <div className="row">
          <span className="row-label">
            Beleggbaar vermogen
            <span className="row-sub">exclusief overwaarde woning</span>
          </span>
          <Money value={d.investableNetWorth} />
        </div>
        <div className="row">
          <span className="row-label">Netto vermogen (incl. woning)</span>
          <Money value={d.netWorth} />
        </div>
        <div className="row">
          <span className="row-label">Maandelijks naar vermogen (sparen + beleggen)</span>
          <Money value={monthlyContribution} signed />
        </div>
        <div className="row">
          <span className="row-label">Jaarlijks naar vermogen</span>
          <Money value={annualContribution} />
        </div>
      </section>

      {/* FIRE number */}
      <section className="card">
        <h2 className="card-title">Je FIRE Getal (4% regel)</h2>
        <div className="row">
          <span className="row-label">
            Vaste lasten
          </span>
          <Money value={d.fixedPerMonth} />
        </div>
        <div className="row">
          <span className="row-label">
            Variabele uitgaven
            <span className="row-sub">budget per maand</span>
          </span>
          <Money value={d.variablePerMonth} />
        </div>
        <div className="row">
          <span className="row-label">
            Totale maandelijkse uitgaven
          </span>
          <Money value={d.totalExpensesPerMonth} />
        </div>
        <div className="row" style={{ backgroundColor: "#fff3e0", padding: "0.75rem", borderRadius: "4px", margin: "0.5rem 0" }}>
          <span className="row-label">
            Benodigd vermogen (× 25)
            <span className="row-sub">voor 4% jaarlijkse opname</span>
          </span>
          <strong><Money value={requiredAssets} /></strong>
        </div>
        <p style={{ margin: "1rem 0 0", fontSize: "0.85rem", color: "var(--ink-soft)" }}>
          💡 Met de 4% regel kun je jaarlijks 4% van je beleggbaar vermogen opnemen. Aannames: {formatPct(d.expectedReturnPerYear)} rendement per jaar (zoals ingesteld bij Beleggen).
        </p>
      </section>

      {/* Progress */}
      <section className="card">
        <h2 className="card-title">Voortgang naar FIRE</h2>
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.9rem" }}>
            <span>Beleggbaar vermogen</span>
            <span>{formatPct(progress)}</span>
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
                width: `${Math.max(progress, 0) * 100}%`,
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--ink-soft)" }}>
          <span><Money value={d.investableNetWorth} /></span>
          <span><Money value={requiredAssets} /></span>
        </div>
      </section>

      {/* Coast FIRE */}
      <section className="card" style={{ backgroundColor: "#fff8e1", borderLeft: "4px solid var(--accent)" }}>
        <h2 className="card-title">🏖 Coast FIRE</h2>
        {(() => {
          const coastMonths = monthsToReachTarget(
            d.investableNetWorth, 0, d.expectedReturnPerYear, requiredAssets);
          if (coastMonths === 0) {
            return <p style={{ margin: 0, fontSize: "0.9rem" }}>Je zit al op je FIRE-getal. 🎉</p>;
          }
          if (coastMonths == null) {
            return (
              <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--ink-soft)" }}>
                Zonder nieuwe inleg groeit je vermogen (nog) niet vanzelf naar je FIRE-getal —
                je maandelijkse inleg is nu de motor achter je tijdlijn.
              </p>
            );
          }
          const coastYears = coastMonths / 12;
          return (
            <>
              <p style={{ margin: 0, fontSize: "0.9rem" }}>
                Zou je <strong>vandaag stoppen met inleggen</strong>, dan groeit je huidige vermogen
                op rendement alleen in ~<strong>{Math.ceil(coastYears)} jaar</strong> naar je FIRE-getal.
              </p>
              {yearsToGoal != null && coastYears > yearsToGoal && (
                <p style={{ margin: "0.5rem 0 0", fontSize: "0.85rem", color: "var(--ink-soft)" }}>
                  Door te blijven inleggen ben je ~{Math.round(coastYears - yearsToGoal)} jaar eerder vrij.
                </p>
              )}
            </>
          );
        })()}
      </section>

      {/* Scenarios */}
      <section className="card">
        <h2 className="card-title">Wat als...</h2>
        {scenarios.map((scenario, i) => (
          <div key={i} className="row" style={{ fontSize: "0.9rem" }}>
            <span className="row-label">{scenario.label}</span>
            <span style={{ color: scenario.yearsSaved && scenario.yearsSaved > 0 ? "#2e7d32" : "var(--ink)" }}>
              {scenario.yearsSaved != null && scenario.yearsSaved > 0 ? `-${scenario.yearsSaved.toFixed(1)} jaar` : "−"}
            </span>
          </div>
        ))}
      </section>

      {/* Tips */}
      <section className="card" style={{ backgroundColor: "#f3e5f5", borderLeft: "4px solid #9c27b0" }}>
        <h2 className="card-title">💡 Snelste paden naar FIRE</h2>
        <ul style={{ margin: "0", paddingLeft: "1.5rem", fontSize: "0.9rem", lineHeight: 1.8 }}>
          <li>
            <strong>Spaarsaldo verhogen</strong> — elke €500 extra per maand scheelt jaren op je tijdlijn
          </li>
          <li>
            <strong>Lasten verlagen</strong> — €1 minder uitgeven verlaagt je FIRE-getal met €25 (4% regel)
          </li>
          <li>
            <strong>Beleggingsrendement</strong> — hoger rendement versnelt de samengestelde groei aanzienlijk
          </li>
          <li>
            <strong>Inkomen verhogen</strong> — carrièresprong = grootste impact op timeline
          </li>
        </ul>
      </section>
    </main>
  );
}
