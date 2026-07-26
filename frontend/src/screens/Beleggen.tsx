import { useEffect, useRef, useState } from "react";
import {
  allocationByClass, assetClassOf, forecastTable, formatEUR, formatPct,
  portfolioDerived, totalInvestingPerMonth,
} from "../domain/calc";
import { applyPortfolioRows, parseDegiroPortfolio } from "../domain/portfolioImport";
import type { FinancialState } from "../domain/types";
import { DeleteChip, EditableNumber, Money, Segments } from "../components/ui";
import { useSync } from "../state/SyncContext";

const PLATFORMS = ["Bitvavo", "Degiro", "Trading 212", "Mintos", "Bondora", "Anders"] as const;

type Section = "portefeuille" | "inleg" | "prognose";

export function Beleggen({ state }: { state: FinancialState }) {
  const [section, setSection] = useState<Section>("portefeuille");
  return (
    <main className="screen">
      <h1 className="screen-title">Beleggen</h1>
      <p className="screen-sub">Portefeuille, maandelijkse inleg en prognose.</p>
      <Segments
        options={[
          { id: "portefeuille", label: "Portefeuille" },
          { id: "inleg", label: "Inleg" },
          { id: "prognose", label: "Prognose" },
        ]}
        value={section}
        onChange={setSection}
      />
      {section === "portefeuille" && <Holdings state={state} />}
      {section === "inleg" && <Contributions state={state} />}
      {section === "prognose" && <Forecast state={state} />}
    </main>
  );
}

/**
 * Live crypto-koersen via de publieke Bitvavo API (alleen prijzen — geen
 * account-koppeling, dus geen API-sleutels in de browser). DeGiro heeft geen
 * publieke API; ETF-koersen blijven handmatig.
 */
async function fetchBitvavoPrice(ticker: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.bitvavo.com/v2/ticker/price?market=${encodeURIComponent(ticker)}-EUR`);
    if (!res.ok) return null;
    const data = (await res.json()) as { price?: string };
    const price = Number(data.price);
    return Number.isFinite(price) ? Math.round(price * 100) / 100 : null;
  } catch {
    return null;
  }
}

/** CSV-export voor getquin.com (kolommen daar handmatig te mappen bij import). */
function downloadGetquinCsv(state: FinancialState) {
  const today = new Date().toISOString().slice(0, 10);
  const quote = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [
    ["Date", "Type", "AssetType", "Identifier", "Name", "Shares", "Price", "Currency"],
    ...state.portfolio.holdings
      .filter((h) => (h.quantity ?? 0) > 0)
      .map((h) => {
        const klass = assetClassOf(h.platform);
        return [
          today, "Buy",
          klass === "Crypto" ? "Crypto" : klass === "Aandelen & ETF's" ? "ETF" : "Other",
          h.ticker ?? h.name, h.name,
          h.quantity ?? 0, h.avgBuyPrice ?? h.currentPrice ?? 0, "EUR",
        ];
      }),
  ];
  const csv = rows.map((r) => r.map(quote).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "getquin-import.csv";
  a.click();
  URL.revokeObjectURL(url);
}

const BITVAVO_SYNC_KEY = "finance-tracker-bitvavo-sync";

function Holdings({ state }: { state: FinancialState }) {
  const { update } = useSync();
  const pf = portfolioDerived(state);
  const allocation = allocationByClass(state);
  const degiroRef = useRef<HTMLInputElement>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const syncBitvavo = async (auto = false) => {
    setSyncing(true);
    if (!auto) setSyncMsg(null);
    const cryptos = state.portfolio.holdings.filter(
      (h) => assetClassOf(h.platform) === "Crypto" && h.ticker);
    let updated = 0;
    for (const h of cryptos) {
      const price = await fetchBitvavoPrice(h.ticker!);
      if (price != null) {
        update((s) => patchHolding(s, h.id, { currentPrice: price }));
        updated++;
      }
    }
    if (auto) {
      if (updated > 0) setSyncMsg(`✓ Cryptokoersen automatisch ververst (${updated}).`);
    } else {
      setSyncMsg(updated > 0
        ? `✓ ${updated} van ${cryptos.length} koersen bijgewerkt — druk op Opslaan om te bewaren.`
        : "Kon geen koersen ophalen (Bitvavo niet bereikbaar).");
    }
    setSyncing(false);
  };

  // Workflow-automatisering: koersen verversen zichzelf stilletjes bij het
  // openen van dit scherm, maximaal één keer per uur.
  useEffect(() => {
    const hasCrypto = state.portfolio.holdings.some(
      (h) => assetClassOf(h.platform) === "Crypto" && h.ticker);
    if (!hasCrypto) return;
    const last = Number(localStorage.getItem(BITVAVO_SYNC_KEY) ?? 0);
    if (Date.now() - last < 3600_000) return;
    localStorage.setItem(BITVAVO_SYNC_KEY, String(Date.now()));
    void syncBitvavo(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const importDegiro = async (file: File) => {
    setSyncMsg(null);
    try {
      const rows = parseDegiroPortfolio(await file.text());
      if (rows.length === 0) {
        setSyncMsg("Geen posities gevonden — exporteer in de DeGiro-webtrader je Portefeuille als CSV.");
        return;
      }
      let updated = 0, created = 0;
      update((s) => {
        const r = applyPortfolioRows(s, rows, "Degiro");
        updated = r.updated; created = r.created;
        return r.state;
      });
      setSyncMsg(`✓ DeGiro: ${updated} bijgewerkt, ${created} nieuw — druk op Opslaan om te bewaren.`);
    } catch {
      setSyncMsg("Bestand kon niet gelezen worden.");
    }
  };

  return (
    <>
      <section className="card">
        <h2 className="card-title">Koppelingen</h2>
        {/* Grid met vaste kolommen: knoplabels ("Bezig…") wisselen van lengte
            zonder dat de knoppen van maat veranderen of afkappen. */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-2)" }}>
          <button className="btn btn-primary" disabled={syncing} onClick={() => void syncBitvavo()}>
            {syncing ? "Bezig met ophalen…" : "🔄 Bitvavo koersen"}
          </button>
          <input ref={degiroRef} type="file" accept=".csv" style={{ display: "none" }}
            aria-label="DeGiro Portfolio.csv"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void importDegiro(f); e.target.value = ""; }} />
          <button className="btn btn-primary" onClick={() => degiroRef.current?.click()}>
            📥 DeGiro CSV
          </button>
          <button className="btn btn-ghost" style={{ gridColumn: "1 / -1" }} onClick={() => downloadGetquinCsv(state)}>
            ⬇ getquin-export
          </button>
        </div>
        {syncMsg && (
          <p style={{ margin: "var(--sp-3) 0 0", fontSize: "var(--text-sm)", color: syncMsg.startsWith("✓") ? "var(--positive)" : "var(--negative)" }}>
            {syncMsg}
          </p>
        )}
        <p style={{ margin: "var(--sp-3) 0 0", fontSize: "var(--text-xs)", color: "var(--ink-soft)" }}>
          Bitvavo: live prijzen via de publieke API. DeGiro: exporteer je Portefeuille als CSV in de
          webtrader en upload hier — posities worden bijgewerkt of aangemaakt. Trading 212, Mintos en
          Bondora hebben geen bruikbare koppeling: voeg ze hieronder toe (P2P: aantal 1, koers =
          huidige accountwaarde). Alles blijft lokaal in je browser.
        </p>
      </section>

      {allocation.length > 1 && (
        <section className="card">
          <h2 className="card-title">Verdeling per beleggingsklasse</h2>
          {allocation.map((a) => (
            <div key={a.klass} style={{ padding: "var(--sp-1) 0" }}>
              <div className="row" style={{ borderTop: "none", padding: "var(--sp-1) 0" }}>
                <span className="row-label">{a.klass}
                  <span className="row-sub">{formatPct(a.share)} van je portefeuille</span>
                </span>
                <Money value={a.value} />
              </div>
              <div className="progress" style={{ height: 5 }}>
                <div className="progress-fill" style={{ width: `${a.share * 100}%`, background: "var(--action)" }} />
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="card">
        <h2 className="card-title">Totaal</h2>
        <div className="row"><span className="row-label">Ingelegd</span><Money value={pf.totalInvested} /></div>
        <div className="row"><span className="row-label">Waarde nu</span><strong><Money value={pf.totalValue} /></strong></div>
        <div className="row">
          <span className="row-label">Resultaat</span>
          <span>
            <Money value={pf.totalResultEur} signed />{" "}
            {pf.totalResultPct != null && <span className="row-sub" style={{ display: "inline" }}>({formatPct(pf.totalResultPct)})</span>}
          </span>
        </div>
      </section>

      {pf.holdings.map((h) => (
        <section className="card" key={h.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 className="card-title">{h.platform} · {h.name}{h.ticker ? ` (${h.ticker})` : ""}</h2>
            <DeleteChip title={`Verwijder ${h.name}`}
              onClick={() => update((s) => ({
                ...s,
                portfolio: { ...s.portfolio, holdings: s.portfolio.holdings.filter((x) => x.id !== h.id) },
              }))} />
          </div>
          <div className="row">
            <span className="row-label">Aantal</span>
            <EditableNumber value={h.quantity} allowNull ariaLabel={`Aantal ${h.name}`}
              onCommit={(v) => update((s) => patchHolding(s, h.id, { quantity: v }))} />
          </div>
          <div className="row">
            <span className="row-label">Gem. aankoopkoers</span>
            <EditableNumber value={h.avgBuyPrice} allowNull ariaLabel={`Aankoopkoers ${h.name}`}
              onCommit={(v) => update((s) => patchHolding(s, h.id, { avgBuyPrice: v }))} />
          </div>
          <div className="row">
            <span className="row-label">Huidige koers</span>
            <EditableNumber value={h.currentPrice} allowNull ariaLabel={`Huidige koers ${h.name}`}
              onCommit={(v) => update((s) => patchHolding(s, h.id, { currentPrice: v }))} />
          </div>
          <div className="row">
            <span className="row-label">Waarde
              <span className="row-sub">allocatie {formatPct(h.allocation)}</span>
            </span>
            <span>
              <Money value={h.value} />{" "}
              {h.resultPct != null && (
                <span className={h.resultEur >= 0 ? "money money--pos" : "money money--neg"}>
                  ({formatPct(h.resultPct)})
                </span>
              )}
            </span>
          </div>
        </section>
      ))}

      <AddHoldingCard />
    </>
  );
}

/** Nieuwe positie toevoegen — dekt Trading 212, Mintos, Bondora en alles zonder koppeling. */
function AddHoldingCard() {
  const { update } = useSync();
  const [platform, setPlatform] = useState<string>("Trading 212");
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");

  const parseNum = (t: string) => {
    const n = Number(t.trim().replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };
  const isP2P = assetClassOf(platform) === "P2P-leningen";
  const canAdd = name.trim().length > 0 && parseNum(qty) != null && parseNum(price) != null;

  const add = () => {
    if (!canAdd) return;
    const id = `hold-${platform.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    update((s) => ({
      ...s,
      portfolio: {
        ...s.portfolio,
        holdings: [...s.portfolio.holdings, {
          id, platform, name: name.trim(),
          ticker: ticker.trim() ? ticker.trim().toUpperCase() : null,
          quantity: parseNum(qty), avgBuyPrice: null, currentPrice: parseNum(price),
        }],
      },
    }));
    setName(""); setTicker(""); setQty(""); setPrice("");
  };

  const input = (value: string, set: (v: string) => void, placeholder: string, label: string, numeric = false) => (
    <input
      value={value}
      onChange={(e) => set(e.target.value)}
      placeholder={placeholder}
      aria-label={label}
      inputMode={numeric ? "decimal" : undefined}
      style={{ width: "100%", padding: "0.6rem", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", fontSize: 16 }}
    />
  );

  return (
    <section className="card">
      <h2 className="card-title">Positie toevoegen</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-2)" }}>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          aria-label="Platform"
          style={{ padding: "0.6rem", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", background: "var(--surface)", fontSize: 16 }}
        >
          {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        {input(ticker, setTicker, "ticker (opt.)", "Ticker")}
        <div style={{ gridColumn: "1 / -1" }}>
          {input(name, setName, isP2P ? "bijv. Mintos account" : "naam, bijv. VWRL", "Naam")}
        </div>
        {input(qty, setQty, isP2P ? "aantal: 1" : "aantal", "Aantal", true)}
        {input(price, setPrice, isP2P ? "accountwaarde €" : "koers €", "Huidige koers", true)}
      </div>
      <button className="btn btn-primary" style={{ width: "100%", marginTop: "var(--sp-3)" }} disabled={!canAdd} onClick={add}>
        + Toevoegen
      </button>
      <p style={{ margin: "var(--sp-2) 0 0", fontSize: "var(--text-xs)", color: "var(--ink-soft)" }}>
        P2P (Mintos/Bondora): gebruik aantal 1 en zet je totale accountwaarde als koers —
        werk die periodiek bij. Klasse ({assetClassOf(platform)}) telt mee in je verdeling en vermogen.
      </p>
    </section>
  );
}

function patchHolding(s: FinancialState, id: string, patch: Partial<FinancialState["portfolio"]["holdings"][number]>): FinancialState {
  return {
    ...s,
    portfolio: {
      ...s.portfolio,
      holdings: s.portfolio.holdings.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    },
  };
}

function Contributions({ state }: { state: FinancialState }) {
  const { update } = useSync();
  return (
    <section className="card">
      <h2 className="card-title">Maandelijkse inleg</h2>
      {state.portfolio.monthlyContributions.map((c) => (
        <div className="row" key={c.id}>
          <span className="row-label">{c.target}</span>
          <EditableNumber value={c.amountPerMonth} ariaLabel={`Inleg ${c.target}`}
            onCommit={(v) => update((s) => ({
              ...s,
              portfolio: {
                ...s.portfolio,
                monthlyContributions: s.portfolio.monthlyContributions.map((x) =>
                  x.id === c.id ? { ...x, amountPerMonth: v ?? 0 } : x),
              },
            }))} />
        </div>
      ))}
      <div className="row">
        <strong className="row-label">Totaal inleg p/m</strong>
        <strong><Money value={totalInvestingPerMonth(state)} /></strong>
      </div>
    </section>
  );
}

function Forecast({ state }: { state: FinancialState }) {
  const { update } = useSync();
  const pf = portfolioDerived(state);
  const rows = forecastTable(state.forecast, {
    startValue: pf.totalValue,
    monthlyContribution: totalInvestingPerMonth(state),
  });
  const last = rows.at(-1)!;
  const f = state.forecast;

  return (
    <>
      <section className="card">
        <h2 className="card-title">Uitgangspunten</h2>
        <div className="row">
          <span className="row-label">Rendement per jaar
            <span className="row-sub">aanname — historisch ± 5–8% voor een brede index</span>
          </span>
          <EditableNumber value={f.expectedReturnPerYear * 100} ariaLabel="Rendement per jaar in procenten"
            onCommit={(v) => update((s) => ({ ...s, forecast: { ...s.forecast, expectedReturnPerYear: (v ?? 0) / 100 } }))} />
        </div>
        <div className="row">
          <span className="row-label">Inflatie per jaar (%)</span>
          <EditableNumber value={f.inflationPerYear * 100} ariaLabel="Inflatie per jaar in procenten"
            onCommit={(v) => update((s) => ({ ...s, forecast: { ...s.forecast, inflationPerYear: (v ?? 0) / 100 } }))} />
        </div>
        <div className="row">
          <span className="row-label">Horizon (jaren)</span>
          <EditableNumber value={f.horizonYears} ariaLabel="Horizon in jaren"
            onCommit={(v) => update((s) => ({ ...s, forecast: { ...s.forecast, horizonYears: Math.max(0, Math.min(60, Math.round(v ?? 0))) } }))} />
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Verwachting na {f.horizonYears} jaar</h2>
        <div className="row"><span className="row-label">Verwachte waarde</span><strong><Money value={last.endValue} /></strong></div>
        <div className="row"><span className="row-label">Waarvan zelf ingelegd</span><Money value={last.totalContributed} /></div>
        <div className="row"><span className="row-label">Groei door rendement</span><Money value={last.endValue - last.totalContributed} signed /></div>
        <div className="row"><span className="row-label">In koopkracht van nu</span><Money value={last.inTodaysMoney} /></div>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-soft)", margin: "var(--sp-3) 0 0" }}>
          Rekenmodel met vast rendement — echte rendementen schommelen. Geen financieel advies.
        </p>
      </section>

      <section className="card">
        <h2 className="card-title">Per jaar</h2>
        {rows.filter((r) => r.year % 5 === 0 || r.year === rows.length - 1).map((r) => (
          <div className="row" key={r.year}>
            <span className="row-label">Jaar {r.year}</span>
            <span>
              <Money value={r.endValue} />{" "}
              <span className="row-sub" style={{ display: "inline" }}>
                ({formatEUR(r.inTodaysMoney)} nu)
              </span>
            </span>
          </div>
        ))}
      </section>
    </>
  );
}
