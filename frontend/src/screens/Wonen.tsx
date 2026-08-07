import { useState } from "react";
import {
  amortizationSchedule, debtPayoffDate, debtRepayVsInvest, debtStrategy, formatEUR, formatPct,
  mortgagePerYear, mortgageSummary, repayVsInvest, totalDebt,
  totalDebtExclMortgage, totalDebtPaymentPerMonth,
} from "../domain/calc";
import type { DebtStrategyKind } from "../domain/calc";
import type { FinancialState } from "../domain/types";
import { DeleteChip, EditableNumber, Money, Segments } from "../components/ui";
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

      <RepayVsInvestCard state={state} />
    </>
  );
}

/** Extra aflossen of beleggen? Zelfde euro, twee routes, naast elkaar. */
function RepayVsInvestCard({ state }: { state: FinancialState }) {
  const [extra, setExtra] = useState(200);
  const r = state.forecast.expectedReturnPerYear;
  const cmp = repayVsInvest(state.mortgage, extra, r);
  const investWins = cmp.investGrowth > cmp.interestSaved;
  return (
    <section className="card" style={{ backgroundColor: "#e3f2fd", borderLeft: "4px solid #1976d2" }}>
      <h2 className="card-title">Extra aflossen of beleggen?</h2>
      <div className="row">
        <span className="row-label">Extra bedrag per maand</span>
        <EditableNumber value={extra} ariaLabel="Extra bedrag per maand"
          onCommit={(v) => setExtra(Math.max(v ?? 0, 0))} />
      </div>
      <div className="row">
        <span className="row-label">🏠 Aflossen: rente bespaard
          <span className="row-sub">gegarandeerd, tegen {formatPct(state.mortgage.interestRatePerYear)} · {Math.round(cmp.monthsEarlier / 12)} jaar eerder hypotheekvrij</span>
        </span>
        <Money value={cmp.interestSaved} />
      </div>
      <div className="row">
        <span className="row-label">📈 Beleggen: verwachte groei
          <span className="row-sub">bij {formatPct(r)} per jaar over dezelfde looptijd — niet gegarandeerd</span>
        </span>
        <Money value={cmp.investGrowth} />
      </div>
      <p style={{ margin: "var(--sp-3) 0 0", fontSize: "var(--text-sm)", fontWeight: 600 }}>
        {investWins
          ? "📈 Op deze aannames levert beleggen meer op — maar aflossen is een zeker rendement en verlaagt je vaste lasten."
          : "🏠 Op deze aannames wint extra aflossen — zeker rendement én eerder hypotheekvrij."}
      </p>
      <p style={{ margin: "var(--sp-2) 0 0", fontSize: "var(--text-xs)", color: "var(--ink-soft)" }}>
        Vereenvoudigd model (geen belasting, renteaftrek of boetevrije-aflossingslimiet). Geen financieel advies.
      </p>
    </section>
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "var(--sp-2)" }}>
              <h2 className="card-title">
                {d.description}{d.lender ? ` · ${d.lender}` : ""}{d.owner ? ` · ${d.owner}` : ""}
              </h2>
              {!d.linkedToMortgage && (
                <DeleteChip title={`Verwijder ${d.description}`}
                  onClick={() => update((s) => ({ ...s, debts: s.debts.filter((x) => x.id !== d.id) }))} />
              )}
            </div>
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
                  <span className="row-label">Rente per jaar (%)</span>
                  <EditableNumber value={Math.round(d.interestRatePerYear * 10000) / 100} ariaLabel={`Rente ${d.description}`}
                    onCommit={(v) => update((s) => ({
                      ...s, debts: s.debts.map((x) => x.id === d.id ? { ...x, interestRatePerYear: Math.max(v ?? 0, 0) / 100 } : x),
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

      <DebtPlannerCard state={state} />

      <DebtRepayOrInvestCard state={state} />

      <AddDebtCard />
    </>
  );
}

/**
 * Per schuld: extra aflossen of hetzelfde bedrag beleggen? Dé afweging voor
 * een studieschuld met lage rente — gegarandeerde rentebesparing vs verwacht
 * (maar onzeker) beleggingsrendement over dezelfde looptijd.
 */
function DebtRepayOrInvestCard({ state }: { state: FinancialState }) {
  const candidates = state.debts.filter((d) => !d.linkedToMortgage && d.principalRemaining > 0);
  const [debtId, setDebtId] = useState<string | null>(null);
  const [extra, setExtra] = useState(100);
  const [rendementPct, setRendementPct] = useState(
    Math.round(state.forecast.expectedReturnPerYear * 1000) / 10);
  if (candidates.length === 0) return null;
  const debt = candidates.find((d) => d.id === debtId) ?? candidates[0];
  const r = rendementPct / 100;
  const cmp = debtRepayVsInvest(debt, extra, r);
  const investWins = cmp.investGrowth > cmp.interestSaved;
  const rateGap = r - debt.interestRatePerYear;
  const fmtMonths = (m: number) => (m >= 24 ? `${Math.round(m / 12)} jaar` : `${m} mnd`);

  return (
    <section className="card" style={{ backgroundColor: "#e3f2fd", borderLeft: "4px solid #1976d2" }}>
      <h2 className="card-title">Deze schuld aflossen of beleggen?</h2>
      {candidates.length > 1 && (
        <select
          value={debt.id}
          onChange={(e) => setDebtId(e.target.value)}
          aria-label="Kies schuld"
          style={{
            width: "100%", padding: "10px", marginBottom: "var(--sp-2)",
            border: "1px solid var(--line)", borderRadius: "var(--radius-sm)",
            background: "var(--surface)", color: "var(--ink)", fontSize: 16,
          }}
        >
          {candidates.map((d) => (
            <option key={d.id} value={d.id}>
              {d.description} · {formatEUR(d.principalRemaining)} @ {formatPct(d.interestRatePerYear)}
            </option>
          ))}
        </select>
      )}
      <div className="row">
        <span className="row-label">Extra bedrag per maand</span>
        <EditableNumber value={extra} ariaLabel="Extra bedrag per maand voor deze schuld"
          onCommit={(v) => setExtra(Math.max(v ?? 0, 0))} />
      </div>
      <div className="row">
        <span className="row-label">Verwacht rendement (%)
          <span className="row-sub">standaard uit je prognose-aannames</span>
        </span>
        <EditableNumber value={rendementPct} ariaLabel="Verwacht rendement in procenten"
          onCommit={(v) => setRendementPct(Math.max(v ?? 0, 0))} />
      </div>
      {cmp.baseMonths == null ? (
        <p style={{ margin: "var(--sp-3) 0 0", fontSize: "var(--text-sm)", color: "var(--negative)", fontWeight: 600 }}>
          Het huidige maandbedrag dekt de rente niet — deze schuld loopt op.
          Verhoog eerst het maandbedrag; beleggen is dan niet aan de orde.
        </p>
      ) : (
        <>
          <div className="row">
            <span className="row-label">🏦 Aflossen: rente bespaard
              <span className="row-sub">
                gegarandeerd, tegen {formatPct(debt.interestRatePerYear)} · {cmp.monthsEarlier > 0 ? `${fmtMonths(cmp.monthsEarlier)} eerder klaar` : "zelfde looptijd"}
              </span>
            </span>
            <Money value={cmp.interestSaved} />
          </div>
          <div className="row">
            <span className="row-label">📈 Beleggen: verwachte groei
              <span className="row-sub">
                bij {formatPct(r)} over {fmtMonths(cmp.baseMonths)} (de restlooptijd) — niet gegarandeerd
              </span>
            </span>
            <Money value={cmp.investGrowth} />
          </div>
          <p style={{ margin: "var(--sp-3) 0 0", fontSize: "var(--text-sm)", fontWeight: 600 }}>
            {investWins
              ? `📈 Op deze aannames levert beleggen ${formatEUR(cmp.investGrowth - cmp.interestSaved)} meer op dan aflossen — laat de schuld op het minimum doorlopen en beleg het verschil.`
              : `🏦 Op deze aannames wint extra aflossen (${formatEUR(cmp.interestSaved - cmp.investGrowth)} voordeel) — zeker rendement én eerder schuldenvrij.`}
          </p>
          <p style={{ margin: "var(--sp-2) 0 0", fontSize: "var(--text-sm)" }}>
            Vuistregel: de schuldrente ({formatPct(debt.interestRatePerYear)}) is je <em>gegarandeerde</em> rendement
            bij aflossen; het beleggingsrendement ({formatPct(r)}) is een <em>verwachting</em>.
            {rateGap > 0.02
              ? " Bij zo'n groot verschil kiezen de meeste rekenmodellen voor beleggen — mits je tegen de schommelingen kunt."
              : rateGap < 0
                ? " De schuldrente is hier hóger dan het verwachte rendement: aflossen is dan vrijwel altijd de betere keuze."
                : " De marges zijn klein: rust in je hoofd en minder maandlasten wegen dan zwaarder dan het rekensommetje."}
          </p>
        </>
      )}
      <p style={{ margin: "var(--sp-2) 0 0", fontSize: "var(--text-xs)", color: "var(--ink-soft)" }}>
        Let op: belegd vermogen telt mee in box 3, terwijl een schuld (boven de drempel) je grondslag juist
        verlaagt — zie de box 3-kaart bij Vermogen. Studieschuldrente is niet aftrekbaar. Vereenvoudigd
        model, geen financieel advies.
      </p>
    </section>
  );
}

/** Nieuwe schuld toevoegen — bijv. een studieschuld (DUO), autolening of persoonlijke lening. */
function AddDebtCard() {
  const { update } = useSync();
  const [description, setDescription] = useState("");
  const [lender, setLender] = useState("");
  const [saldo, setSaldo] = useState<number | null>(null);
  const [rente, setRente] = useState<number | null>(null);
  const [maandbedrag, setMaandbedrag] = useState<number | null>(null);

  const add = () => {
    if (!description.trim() || !saldo) return;
    update((s) => ({
      ...s,
      debts: [...s.debts, {
        id: `debt-${Date.now()}`,
        description: description.trim(),
        lender: lender.trim() || null,
        owner: null,
        principalRemaining: saldo,
        interestRatePerYear: Math.max(rente ?? 0, 0) / 100,
        monthlyPayment: maandbedrag ?? 0,
        remainingTermMonths: null,
        linkedToMortgage: false,
        note: null,
      }],
    }));
    setDescription(""); setLender(""); setSaldo(null); setRente(null); setMaandbedrag(null);
  };

  const inputStyle = {
    padding: "10px", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)",
    background: "var(--surface)", color: "var(--ink)", fontSize: 16,
  } as const;

  return (
    <section className="card">
      <h2 className="card-title">Schuld toevoegen</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-2)" }}>
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="bijv. Studieschuld" aria-label="Omschrijving schuld"
          style={{ ...inputStyle, gridColumn: "1 / -1" }} />
        <input type="text" value={lender} onChange={(e) => setLender(e.target.value)}
          placeholder="verstrekker (bijv. DUO)" aria-label="Verstrekker" style={inputStyle} />
        <EditableNumber value={saldo} allowNull ariaLabel="Restschuld"
          onCommit={setSaldo} />
        <EditableNumber value={rente} allowNull ariaLabel="Rente per jaar in procenten"
          onCommit={setRente} />
        <EditableNumber value={maandbedrag} allowNull ariaLabel="Maandbedrag"
          onCommit={setMaandbedrag} />
      </div>
      <p style={{ margin: "6px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-soft)" }}>
        Velden: verstrekker · restschuld € · rente % (bijv. 2,56) · maandbedrag €.
      </p>
      <button className="btn btn-primary" style={{ marginTop: "var(--sp-2)" }}
        disabled={!description.trim() || !saldo} onClick={add}>
        + Toevoegen
      </button>
    </section>
  );
}

/**
 * Aflosplanner: sneeuwbal (kleinste saldo eerst, motivatie) vs lawine
 * (hoogste rente eerst, goedkoopst), met rollover van vrijgekomen
 * maandbedragen en een instelbaar extra bedrag per maand.
 */
function DebtPlannerCard({ state }: { state: FinancialState }) {
  const [extra, setExtra] = useState(100);
  const [strategy, setStrategy] = useState<DebtStrategyKind>("lawine");
  const relevant = state.debts.filter((d) => !d.linkedToMortgage && d.principalRemaining > 0);
  if (relevant.length === 0) return null;

  const sneeuwbal = debtStrategy(state.debts, extra, "sneeuwbal");
  const lawine = debtStrategy(state.debts, extra, "lawine");
  const baseline = debtStrategy(state.debts, 0, strategy);
  const chosen = strategy === "sneeuwbal" ? sneeuwbal : lawine;
  const interestDelta = sneeuwbal.totalInterest - lawine.totalInterest;

  const fmtMonths = (m: number | null) =>
    m == null ? "niet haalbaar" : m >= 24 ? `${Math.floor(m / 12)} jr ${m % 12} mnd` : `${m} mnd`;
  const fmtDate = new Intl.DateTimeFormat("nl-NL", { month: "short", year: "numeric" });
  const dateAfter = (months: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    return fmtDate.format(d);
  };

  return (
    <section className="card" style={{ backgroundColor: "#e8f5e9", borderLeft: "4px solid var(--positive)" }}>
      <h2 className="card-title">Aflosplanner</h2>
      <div className="row">
        <span className="row-label">Extra aflossen p/m
          <span className="row-sub">bovenop de huidige maandbedragen</span>
        </span>
        <EditableNumber value={extra} ariaLabel="Extra aflossen per maand"
          onCommit={(v) => setExtra(Math.max(v ?? 0, 0))} />
      </div>
      <Segments
        options={[
          { id: "lawine" as const, label: "Lawine (rente)" },
          { id: "sneeuwbal" as const, label: "Sneeuwbal (saldo)" },
        ]}
        value={strategy}
        onChange={setStrategy}
      />
      <div className="row">
        <span className="row-label">Schuldenvrij in</span>
        <strong className="money">{fmtMonths(chosen.monthsToDebtFree)}</strong>
      </div>
      <div className="row">
        <span className="row-label">Totale rente
          <span className="row-sub">
            {extra > 0 && baseline.monthsToDebtFree != null && chosen.monthsToDebtFree != null
              ? `zonder extra: ${formatEUR(baseline.totalInterest)} · je bespaart ${formatEUR(Math.max(baseline.totalInterest - chosen.totalInterest, 0))}`
              : "over de hele looptijd"}
          </span>
        </span>
        <Money value={chosen.totalInterest} />
      </div>
      {chosen.rows.length > 1 && Math.abs(interestDelta) >= 1 && (
        <p style={{ margin: "var(--sp-2) 0 0", fontSize: "var(--text-sm)", fontWeight: 600 }}>
          {interestDelta > 0
            ? `❄️ Lawine is hier ${formatEUR(interestDelta)} goedkoper dan sneeuwbal.`
            : `⛄ Sneeuwbal is hier zelfs ${formatEUR(-interestDelta)} goedkoper — kleine schuld met hoge rente eerst.`}
        </p>
      )}
      <div style={{ marginTop: "var(--sp-2)" }}>
        {[...chosen.rows].sort((a, b) => (a.payoffMonth || 9999) - (b.payoffMonth || 9999)).map((r, i) => (
          <div className="row" key={r.id}>
            <span className="row-label">{i + 1}. {r.description}
              <span className="row-sub">rente betaald: {formatEUR(r.interestPaid)}</span>
            </span>
            <span className="money">{r.payoffMonth > 0 ? dateAfter(r.payoffMonth) : "—"}</span>
          </div>
        ))}
      </div>
      <p style={{ margin: "var(--sp-2) 0 0", fontSize: "var(--text-xs)", color: "var(--ink-soft)" }}>
        Vrijgekomen maandbedragen rollen automatisch door naar de volgende schuld. Hypotheek telt hier niet mee.
      </p>
    </section>
  );
}
