import { useEffect, useState } from "react";
import { formatEUR, formatPct } from "../domain/calc";
import { useSync } from "../state/SyncContext";

/** Money value with tabular numerals; optional +/- coloring. */
export function Money({ value, cents = false, signed = false }: {
  value: number; cents?: boolean; signed?: boolean;
}) {
  const cls = signed
    ? value > 0 ? "money money--pos" : value < 0 ? "money money--neg" : "money"
    : "money";
  return <span className={cls}>{signed && value > 0 ? "+" : ""}{formatEUR(value, cents)}</span>;
}

export function Pct({ value }: { value: number }) {
  return <span className="money">{formatPct(value)}</span>;
}

/**
 * Numeric input for euro amounts. Commits on blur/Enter so typing doesn't
 * thrash the draft; accepts both comma and dot decimals (nl-NL keyboards).
 */
export function EditableNumber({ value, onCommit, allowNull = false, ariaLabel }: {
  value: number | null;
  onCommit: (v: number | null) => void;
  allowNull?: boolean;
  ariaLabel: string;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));
  useEffect(() => { setText(value == null ? "" : String(value)); }, [value]);

  const commit = () => {
    const trimmed = text.trim().replace(",", ".");
    if (trimmed === "") {
      onCommit(allowNull ? null : 0);
      return;
    }
    const n = Number(trimmed);
    if (Number.isFinite(n)) onCommit(Math.round(n * 100) / 100);
    else setText(value == null ? "" : String(value)); // revert invalid input
  };

  return (
    <input
      className="field-number"
      inputMode="decimal"
      aria-label={ariaLabel}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
    />
  );
}

/**
 * Geldstroom — the signature element. One bar, income split into where it
 * goes each month: vaste lasten (ink), beleggen (sea green), sparen (amber).
 */
export function Geldstroom({ income, lasten, beleggen, sparen }: {
  income: number; lasten: number; beleggen: number; sparen: number;
}) {
  const total = Math.max(income, 1);
  const w = (v: number) => `${Math.max((v / total) * 100, 0)}%`;
  const parts = [
    { key: "lasten", label: "Vaste lasten", value: lasten, cls: "flow-seg--lasten", color: "var(--ink)" },
    { key: "beleggen", label: "Beleggen", value: beleggen, cls: "flow-seg--beleggen", color: "var(--action)" },
    { key: "sparen", label: "Sparen", value: sparen, cls: "flow-seg--sparen", color: "var(--accent)" },
  ];
  return (
    <div>
      <div className="flow" role="img"
        aria-label={`Van ${formatEUR(income)} inkomen gaat ${formatEUR(lasten)} naar vaste lasten, ${formatEUR(beleggen)} naar beleggen en ${formatEUR(sparen)} naar sparen.`}>
        {parts.map((p) => (
          <div key={p.key} className={`flow-seg ${p.cls}`} style={{ width: w(p.value) }} />
        ))}
      </div>
      <div className="flow-legend">
        {parts.map((p) => (
          <span key={p.key} className="flow-key">
            <span className="flow-dot" style={{ background: p.color }} />
            {p.label} <Money value={p.value} />
          </span>
        ))}
      </div>
    </div>
  );
}

export type TabId = "dashboard" | "cashflow" | "beleggen" | "wonen" | "vermogen";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "dashboard", label: "Overzicht", icon: "◫" },
  { id: "cashflow", label: "Cashflow", icon: "⇄" },
  { id: "beleggen", label: "Beleggen", icon: "△" },
  { id: "wonen", label: "Wonen", icon: "⌂" },
  { id: "vermogen", label: "Vermogen", icon: "◎" },
];

export function TabBar({ active, onSelect }: { active: TabId; onSelect: (t: TabId) => void }) {
  return (
    <nav className="tabbar" aria-label="Hoofdnavigatie">
      <div className="tabbar-inner">
        {TABS.map((t) => (
          <button key={t.id} className="tab"
            aria-current={active === t.id ? "page" : undefined}
            onClick={() => onSelect(t.id)}>
            <span className="tab-icon" aria-hidden>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

/** Floating save pill; only visible when the draft has unsaved changes. */
export function SaveBar() {
  const { dirty, status, save, reload } = useSync();
  if (!dirty && status !== "saving" && status !== "conflict") return null;
  return (
    <div className="savebar">
      <div className="savebar-inner">
        <span style={{ fontSize: "var(--text-sm)" }}>
          {status === "saving" ? "Opslaan…"
            : status === "conflict" ? "Conflict — herlaad eerst"
            : "Niet-opgeslagen wijzigingen"}
        </span>
        {status === "conflict" ? (
          <button className="btn btn-primary" onClick={() => void reload()}>Herladen</button>
        ) : (
          <button className="btn btn-primary" disabled={status === "saving"} onClick={() => void save()}>
            Opslaan
          </button>
        )}
      </div>
    </div>
  );
}

/** Segmented switcher used inside grouped screens. */
export function Segments<T extends string>({ options, value, onChange }: {
  options: { id: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="segments" role="group">
      {options.map((o) => (
        <button key={o.id} className="segment" aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
