/**
 * charts.tsx — grafiekcomponenten binnen het ontwerpsysteem.
 *
 * Regels (uit de dataviz-methode):
 * - Nominale categorieën in één reeks krijgen één tint (staaflengte doet het
 *   werk), nooit een kleur per staaf.
 * - Categorische kleuren komen uit --viz-1..7 (vaste volgorde, gevalideerd op
 *   kleurenblindheid tegen het kaartvlak in licht én donker); kleur volgt de
 *   categorie, nooit de rangorde — wegfilteren herkleurt de rest dus niet.
 * - Elke waarde is ook zonder kleur leesbaar: bedragen staan er altijd bij.
 * - Dunne staafjes, afgeronde uiteinden, 2px kaartvlak tussen segmenten.
 */

import { fixedExpensesByCategory, formatEUR, formatPct } from "../domain/calc";
import type { FinancialState } from "../domain/types";

/** Vaste lasten per categorie: horizontale staafjes, één tint, bedrag ernaast. */
export function CategoryBreakdown({ state }: { state: FinancialState }) {
  const all = fixedExpensesByCategory(state);
  if (all.length === 0) return null;

  // Meer dan 7 klassen vervaagt — vouw de staart samen tot "Overig".
  const MAX = 7;
  const rows = all.length > MAX
    ? [
        ...all.slice(0, MAX),
        all.slice(MAX).reduce(
          (acc, r) => ({
            category: "Overig",
            perMonth: acc.perMonth + r.perMonth,
            perYear: acc.perYear + r.perYear,
            share: acc.share + r.share,
          }),
          { category: "Overig", perMonth: 0, perYear: 0, share: 0 },
        ),
      ]
    : all;
  const max = Math.max(...rows.map((r) => r.perMonth), 1);

  return (
    <section className="card" aria-labelledby="cat-breakdown-title">
      <h2 className="card-title" id="cat-breakdown-title">Vaste lasten per categorie</h2>
      {rows.map((r) => (
        <div key={r.category} style={{ padding: "var(--sp-1) 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "var(--sp-2)" }}>
            <span style={{ fontSize: "var(--text-sm)" }}>
              {r.category}{" "}
              <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-soft)" }}>{formatPct(r.share)}</span>
            </span>
            <span className="money" style={{ fontSize: "var(--text-sm)" }}>{formatEUR(r.perMonth)}</span>
          </div>
          <div style={{ background: "var(--viz-track)", borderRadius: 4, height: 8, marginTop: 3 }}
            role="img" aria-label={`${r.category}: ${formatEUR(r.perMonth)} per maand, ${formatPct(r.share)} van het totaal`}>
            <div style={{
              width: `${Math.max((r.perMonth / max) * 100, 0)}%`,
              height: "100%", borderRadius: 4, background: "var(--action)",
            }} />
          </div>
        </div>
      ))}
    </section>
  );
}

export interface StackSegment {
  label: string;
  value: number;
  /** CSS-kleur (bijv. "var(--viz-1)") — vast per categorie, onafhankelijk van filters. */
  color: string;
}

/**
 * Horizontale gestapelde balk (deel-van-geheel) met legenda.
 * 2px kaartvlak tussen segmenten; aandelen < 1% tonen als "<1%".
 */
export function StackedBar({ segments, ariaLabel }: { segments: StackSegment[]; ariaLabel: string }) {
  const shown = segments.filter((s) => s.value > 0);
  const total = shown.reduce((t, s) => t + s.value, 0);
  if (total <= 0) return null;
  const sharePct = (v: number) => {
    const pct = (v / total) * 100;
    return pct < 1 ? "<1%" : `${Math.round(pct)}%`;
  };

  return (
    <div>
      <div role="img" aria-label={ariaLabel}
        style={{ display: "flex", gap: 2, height: 16, borderRadius: 5, overflow: "hidden" }}>
        {shown.map((s) => (
          <div key={s.label} title={`${s.label}: ${formatEUR(s.value)} (${sharePct(s.value)})`}
            style={{
              width: `${(s.value / total) * 100}%`,
              minWidth: 3,
              background: s.color,
            }} />
        ))}
      </div>
      <div style={{ marginTop: "var(--sp-3)" }}>
        {shown.map((s) => (
          <div key={s.label} style={{
            display: "flex", alignItems: "center", gap: "var(--sp-2)",
            padding: "3px 0", fontSize: "var(--text-sm)",
          }}>
            <span aria-hidden style={{
              width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0,
            }} />
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.label}
            </span>
            <span className="money" style={{ fontSize: "var(--text-sm)" }}>{formatEUR(s.value)}</span>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-soft)", minWidth: 34, textAlign: "right" }}>
              {sharePct(s.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
