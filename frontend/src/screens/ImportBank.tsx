import { useRef, useState } from "react";
import type { FinancialState, MonthKey } from "../domain/types";
import { MONTH_KEYS } from "../domain/types";
import {
  aggregateExpenses, applyImportToState, detectRecurring, parseBankFile,
} from "../domain/bankImport";
import type { ImportSummary, ParseResult, RecurringPayment } from "../domain/bankImport";
import { Money } from "../components/ui";
import { useSync } from "../state/SyncContext";

/**
 * Bankimport — upload een export van ING / Rabobank / ABN AMRO (of generieke
 * CSV), bekijk de automatische categorisering en zet de uitgaven in het
 * maandoverzicht. Verwerking is 100% lokaal in de browser.
 */
export function ImportSection({ state }: { state: FinancialState }) {
  const { update } = useSync();
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [recurring, setRecurring] = useState<RecurringPayment[]>([]);
  const [addedSubs, setAddedSubs] = useState<string[]>([]);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null); setApplied(false); setResult(null); setSummary(null);
    setRecurring([]); setAddedSubs([]);
    try {
      const text = await file.text();
      const parsed = parseBankFile(text);
      if (parsed.transactions.length === 0) {
        setError("Geen transacties gevonden. Ondersteund: ING CSV, Rabobank CSV, ABN AMRO TXT of een CSV met datum/bedrag/omschrijving-kolommen.");
        return;
      }
      setResult(parsed);
      setSummary(aggregateExpenses(state, parsed.transactions));
      setRecurring(detectRecurring(parsed.transactions));
    } catch {
      setError("Bestand kon niet gelezen worden.");
    }
  };

  /** Bestaat deze merchant al (ongeveer) in de vaste lasten? */
  const inFixed = (merchant: string) => {
    const m = merchant.toLowerCase().slice(0, 12);
    return state.fixedExpenses.some((e) =>
      e.description.toLowerCase().includes(m) || m.includes(e.description.toLowerCase()));
  };

  const addAsFixed = (r: RecurringPayment) => {
    update((s) => ({
      ...s,
      fixedExpenses: [...s.fixedExpenses, {
        id: `fx-import-${Date.now()}`,
        payDay: r.dayOfMonth,
        description: r.merchant,
        category: "Abonnementen",
        tag: null,
        amountPerMonth: r.perMonth,
      }],
    }));
    setAddedSubs((prev) => [...prev, r.merchant]);
  };

  const apply = () => {
    if (!summary) return;
    update((s) => applyImportToState(s, summary.sums));
    setApplied(true);
  };

  const categoryTotals = summary
    ? Object.entries(summary.sums).map(([category, months]) => ({
        category,
        total: Object.values(months).reduce((t: number, v) => t + (v ?? 0), 0),
        months: MONTH_KEYS.filter((m) => months[m] != null) as MonthKey[],
      })).sort((a, b) => b.total - a.total)
    : [];

  return (
    <>
      <section className="card">
        <h2 className="card-title">Bankafschrift importeren</h2>
        <p style={{ margin: "0 0 var(--sp-3)", fontSize: "var(--text-sm)", color: "var(--ink-soft)" }}>
          Upload een transactie-export van je bank (ING, Rabobank of ABN AMRO). Uitgaven worden
          automatisch gecategoriseerd en per maand in het maandoverzicht gezet — zo rekent de app
          met je échte cijfers.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,.tab"
          aria-label="Kies bankexport-bestand"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
          style={{ display: "none" }}
        />
        <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => fileRef.current?.click()}>
          📄 Kies bestand…
        </button>
        <p style={{ margin: "var(--sp-3) 0 0", fontSize: "var(--text-xs)", color: "var(--ink-soft)" }}>
          🔒 Je bankbestand wordt lokaal in je browser verwerkt en nergens geüpload.
        </p>
        {error && <div className="banner banner--error" style={{ marginTop: "var(--sp-3)" }}>{error}</div>}
      </section>

      {result && summary && (
        <section className="card">
          <h2 className="card-title">Gevonden · {result.bank}</h2>
          <div className="row"><span className="row-label">Transacties in bestand</span><span className="money">{result.transactions.length}</span></div>
          <div className="row"><span className="row-label">Meegeteld als variabele uitgave</span><span className="money">{summary.counted}</span></div>
          <div className="row">
            <span className="row-label">Overgeslagen
              <span className="row-sub">{summary.skippedIncome} inkomsten · {summary.skippedFixed} vaste lasten/overboekingen · {summary.skippedOtherYear} buiten {state.monthOverview.year}</span>
            </span>
            <span className="money">{summary.skippedIncome + summary.skippedFixed + summary.skippedOtherYear}</span>
          </div>
          <div className="row">
            <strong className="row-label">Totaal variabele uitgaven</strong>
            <strong><Money value={summary.totalExpenses} cents /></strong>
          </div>
        </section>
      )}

      {recurring.length > 0 && (
        <section className="card" style={{ backgroundColor: "#fff8e1", borderLeft: "4px solid var(--accent)" }}>
          <h2 className="card-title">🔁 Terugkerende betalingen gevonden</h2>
          <p style={{ margin: "0 0 var(--sp-2)", fontSize: "var(--text-sm)", color: "var(--ink-soft)" }}>
            Abonnementen en incasso's met een vast maandbedrag. Check of je ze nog wilt —
            opzeggen is vaak de snelste besparing.
          </p>
          {recurring.map((r) => {
            const already = inFixed(r.merchant) || addedSubs.includes(r.merchant);
            return (
              <div className="row" key={r.merchant}>
                <span className="row-label">{r.merchant}
                  <span className="row-sub">{r.count}× gezien · <Money value={r.perYear} /> per jaar</span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
                  <Money value={r.perMonth} cents />
                  <button
                    onClick={() => addAsFixed(r)}
                    disabled={already}
                    title={already ? "Staat al in vaste lasten" : "Voeg toe aan vaste lasten"}
                    style={{
                      padding: "0.3rem 0.55rem", border: "none", borderRadius: "4px",
                      fontSize: "0.75rem", fontWeight: 600, cursor: already ? "default" : "pointer",
                      backgroundColor: already ? "var(--surface-sunken)" : "var(--action)",
                      color: already ? "var(--ink-soft)" : "#fff",
                    }}
                  >
                    {already ? "✓" : "+ vast"}
                  </button>
                </span>
              </div>
            );
          })}
          {addedSubs.length > 0 && (
            <p style={{ margin: "var(--sp-2) 0 0", fontSize: "var(--text-sm)", color: "var(--positive)" }}>
              Toegevoegd aan vaste lasten — druk op <strong>Opslaan</strong> om te bewaren.
            </p>
          )}
        </section>
      )}

      {summary && categoryTotals.length > 0 && (
        <section className="card">
          <h2 className="card-title">Per categorie</h2>
          {categoryTotals.map((c) => (
            <div className="row" key={c.category}>
              <span className="row-label">{c.category}
                <span className="row-sub">{c.months.join(", ")}</span>
              </span>
              <Money value={c.total} cents />
            </div>
          ))}
          <button className="btn btn-primary" style={{ width: "100%", marginTop: "var(--sp-3)" }} onClick={apply} disabled={applied}>
            {applied ? "✓ Toegepast" : "Toepassen op maandoverzicht"}
          </button>
          {applied && (
            <p style={{ margin: "var(--sp-3) 0 0", fontSize: "var(--text-sm)", color: "var(--positive)" }}>
              Uitgaven staan in het maandoverzicht. Druk op <strong>Opslaan</strong> om ze te bewaren.
            </p>
          )}
        </section>
      )}
    </>
  );
}
